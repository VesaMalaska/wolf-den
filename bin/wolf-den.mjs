#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../dist/src/main.js", import.meta.url));
const child = spawnSync(process.execPath, ["--experimental-ffi", app, ...process.argv.slice(2)], { stdio: "inherit" });
if (child.error) {
  process.stderr.write(`Wolf Den could not launch: ${child.error.message}\n`);
  process.exitCode = 1;
} else if (child.signal) {
  process.kill(process.pid, child.signal);
} else {
  process.exitCode = child.status ?? 1;
}
