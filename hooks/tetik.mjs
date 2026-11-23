// UserPromptSubmit hook: when the prompt asks for the ekip workflow
// ("Ekip ile yap", "ekiple incele", "do it with the team", ...), tell Claude
// to load the ekip skill. Silent for every other prompt. Never blocks.

const TRIGGER =
  /\bekip(?:\s+(?:ile|olarak)|le|çe)(?![a-zçğıöşü])|\bekibe\s+ver|\b(?:with|use)\s+the\s+team\b/;

export function normalize(text) {
  // Turkish İ/ı would break plain toLowerCase() matching ("EKİP İLE").
  return text.replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i").toLowerCase();
}

export function wantsEkip(prompt) {
  if (typeof prompt !== "string" || prompt.length === 0) return false;
  const trimmed = prompt.trimStart();
  // Slash commands arrive as typed; /ekip:ekip already loads the skill.
  if (trimmed.startsWith("/")) return false;
  return TRIGGER.test(normalize(prompt));
}

export const CONTEXT =
  "The user asked for the ekip workflow. Before doing anything else, invoke the Skill tool with skill \"ekip:ekip\" " +
  "and follow it for this task. If the user is only talking about the ekip plugin itself or about a human team, " +
  "rather than asking you to do work with the agent team, ignore this note.";

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  try {
    const input = JSON.parse((await readStdin()) || "{}");
    if (!wantsEkip(input.prompt)) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: CONTEXT },
      }),
    );
  } catch {
    // Never break the user's prompt because of this hook.
  }
}

if (process.argv[1]?.endsWith("tetik.mjs")) {
  await main();
}
