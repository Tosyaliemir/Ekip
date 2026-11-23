// UserPromptSubmit hook: when the prompt asks for the ekip workflow
// ("Ekip ile yap", "ekiple incele", "do it with the team", ...), tell Claude
// to load the ekip skill. Silent for every other prompt. Never blocks.

// Words that, right after "ekip ile"/"ekiple", mean the user is talking ABOUT a team,
// not asking the agent team to work: "ekip ile ilgili", "ekiple konuştum", ...
const ABOUT = "(?!\\s*(?:ilgili|hakkında|hakkinda|konuş|konus|görüş|gorus|toplant|buluş|bulus|tanış|tanis))";

const END = "(?=\\s*(?:[.!?,:;)]|$|\\s+(?:for|to|on)\\b))";

const TRIGGERS = [
  // ekip ile / ekip olarak / ekiple / ekip'le / ekipçe / ekibimle / ekibimiz ile
  `\\bek(?:ip|ibim|ibimiz)(?:\\s+(?:ile|olarak)|['’]?le|çe)(?![a-zçğıöşü])${ABOUT}`,
  // bunu ekibe ver (but not "ekibe verilen")
  "\\bekibe\\s+ver(?![a-zçğıöşü])",
  // takımla yap / takım ile yap
  "\\btakım(?:\\s+ile|la)\\s+yap",
  // English: the phrase must end the clause or continue with for/to/on,
  // so "use team colors", "the team calendar", "the team's", "team name" don't match.
  `\\b(?:do|build|fix|review|debug|handle)\\s+(?:it|this|that)\\s+(?:with\\s+the|as\\s+a)\\s+teams?${END}`,
  `\\buse\\s+(?:the\\s+|an?\\s+)?(?:agent\\s+)?teams?${END}`,
];
const TRIGGER = new RegExp(TRIGGERS.join("|"));

export function normalize(text) {
  // Turkish İ/I would break plain toLowerCase() matching ("EKİP İLE"). Map both to i;
  // the patterns only rely on dotted i, except "takım" which keeps its ı.
  return text.replace(/İ/g, "i").replace(/I/g, "i").toLowerCase().replace(/takim/g, "takım");
}

export function wantsEkip(prompt) {
  if (typeof prompt !== "string" || prompt.length === 0) return false;
  // Slash commands arrive as typed; /ekip:ekip already loads the skill.
  if (prompt.trimStart().startsWith("/")) return false;
  return TRIGGER.test(normalize(prompt));
}

export const CONTEXT =
  "The user may be asking for the ekip workflow. If the ekip skill is not already active for this task, " +
  "invoke the Skill tool with skill \"ekip:ekip\" before doing anything else and follow it. " +
  "Ignore this note if the ekip skill is already active, if this message is a report from a worker or teammate, " +
  "or if the user is only talking about the ekip plugin itself or about a human team.";

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
