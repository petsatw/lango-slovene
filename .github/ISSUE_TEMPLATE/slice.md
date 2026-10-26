---
name: Slice
about: A thin end-to-end change that proves one gate ready criterion
title: "[G?] "
labels: slice
---

## Goal
<!-- What changes for the learner or operator, in one or two sentences. Cite current behaviour with file:line. -->

## Gate & ready criterion proven
<!-- Gate label (G0 … G5) and the exact ready criterion from the gate list that this slice proves or moves. One criterion. -->

## Assumptions
<!-- What the implementer may take as given. Anything uncertain goes here, not into the code. -->

## Likely files
<!-- Files expected to change. -->

## Acceptance check
<!-- ONE cheap check that proves the criterion and runs inside the GitHub runner, with no network services: an existing npm script (`lint:*`, `test:*`) or simple local steps (start the server with `tsx`, `curl` the API, inspect files, restart, a headless Chromium check). Its command and output go in the PR. -->

## Out of scope
<!-- What not to build in this slice. -->

## Blocked by
<!-- "None", or "Decision NNNN" / "#issue". Add the `blocked` label while it is pending. -->

## Follow-up
<!-- "None", or the linked issue for each post-merge or external step (deploy, secrets, accounts, real users, wording reviews). A follow-up issue says "Follows #N" and carries only the gate label. -->
