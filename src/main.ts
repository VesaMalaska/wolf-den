#!/usr/bin/env node
import { runDashboard } from "./ui.js";

try {
  await runDashboard();
} catch (error) {
  process.stderr.write(`Wolf Den could not start: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
}
