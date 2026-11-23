// SubagentStop quality gate for ekip:uygulayici (opt-in).
//
// If the project has .claude/ekip.json with a "check" command, run it when an
// implementer finishes. On failure, exit 2 so the implementer gets the output
// and one more turn to fix it. stop_hook_active prevents a second block, so a
// worker is never trapped in a loop. Without the file, this hook does nothing.
//
// .claude/ekip.json example:  { "check": "cargo check -q", "timeoutSec": 300 }

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export function loadConfig(cwd) {
  const file = join(cwd, ".claude", "ekip.json");
  if (!existsSync(file)) return null;
  try {
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    if (typeof cfg.check !== "string" || cfg.check.trim() === "") return null;
    const timeoutSec = Number.isFinite(cfg.timeoutSec) ? Math.min(Math.max(cfg.timeoutSec, 10), 540) : 300;
    return { check: cfg.check, timeoutSec };
  } catch {
    return null;
  }
}

export function shouldSkip(input) {
  if (input.stop_hook_active) return true;
  const last = String(input.last_assistant_message || "");
  // A worker that already says it is blocked or needs context should reach the lead unchanged.
  return /Status:\s*(BLOCKED|NEEDS_CONTEXT)/i.test(last);
}

function tail(text, lines) {
  return String(text || "").trimEnd().split(/\r?\n/).slice(-lines).join("\n");
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  let input;
  try {
    input = JSON.parse((await readStdin()) || "{}");
  } catch {
    return;
  }
  if (shouldSkip(input)) return;
  const cwd = input.cwd || process.cwd();
  const cfg = loadConfig(cwd);
  if (!cfg) return;

  const run = spawnSync(cfg.check, {
    cwd,
    shell: true,
    encoding: "utf8",
    timeout: cfg.timeoutSec * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (run.error && run.error.code === "ETIMEDOUT") return; // don't punish the worker for a slow check
  if (run.status === 0) return;

  const output = tail(`${run.stdout || ""}\n${run.stderr || ""}`, 40);
  process.stderr.write(
    `ekip gate: \`${cfg.check}\` failed (exit ${run.status}).\n` +
      "If the failure is caused by your files, fix it and report again. " +
      "If it comes from files you don't own, don't touch them: report DONE_WITH_CONCERNS and name the failing file.\n\n" +
      output +
      "\n",
  );
  process.exit(2);
}

if (process.argv[1]?.endsWith("kapi.mjs")) {
  await main();
}
