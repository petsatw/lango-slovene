# Reconcile inputs — the source a dialogue is built from

One `<scenarioId>/reconcile-input.json` per scenario. This is **source**; `server/dialogues/*.json` and the
`server/scenarios/*.json` manifest are **build artifacts** regenerated from it:

```
npm run reconcile:dialogue -- authoring/dialogues/<scenarioId>/reconcile-input.json
```

Change a line, a node, a level header or a catalog delta **here** and re-run. A hand-edit to a generated
file is lost on the next reconcile. The reconcile is idempotent, so re-running is always safe.

Everything a node carries lives here beside the line it describes — including its `learnables`, which the
per-line difficulty band is measured over (docs/dialogue-difficulty-model.md §3). Tags travelling with
their line is what stops a re-authored line from silently keeping stale ones.

The bundle's shape, and the authoring stages that produce it, are in docs/authoring-pipeline.md. A dialogue
under construction is drafted in `.scratch/dialogue-drafts/<scenarioId>/` and moves here on approval;
`a1-candidates.json` is a generated worklist, gitignored, folded into `server/catalog/a1-map.json` by hand.

`bakery` and `restaurant` were reconstructed from their generated files — verified by reconciling and
confirming every node came back byte-identical.
