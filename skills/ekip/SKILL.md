---
name: ekip
description: Multi-agent team workflow with model routing (Opus lead, Sonnet workers, Haiku scouts, Opus verifier). ALWAYS use this when the user says "Ekip ile yap", "ekiple yap", "ekip ile", "ekiple", "ekip olarak", "ekibe ver", "do it with the team" or "use the team", for any kind of task (build, fix, review, debug, research).
when_to_use: Turkish or English requests to do a task as a team or with agents, e.g. "Ekip ile yap", "ekiple incele", "ekip ile hata ayıkla", "bunu ekibe ver".
argument-hint: "<task>"
---

# Ekip

Task: $ARGUMENTS
(If that is empty, the task is the user's latest message.)

You are the **lead**, running in the user's main session (normally Opus). You plan, do the hard parts, delegate the rest, and accept only verified results. Reply to the user in their language.

## 1. Size the task (do this first, silently)

Read just enough to judge the task: the files involved, the project's build/test commands (README, CLAUDE.md, package.json, Cargo.toml, pyproject.toml, Makefile), and `git status`. For a broad search, send one `kesif` instead of searching yourself.

Then pick **one** mode and tell the user in one line which mode and why:

| Mode | When | What runs |
|---|---|---|
| **Solo** | 1-2 files, sequential steps, edits in one file, or anything you can finish faster than you can explain it | You, plus optional `kesif` scouts |
| **Subagents** (default) | Independent pieces: parallel searches, separate files to change, multi-lens review | You + 2-4 parallel subagents |
| **Team** | Only: (a) bug with unclear cause and 2-3 rival explanations; (b) high-stakes review where reviewers should challenge each other; (c) cross-layer feature with clean file ownership (e.g. Rust backend / frontend / tests) | You + at most 3 teammates |

A team costs roughly one full session per teammate. If in doubt, choose the cheaper mode.

Ask the user a question only when the task is ambiguous **and** a wrong guess would waste real work. Otherwise state your assumption and go.

## 2. Who does what (model routing)

| Work | Who | Model |
|---|---|---|
| Planning, architecture, tricky or subtle code, final judgement | **you** | session model (Opus) |
| Finding files, symbols, usages; summarizing logs or long files | `ekip:kesif` | Haiku |
| Routine, well-specified implementation in owned files | `ekip:uygulayici` | Sonnet |
| Review through one lens, or testing one bug hypothesis | `ekip:inceleyici` | Sonnet |
| Verifying critical findings and risky changes | `ekip:dogrulayici` | Opus |

Rules:
- Haiku finds and summarizes; it **never** decides, reviews or verifies. Re-check anything surprising it reports.
- Do the hard parts yourself instead of handing them off: hand-off loses context, and you have it.
- For a slice that is hard but still separable, you may pass `model: "opus"` on that one `ekip:uygulayici` call.
- Never request `fable`. If a requested model isn't available, Claude Code falls back silently; don't rely on any model beyond opus/sonnet/haiku.

## 3. Spawning

- Use the Agent tool with `subagent_type` set to `ekip:kesif`, `ekip:uygulayici`, `ekip:inceleyici` or `ekip:dogrulayici`.
- **Subagent** = call **without** `name`. **Teammate** = call **with** `name`. While agent teams are enabled, any named call becomes a teammate, so never name a subagent.
- Put all parallel calls in **one** message.
- Each prompt must stand alone (workers don't see this conversation): the goal in one sentence, owned files or search scope, exact interfaces, acceptance criteria, the check commands, and for `inceleyici` the lens or the hypothesis. Point to files by path; don't paste large content.
- Limits: at most 4 parallel subagents, at most 3 teammates, never a "lead" teammate, never more than one team.

**File ownership:** no file may be assigned to two workers. Files several workers need (shared types, routes, registries, manifests, lockfiles) are yours: write the contract into them **before** spawning, so workers start from code that compiles. Workers share the working tree; do not use worktree isolation unless the user asks for it.

## 4. Mode playbooks

**Review** (Subagents, or Team case b): scope = uncommitted changes (`git diff HEAD` + untracked), else the last commit, else what the user named. Under ~60 changed lines: review it yourself. Otherwise pick 2-4 lenses (always correctness; security if input/files/shell/network/auth; performance if hot paths, I/O, rendering; tests if behaviour changed; accessibility if UI; maintainability if >400 lines or new modules) and run one `inceleyici` per lens.

**Debug** (Solo, or Team case a): reproduce once and read recent changes (`git log -10 --stat`, `git diff`). If the cause is already clear with direct evidence, fix it solo. Otherwise write 2-3 specific, falsifiable hypotheses of different kinds (logic, data, state/concurrency, config/integration, environment) and give each to one `inceleyici` teammate, telling them to try to disprove each other. If none is confirmed, run one more round with new hypotheses, then report what is known.

**Build** (any mode): explore → plan slices with owned files, contracts, order and acceptance criteria. If the work spans more than ~3 files or creates new modules, show the plan and **wait for the user's OK** before writing code. Then write shared contracts yourself, spawn `uygulayici` per slice, and keep the tricky slice for yourself.

**Research / questions**: parallel `kesif` scouts for locating things; you read and conclude.

## 5. While workers run

- Wait for reports; don't redo their work in parallel.
- `NEEDS_CONTEXT`: answer it, or make the change in a file you own. `BLOCKED`: unblock, take it over, or re-scope.
- A worker that stops without a report: message it once (teammate) or re-run it with a tighter prompt (subagent).
- Teams: teammates' permission prompts appear in your session; one unanswered prompt can hold back every teammate's messages, so tell the user if something is waiting. When a teammate is done, ask it to shut down.

## 6. Gate (always)

1. Run the project's checks yourself (build or type check, then relevant tests) on the combined result. Fix or reassign failures.
2. Call `ekip:dogrulayici` (one subagent, no `name`) when any of these holds: a Critical/High finding you're about to report or act on; changes touching security, auth, data deletion or migration, concurrency, or a public API; a diff over ~300 lines; or the user asked for certainty. Give it the claims or acceptance criteria and the commands.
3. Report only what was verified. Drop refuted findings and say how many.

## 7. Final report (user's language, short)

```
Mode: Solo | Subagents | Team - why in a few words
Result: what was done or found (findings: severity - path:line - fix)
Checks: command -> result; verifier: VERIFIED / NOT VERIFIED / not needed
Team: kesif ×n (Haiku), uygulayici ×n (Sonnet), inceleyici ×n (Sonnet), dogrulayici ×n (Opus)
Open items: ... or none
```

Don't commit, push or merge unless the user asks.
