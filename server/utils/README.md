# server/utils — asset-store maintenance utilities

Occasional, operational tasks that act on the durable [asset store](../assets/store.ts) as a whole —
distinct from [`server/scripts/`](../scripts), which runs the per-scenario *generate* pipeline
(build / lint / audit / prompts). Utilities here are **content-safe by default**: dry-run unless
`--apply`, additive (never delete bytes), idempotent.

The recurring need is **re-keying**: image/audio keys are the literal prompt + voice/style inputs, so a
system-wide change to those inputs re-keys every affected asset. When the change is a *normalization*
(phrasing, ordering, an enforced stylistic token) that leaves the asset itself correct, regenerating is
waste — carry the existing bytes to the new key instead.

| Utility | What it does |
|---|---|
| `npm run rekey:assets` | Re-key assets across a prompt change that didn't alter the depiction (carries old bytes → new key). Reports assets that genuinely changed as `RE-RENDER`. First pass: the `{{TOKEN}}` reference-brace migration. [rekey-assets.ts](rekey-assets.ts) |

**Adding a utility:** dry-run by default with an explicit `--apply`; print what changed; don't delete
source bytes. A re-keying pass also needs a "same asset?" rule — see `rekey-assets.ts` for the shape.
