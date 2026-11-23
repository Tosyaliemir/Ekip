// Run with: node --test tests/hooks.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wantsEkip } from "../hooks/tetik.mjs";
import { shouldSkip, loadConfig } from "../hooks/kapi.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runHook = (name, input, env = {}) =>
  spawnSync(process.execPath, [join(root, "hooks", name)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

test("trigger phrases match", () => {
  for (const p of [
    "Ekip ile yap",
    "EKİP İLE YAP",
    "EKIP ILE YAP",
    "ekip ile şu hatayı ayıkla",
    "bunu ekiple incele",
    "Ekiple yap lütfen",
    "ekip'le yap",
    "ekip’le hallet",
    "ekibimle yap",
    "ekip olarak bak şuna",
    "bunu ekibe ver",
    "ekipçe hallet",
    "takımla yap",
    "takım ile yap şunu",
    "Sahne'deki crash'i ekip ile çöz",
    "do it with the team",
    "fix this as a team",
    "Use the team for this refactor",
    "use agent team",
    "use agent teams for this",
    "Use the team to fix the crash",
  ]) {
    assert.equal(wantsEkip(p), true, p);
  }
});

test("unrelated prompts do not match", () => {
  for (const p of [
    "",
    "fix the login bug",
    "ekipman listesini güncelle",
    "ekipleri listele",
    "ekipler arası toplantı notu",
    "ekip ile ilgili README'yi düzelt",
    "ekip hakkında bir not yaz",
    "ekiple konuştum, maili yaz",
    "ekip ile toplantı ayarla",
    "ekibe verilen görevleri listele",
    "I met with the team yesterday",
    "takımla maç izledik",
    "Use team colors in the CSS",
    "I use the team calendar every day",
    "use the team's component",
    "fix it with the team name",
    "/ekip:ekip review",
  ]) {
    assert.equal(wantsEkip(p), false, p);
  }
});

test("tetik hook prints additionalContext only on a match", () => {
  const hit = runHook("tetik.mjs", { prompt: "Ekip ile yap: README'yi düzelt" });
  assert.equal(hit.status, 0);
  const out = JSON.parse(hit.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(out.hookSpecificOutput.additionalContext, /ekip:ekip/);

  const miss = runHook("tetik.mjs", { prompt: "merhaba" });
  assert.equal(miss.status, 0);
  assert.equal(miss.stdout, "");

  const bad = spawnSync(process.execPath, [join(root, "hooks", "tetik.mjs")], { input: "not json", encoding: "utf8" });
  assert.equal(bad.status, 0);
});

test("kapi skips loops and blocked workers", () => {
  assert.equal(shouldSkip({ stop_hook_active: true }), true);
  assert.equal(shouldSkip({ last_assistant_message: "Status: BLOCKED\n..." }), true);
  assert.equal(shouldSkip({ last_assistant_message: "Status: DONE" }), false);
});

test("kapi reads only the user-level gates file, matched by project path", () => {
  const project = mkdtempSync(join(tmpdir(), "ekip-proj-"));
  const gates = join(mkdtempSync(join(tmpdir(), "ekip-home-")), "ekip-gates.json");
  const env = { EKIP_GATES_FILE: gates, CLAUDE_PROJECT_DIR: project };
  const input = { cwd: join(project, "sub"), stop_hook_active: false, last_assistant_message: "Status: DONE" };

  // No gates file: nothing runs.
  assert.equal(loadConfig(project, gates), null);
  assert.equal(runHook("kapi.mjs", input, env).status, 0);

  // A gate for a different project: nothing runs.
  writeFileSync(gates, JSON.stringify({ "/some/other/project": "node -e \"process.exit(3)\"" }));
  assert.equal(runHook("kapi.mjs", input, env).status, 0);

  // Failing gate for this project (with a trailing slash in the key): blocks once.
  writeFileSync(gates, JSON.stringify({ [`${project}/`]: "node -e \"process.exit(3)\"" }));
  const fail = runHook("kapi.mjs", input, env);
  assert.equal(fail.status, 2);
  assert.match(fail.stderr, /ekip gate/);
  assert.equal(runHook("kapi.mjs", { ...input, stop_hook_active: true }, env).status, 0);

  // Gates file saved with a UTF-8 BOM (Windows PowerShell 5.1) still works.
  writeFileSync(gates, "\uFEFF" + JSON.stringify({ [project]: "node -e \"process.exit(3)\"" }));
  assert.equal(runHook("kapi.mjs", input, env).status, 2);

  // Passing gate in object form.
  writeFileSync(gates, JSON.stringify({ [project]: { check: "node -e \"process.exit(0)\"", timeoutSec: 30 } }));
  assert.equal(runHook("kapi.mjs", input, env).status, 0);
});
