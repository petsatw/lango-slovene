// Print the exact instruction string a live session would send, for one lesson.
//
// It exists because that string is the controlled variable of the whole provider comparison: if the
// two runs are scored against different prompts the diff measures us, not them. Reading it before a
// run is cheaper than inferring it from a transcript afterwards.
//
//   npm run prompt:live -- restaurant-l1

import "dotenv/config";
import { buildLessonPrompt, lessonExists } from "../live/prompt";
import { DIALOGUES } from "../dialogues";

const lessonId = process.argv[2];

if (!lessonId || !lessonExists(lessonId)) {
  const ids = Object.values(DIALOGUES)
    .flat()
    .map((d) => d.id)
    .sort();
  console.error(lessonId ? `no such lesson: ${lessonId}\n` : "usage: npm run prompt:live -- <lessonId>\n");
  console.error("lessons:\n  " + ids.join("\n  "));
  process.exit(1);
}

const { title, instructions } = buildLessonPrompt(lessonId);
console.log(`— ${lessonId}: ${title} —\n`);
console.log(instructions);
