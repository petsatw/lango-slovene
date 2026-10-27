---
name: Slice
about: A thin end-to-end change that proves one gate ready criterion
title: "[G?] "
labels: slice
---

## Spec
<!-- Required. Link to the section(s) of docs/features/<feature>/spec.md on mvp that this slice builds, e.g. https://github.com/petsatw/lango-slovene/blob/mvp/docs/features/<feature>/spec.md#<anchor>. -->

## Goal
<!-- What changes for the learner or operator, in one or two sentences. Cite current behaviour with file:line. -->

## Gate & ready criterion proven
<!-- Gate label (G0 … G5) and the exact ready criterion from the gate list that this slice proves or moves. One criterion. -->

## Assumptions
<!-- What the implementer may take as given beyond the spec. -->

## Likely files
<!-- Files expected to change. -->

## Acceptance check
<!-- ONE cheap check that proves the criterion and runs inside the GitHub runner, with no network services: one in-repo script, `npx tsx server/probes/<name>.ts`, written with the slice (or an existing `npm run lint:*` / `test:*` script). The script starts the server with its own env, uses `fetch` for the API, `node:fs` for files and the repo's `playwright` for headless Chromium. List its steps and expected results. Its command and output go in the PR. -->

## Out of scope
<!-- What not to build in this slice. -->

## Blocked by
<!-- "None", or the issue or PR this waits for (e.g. the spec PR). Add the `blocked` label while it is pending. -->

## Follow-up
<!-- "None", or the linked issue for each post-merge or external step (deploy, secrets, accounts, real users, wording reviews). A follow-up issue says "Follows #N" and carries only the gate label. -->
