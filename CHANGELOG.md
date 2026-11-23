# Değişiklik günlüğü / Changelog

## 0.2.0 - 2026-11-23

Bağımsız bir incelemeden gelen düzeltmeler. / Fixes from an independent review.

- **Güvenlik / Security:** the quality gate reads its command only from the user's own `~/.claude/ekip-gates.json`, keyed by project path. A file inside a cloned repository can no longer make the hook run anything. The gate uses `CLAUDE_PROJECT_DIR`, so it still finds the project after the lead changes directory.
- **Tetikleyici / Trigger:** fewer false positives ("ekip ile ilgili", "ekiple konuştum", "ekibe verilen", "I met with the team") and more forms ("ekibimle", "ekip'le", "takımla yap", "use agent team"). The injected note tells Claude to ignore it when the skill is already active or the message is a worker's report.
- **Takım modu / Team mode:** limited to rival-hypothesis debugging and adversarial review. Cross-layer features now go to subagents, which implement against contracts the lead writes first.
- **inceleyici:** gained `SendMessage`, so split-pane teammates can debate. Default effort is now `medium`; the lead raises it per call for security reviews.
- **README:** states the cost of enabling agent teams globally, the per-agent limits teammates don't get, and which limitations come from docs and which from user reports. The `SUBAGENT_MODEL_FORCE` cost tip is removed, because it also upgraded the Haiku scout.

## 0.1.0 - 2026-11-23

First version. / İlk sürüm.

- "Ekip ile yap" trigger: a `UserPromptSubmit` hook plus a model-invocable `ekip:ekip` skill.
- Routing ladder: Solo → Subagents (the default) → Team (only when it pays off).
- Four roles with model routing:
  - `kesif` (Haiku, read-only)
  - `uygulayici` (Sonnet, writes)
  - `inceleyici` (Sonnet, read-only)
  - `dogrulayici` (Opus, read-only)
- Optional `SubagentStop` quality gate for implementers.
