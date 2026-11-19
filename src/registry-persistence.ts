import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, rename, unlink } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, resolve, sep } from "node:path";
import { defaultRegistryPath, parsePersistedRegistry, validatePersistedRegistry, type PersistedRegistry, RegistryError } from "./registry.js";

export type RegistryRevision = string;
export type RegistrySnapshot = { document: PersistedRegistry; revision: RegistryRevision };
export type RegistryPersistenceCode = "validation" | "conflict" | "missing" | "invalid-target" | "read" | "write";

export class RegistryPersistenceError extends Error {
  constructor(readonly code: RegistryPersistenceCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RegistryPersistenceError";
  }
}

// Narrow hooks permit deterministic failure tests while actual fixture files still exercise staging and cleanup.
export type RegistryPersistenceHooks = {
  writeTemporary?: (handle: FileHandle, content: string) => Promise<void>;
  beforeReplace?: () => Promise<void>;
  replace?: (source: string, destination: string) => Promise<void>;
};

const pending = new Map<string, Promise<void>>();
async function serialized<T>(path: string, action: () => Promise<T>): Promise<T> {
  const previous = pending.get(path) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  pending.set(path, next);
  await previous;
  try { return await action(); }
  finally {
    if (pending.get(path) === next) pending.delete(path);
    release();
  }
}

function codeOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

function revisionOf(content: string, stat: { dev: number; ino: number }): RegistryRevision {
  return `${stat.dev}:${stat.ino}:${createHash("sha256").update(content).digest("hex")}`;
}

async function checkedDirectory(directory: string): Promise<void> {
  const root = parse(directory).root;
  let current = root;
  for (const part of directory.slice(root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let stat;
    try { stat = await lstat(current); }
    catch (error) {
      if (codeOf(error) === "ENOENT") throw new RegistryPersistenceError("missing", "Registry directory is missing. Create it before saving.", { cause: error });
      throw new RegistryPersistenceError("read", "Could not inspect the registry directory. Check permissions.", { cause: error });
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new RegistryPersistenceError("invalid-target", "Registry directory must be a real directory without symbolic links.");
  }
}

async function readCurrent(path: string): Promise<{ content: string; revision: RegistryRevision } | null> {
  await checkedDirectory(dirname(path));
  let entry;
  try { entry = await lstat(path); }
  catch (error) {
    if (codeOf(error) === "ENOENT") return null;
    throw new RegistryPersistenceError("read", "Could not inspect the registry file. Check permissions.", { cause: error });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) throw new RegistryPersistenceError("invalid-target", "Registry must be a regular file, not a symbolic link or special file.");
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.dev !== entry.dev || before.ino !== entry.ino) throw new RegistryPersistenceError("conflict", "Registry changed while reading. Reload it before retrying.");
    const bytes = await handle.readFile();
    let content: string;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (error) { throw new RegistryPersistenceError("validation", "Registry is not valid UTF-8. Correct the file before reloading.", { cause: error }); }
    const after = await handle.stat();
    const current = await lstat(path);
    if (before.dev !== after.dev || before.ino !== after.ino || after.size !== before.size || bytes.length !== after.size || current.dev !== after.dev || current.ino !== after.ino) {
      throw new RegistryPersistenceError("conflict", "Registry changed while reading. Reload it before retrying.");
    }
    return { content, revision: revisionOf(content, after) };
  } catch (error) {
    if (error instanceof RegistryPersistenceError) throw error;
    if (codeOf(error) === "ELOOP" || codeOf(error) === "ENOENT") throw new RegistryPersistenceError("conflict", "Registry changed while reading. Reload it before retrying.", { cause: error });
    throw new RegistryPersistenceError("read", "Could not read the registry. Check permissions.", { cause: error });
  } finally { await handle?.close(); }
}

function validated(document: unknown): PersistedRegistry {
  try { return validatePersistedRegistry(document); }
  catch (error) {
    if (error instanceof RegistryError) throw new RegistryPersistenceError("validation", error.message, { cause: error });
    throw error;
  }
}

function checkRevision(current: { revision: string } | null, expected: string | null): void {
  const matches = expected === null ? current === null : current !== null && current.revision === expected;
  if (!matches) {
    throw new RegistryPersistenceError("conflict", "Registry changed since it was loaded. Reload the configuration, review your changes, and retry.");
  }
}

export class RegistryPersistence {
  readonly path: string;
  constructor(path = defaultRegistryPath(), private readonly hooks: RegistryPersistenceHooks = {}) {
    if (!isAbsolute(path)) throw new RegistryPersistenceError("invalid-target", "Registry file path must be absolute.");
    this.path = resolve(path);
  }

  async load(): Promise<RegistrySnapshot> {
    const current = await readCurrent(this.path);
    if (!current) throw new RegistryPersistenceError("missing", "Registry is missing. Create it explicitly before editing.");
    try { return { document: parsePersistedRegistry(current.content), revision: current.revision }; }
    catch (error) {
      if (error instanceof RegistryError) throw new RegistryPersistenceError("validation", `${error.message} Correct the file, then reload.`, { cause: error });
      throw error;
    }
  }

  async save(document: unknown, expectedRevision: RegistryRevision): Promise<RegistrySnapshot> {
    const checked = validated(document);
    return serialized(this.path, () => this.write(checked, expectedRevision));
  }

  async initialize(document: unknown): Promise<RegistrySnapshot> {
    const checked = validated(document);
    return serialized(this.path, () => this.write(checked, null));
  }

  private async write(document: PersistedRegistry, expectedRevision: RegistryRevision | null): Promise<RegistrySnapshot> {
    const current = await readCurrent(this.path);
    checkRevision(current, expectedRevision);
    const content = `${JSON.stringify(document, null, 2)}\n`;
    const temporary = join(dirname(this.path), `.projects.json.${randomUUID()}.tmp`);
    let created = false;
    try {
      const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      created = true;
      try {
        if (this.hooks.writeTemporary) await this.hooks.writeTemporary(handle, content);
        else await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally { await handle.close(); }
      const staged = await lstat(temporary);
      checkRevision(await readCurrent(this.path), expectedRevision);
      await this.hooks.beforeReplace?.();
      checkRevision(await readCurrent(this.path), expectedRevision);
      if (expectedRevision === null) {
        // Hard-link creation fails if another process created the destination in the meantime.
        await link(temporary, this.path);
        await unlink(temporary);
        created = false;
      } else {
        await (this.hooks.replace ?? rename)(temporary, this.path);
        created = false;
      }
      // Directory sync is best effort: some filesystems do not support it.
      try { const directory = await open(dirname(this.path), constants.O_RDONLY); try { await directory.sync(); } finally { await directory.close(); } }
      catch { /* Replacement has already happened; no rollback is safe. */ }
      const saved = await readCurrent(this.path);
      if (!saved) throw new RegistryPersistenceError("read", "Registry was replaced but could not be reloaded. Check the file before editing again.");
      if (saved.content !== content || !saved.revision.startsWith(`${staged.dev}:${staged.ino}:`)) {
        throw new RegistryPersistenceError("conflict", "Registry changed immediately after saving. Reload it before editing again.");
      }
      return { document, revision: saved.revision };
    } catch (error) {
      if (error instanceof RegistryPersistenceError) throw error;
      if (expectedRevision === null && codeOf(error) === "EEXIST") throw new RegistryPersistenceError("conflict", "Registry was created elsewhere. Reload before retrying.", { cause: error });
      throw new RegistryPersistenceError("write", "Could not save registry. The previous configuration is unchanged if replacement did not occur; check permissions and retry.", { cause: error });
    } finally {
      if (created) { try { await unlink(temporary); } catch { /* Best-effort cleanup. */ } }
    }
  }
}
