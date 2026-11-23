// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wantsEkip } from "../hooks/tetik.mjs";
import { shouldSkip, loadConfig } from "../hooks/kapi.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runHook = (name, input) =>
  spawnSync(process.execPath, [join(root, "hooks", name)], { input: JSON.stringify(input), encoding: "utf8" });

test("trigger phrases match", () => {
  for (const p of [
    "Ekip ile yap",
    "EKİP İLE YAP",
    "ekip ile şu hatayı ayıkla",
    "bunu ekiple incele",
    "Ekiple yap lütfen",
    "ekip olarak bak şuna",
    "bunu ekibe ver",
    "ekipçe hallet",
    "Sahne'deki crash'i ekip ile çöz",
    "do it with the team",
    "Use the team for this refactor",
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
    "/ekip:ekip review",
    "teammate settings nasıl açılır",
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

test("kapi does nothing without config, blocks on failing check, passes on success", () => {
  const dir = mkdtempSync(join(tmpdir(), "ekip-"));
  const input = { cwd: dir, stop_hook_active: false, last_assistant_message: "Status: DONE" };

  assert.equal(loadConfig(dir), null);
  assert.equal(runHook("kapi.mjs", input).status, 0);

  mkdirSync(join(dir, ".claude"));
  writeFileSync(join(dir, ".claude", "ekip.json"), JSON.stringify({ check: "node -e \"process.exit(3)\"" }));
  const fail = runHook("kapi.mjs", input);
  assert.equal(fail.status, 2);
  assert.match(fail.stderr, /ekip gate/);

  assert.equal(runHook("kapi.mjs", { ...input, stop_hook_active: true }).status, 0);

  writeFileSync(join(dir, ".claude", "ekip.json"), JSON.stringify({ check: "node -e \"process.exit(0)\"" }));
  assert.equal(runHook("kapi.mjs", input).status, 0);
});
