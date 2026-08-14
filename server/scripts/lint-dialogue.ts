// Deterministic integrity gate for the dialogue→catalog seam (the reconcile step of the repeatable
// authoring procedure — docs/rehearsal-dialogues.md). The per-file loader (dialogues.ts) already
// validates that every `introduces` id resolves; this lint adds the CROSS-catalog checks the loader
// can't, so the catalog stays DRY as dialogues grow into the hundreds:
//
//   - dup canonical `sl`: no two learnables share a normalized surface (a word is minted ONCE and
//     referenced by id everywhere; two "kruh"s would split crediting and is an authoring mistake).
//   - referential integrity: every `introduces` id resolves in the catalog (restated cleanly here).
//   - coverage report: which dialogue introduces which ids, and which catalog learnables are introduced
//     by no dialogue (informational — the seed or a scenario may still own them).
//   - delivery-collision WARN: the audio key is (provider, voice, clean `sl`) — the delivery tag is not
//     in it, so two nodes with the same `sl` in the same voice profile are ONE clip (the first built
//     wins). If they carry DIFFERENT delivery, the later direction is never heard. Surfaced as a warning
//     (a shared line authored to sound two ways), not an error.
//
//   npm run lint:dialogue
//
// Exit code 0 = pass, 1 = at least one integrity error (so the authoring procedure can gate on it).

import { normSurface } from "./dialogue-lib";

async function main() {
  const errors: string[] = [];
  const warns: string[] = [];

  // Loading the modules runs their startup validation. A hard schema/id error throws here — surface it
  // as a lint failure rather than an uncaught stack.
  type LintNode = { speaker: "npc" | "client"; sl: string; deliverySL?: string };
  type LintDialogue = { id: string; introduces: string[]; voices: { npc: string; client: string }; nodes: Record<string, LintNode> };
  let LEARNABLES: Record<string, { id: string; kind: string; sl: string }>;
  let DIALOGUES: Record<string, LintDialogue[]>;
  try {
    ({ LEARNABLES } = await import("../learnables"));
    ({ DIALOGUES } = await import("../dialogues"));
  } catch (err: any) {
    console.error(`❌ failed to load catalog/dialogues: ${err?.message}`);
    process.exit(1);
  }

  // 1. Dup canonical sl across the whole learnable catalog.
  const bySurface = new Map<string, string[]>();
  for (const l of Object.values(LEARNABLES)) {
    const n = normSurface(l.sl);
    (bySurface.get(n) ?? bySurface.set(n, []).get(n)!).push(l.id);
  }
  for (const [surface, ids] of bySurface) {
    if (ids.length > 1) errors.push(`duplicate canonical sl "${surface}" shared by learnables: ${ids.join(", ")}`);
  }

  // 2. Referential integrity + 3. coverage.
  const dialogues = Object.values(DIALOGUES).flat();
  const introducedBy = new Map<string, string[]>();
  console.log("=== dialogue → introduced learnables ===");
  for (const d of dialogues) {
    for (const id of d.introduces) {
      if (!LEARNABLES[id]) errors.push(`dialogue "${d.id}" introduces unknown learnable "${id}"`);
      (introducedBy.get(id) ?? introducedBy.set(id, []).get(id)!).push(d.id);
    }
    console.log(`  ${d.id.padEnd(12)} introduces ${d.introduces.length}: ${d.introduces.join(", ") || "(none)"}`);
  }

  const orphans = Object.keys(LEARNABLES).filter((id) => !introducedBy.has(id));
  console.log(`\n=== coverage ===`);
  console.log(`  ${introducedBy.size}/${Object.keys(LEARNABLES).length} learnables are introduced by a dialogue.`);
  console.log(`  not introduced by any dialogue (may be owned by the seed/scenarios): ${orphans.join(", ") || "none"}`);

  // 4. Delivery-tag / audio-key collision (WARN). Group every node by (voice profile, clean sl) — its
  //    audio-clip identity. If a group's members were authored with more than one delivery (deliverySL ??
  //    sl), they collapse to a single clip and only the first built is heard. Flag it so the author makes
  //    the line textually distinct where a character needs its own delivery.
  const byClip = new Map<string, { where: string; say: string; voice: string; sl: string }[]>();
  for (const d of dialogues) {
    for (const [nid, n] of Object.entries(d.nodes ?? {})) {
      const voice = d.voices?.[n.speaker];
      if (!voice || !n.sl) continue;
      const key = `${voice} :: ${n.sl}`; // clip identity: same (voice, clean sl) => same audio key
      (byClip.get(key) ?? byClip.set(key, []).get(key)!).push({ where: `${d.id}:${nid}`, say: n.deliverySL ?? n.sl, voice, sl: n.sl });
    }
  }
  for (const members of byClip.values()) {
    const distinct = new Set(members.map((m) => m.say));
    if (members.length > 1 && distinct.size > 1) {
      const { voice, sl } = members[0]!;
      warns.push(`delivery collision: "${sl}" (voice ${voice}) is one shared clip but authored ${distinct.size} ways — only the first built is heard: ${members.map((m) => m.where).join(", ")}`);
    }
  }
  if (warns.length) {
    console.log(`\n— warnings (not failures) —`);
    for (const w of warns) console.log(`  ⚠️  ${w}`);
  }

  if (errors.length) {
    console.log(`\n=== ${errors.length} integrity error${errors.length === 1 ? "" : "s"} ===`);
    for (const e of errors) console.log(`  ❌ ${e}`);
    process.exit(1);
  }
  console.log(`\n✅ PASS — dialogue↔catalog integrity clean.`);
  process.exit(0);
}

main();
