# Ekip

[Türkçe](README.md) · **English**

A lean multi-agent workflow for Claude Code. Say **"Ekip ile yap"** ("do it with the team") in a session, and it takes it from there:

- **Opus** (your main session) leads: it plans, writes the hard parts itself, and makes the final call.
- **Sonnet** workers do routine implementation and review.
- A **Haiku** scout only searches and summarizes; it never decides.
- An **Opus** verifier independently checks critical findings and risky changes.

A real Agent Team is only formed in the two cases where teammates arguing with each other pays off. Everything else runs in one session or with cheap subagents.

## How it works

```
"Ekip ile yap: ..."  ──►  tetik.mjs hook  ──►  ekip:ekip skill loads
                                                │
                   ┌────────────────────────────┼────────────────────────────┐
                 Solo                       Subagents                      Team
         1-2 files, sequential     independent pieces (default)       2 cases only*
                   └────────────────────────────┼────────────────────────────┘
                                                ▼
                       Gate: build/test, plus the Opus verifier when needed
```

\* (a) A bug with an unclear cause and 2-3 rival explanations: each teammate tests one hypothesis and tries to disprove the others. (b) A critical review where the reviewers should challenge each other.

| Role | Model | Access | Job |
|---|---|---|---|
| lead (main session) | Opus | all | plan, architecture, hard code, shared contracts, final call |
| `kesif` (scout) | Haiku | read-only | find files and symbols; summarize logs and long files |
| `uygulayici` (implementer) | Sonnet | writes | routine implementation in its own files, smallest diff |
| `inceleyici` (examiner) | Sonnet | read-only | one review lens, or one bug hypothesis |
| `dogrulayici` (verifier) | Opus | read-only | verifies claims by running things itself |

Limits:
- At most 4 parallel subagents and 3 teammates, and no separate "lead" teammate.
- Each subagent has a `maxTurns` cap and a report template of 150-200 words.
- Nothing depends on Fable.

## Install

**Requirements:**
- Claude Code **v2.1.288 or newer**. That version fixed plugin agents so they run with their own prompts. v2.1.329+ is recommended.
- **Node.js** on `PATH`. The hooks are Node scripts, so the same code runs on Windows and Linux.

1. In Claude Code:
   ```
   /plugin marketplace add Tosyaliemir/ekip
   /plugin install ekip@ekip
   ```
2. Settings. Plugins can't set environment variables, so you have to add these yourself. Merge [`examples/settings.json`](examples/settings.json) into `~/.claude/settings.json`:
   - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` turns on team mode. **The cost:** while teams are on, every subagent Claude names starts as a teammate, even in sessions where you don't use Ekip. If you don't want that, put this line in the `.claude/settings.local.json` of the projects you want, not in your global settings. Ekip also works with teams off: the team cases run as subagents, but the teammates can't debate each other directly.
   - `permissions.allow` pre-approves common read and test commands. Teammates' permission prompts show up in your session, and a teammate waiting on one can't make progress.
   - `teammateMode`: leave it at `in-process`. It works in any terminal; Windows Terminal doesn't support split panes. Inside tmux on Linux, `auto` also works.
3. Restart Claude Code and try:
   ```
   Ekip ile yap: review the last commit
   ```

You can also call it by hand with `/ekip:ekip <task>`.

## Trigger phrases

**Triggers:**
- Turkish: `Ekip ile yap`, `ekip ile …`, `ekiple …`, `ekip'le …`, `ekibimle …`, `ekip olarak …`, `ekipçe …`, `bunu ekibe ver`, `takımla yap`
- English: `do it with the team`, `fix this as a team`, `use the team`, `use agent team`

Case and the Turkish İ/ı don't matter.

**Doesn't trigger:** "ekipman", "ekipler", "ekip ile ilgili …" ("about the team"), "ekiple konuştum" ("I talked with the team"), "ekibe verilen …", "I met with the team".

If a phrase slips through or is caught by mistake, the skill's own description still guides Claude, and the note the hook adds tells it to ignore the note when the message is about the plugin itself or about a human team.

## Optional quality gate

To run your project's check command whenever an `uygulayici` finishes, add the project path and command to **your own** `~/.claude/ekip-gates.json` (example: [`examples/ekip-gates.json`](examples/ekip-gates.json)):

```json
{ "C:/Users/Emir/projeler/sahne": "cargo check -q",
  "/home/emir/projeler/sahne": { "check": "cargo check -q", "timeoutSec": 300 } }
```

- If the check fails, its output goes back to the implementer, which gets **one** more turn to fix it. It can't loop.
- The command is read only from this file in your home directory. A repository you clone can't make the hook run anything.
- Pick a fast command (`cargo check`, `pytest -q -x`). If parallel implementers finish at the same time, the gate can run several times in a row. On Windows, a timeout may not kill every child process.
- The gate only runs for implementers working as subagents. In team mode, the lead runs the checks.

## Cost

- Team mode costs roughly one full session per teammate, which is why it's limited to two cases.
- Near your usage limits, the most effective step is turning teams off: `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "0"`. It applies to the running session right away.
- `CLAUDE_CODE_SUBAGENT_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is **not** recommended: it makes the Opus verifier cheaper, but it also moves the Haiku scout up to the more expensive model.
- `/usage` shows who spent what.

## Known limitations

According to the Claude Code docs:
- Agent Teams are still experimental. `/resume` and `/rewind` don't bring back in-process teammates.
- Teammates don't get the agent's `maxTurns` or `omitClaudeMd`, so the lead gives them small, concrete tasks.
- If a requested model isn't on your plan, Claude Code switches to another model. It warns for subagents, but not for teammates.

From user reports on GitHub (may not hold in every version):
- On Windows, the lead can get stuck in very long team sessions. Use a fresh session for team work.
- An in-process teammate's header can show the lead's model. Check the real model with `/tasks`.

## Development

```
node --test tests/hooks.test.mjs      # hook tests (trigger and gate)
claude plugin validate .              # validate plugin and marketplace
```

CI runs the hook tests on Linux and Windows and validates the plugin on every push.

## License

MIT. Ideas from wshobson/agents, agency-agents and obra/superpowers were rewritten; see [LICENSE](LICENSE).
