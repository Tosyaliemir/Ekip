// SubagentStop quality gate for ekip:uygulayici (opt-in, user-level config).
//
// The check command comes ONLY from your own ~/.claude/ekip-gates.json, keyed by
// project path, never from a file inside the repository, so a cloned repo can't
// make this hook run anything:
//
//   { "C:/Users/Emir/projeler/sahne": "cargo check -q",
//     "/home/emir/projeler/sahne": { "check": "cargo check -q", "timeoutSec": 300 } }
//
// When an implementer finishes and the check fails, exit 2 sends the output back
// to it for one more turn. stop_hook_active prevents a second block (no loops).
// Without a matching entry this hook does nothing.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export function normPath(p) {
  let s = resolve(p).replace(/\\/g, "/").replace(/\/+$/, "");
  if (process.platform === "win32" || /^[a-z]:\//i.test(s)) s = s.toLowerCase();
  return s;
}

export function gatesFile(home = homedir()) {
  return join(home, ".claude", "ekip-gates.json");
}

export function loadConfig(projectDir, file = gatesFile()) {
  if (!projectDir || !existsSync(file)) return null;
  let all;
  try {
    all = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  const want = normPath(projectDir);
  for (const [key, value] of Object.entries(all || {})) {
    if (normPath(key) !== want) continue;
    const cfg = typeof value === "string" ? { check: value } : value || {};
    if (typeof cfg.check !== "string" || cfg.check.trim() === "") return null;
    const t = Number(cfg.timeoutSec);
    const timeoutSec = Number.isFinite(t) ? Math.min(Math.max(t, 10), 540) : 300;
    return { check: cfg.check, timeoutSec };
  }
  return null;
}

export function shouldSkip(input) {
  if (input.stop_hook_active) return true;
  // A worker that already says it is blocked or needs context should reach the lead unchanged.
  return /Status:\s*(BLOCKED|NEEDS_CONTEXT)/i.test(String(input.last_assistant_message || ""));
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
  // The hook's cwd follows the lead's `cd`; the project root is stable.
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const cfg = loadConfig(projectDir, process.env.EKIP_GATES_FILE || gatesFile());
  if (!cfg) return;

  const run = spawnSync(cfg.check, {
    cwd: projectDir,
    shell: true,
    encoding: "utf8",
    timeout: cfg.timeoutSec * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (run.error) return; // timeout or spawn failure: don't punish the worker for the gate itself
  if (run.status === 0) return;

  process.stderr.write(
    `ekip gate: \`${cfg.check}\` failed (exit ${run.status}).\n` +
      "If the failure is caused by your files, fix it and report again. " +
      "If it comes from files you don't own, don't touch them: report DONE_WITH_CONCERNS and name the failing file.\n\n" +
      tail(`${run.stdout || ""}\n${run.stderr || ""}`, 40) +
      "\n",
  );
  process.exit(2);
}

if (process.argv[1]?.endsWith("kapi.mjs")) {
  await main();
}
