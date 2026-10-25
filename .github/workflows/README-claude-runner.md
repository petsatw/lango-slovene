# Claude runner

`claude-runner.yml` runs Claude Code (`anthropics/claude-code-action@v1`) on a slice issue.

**Trigger.** Add the label `ready-for-claude` to an issue. The run takes only issues opened by the
repo owner, a member or a collaborator; for anyone else it removes the label and comments why.

**Labels.**

| Label | Meaning |
| :- | :- |
| `ready-for-claude` | Queued. The run removes it when it starts. |
| `claude-working` | A run is on the issue. |
| `pr-open` | Claude opened a PR to `mvp` from `claude/issue-N`, with `Closes #N` and the acceptance-check output. |
| `blocked` | The run ended without a PR. The `BLOCKED:` comment holds Claude's question or a link to the log. |

**Secret.** Repo secret `CLAUDE_CODE_OAUTH_TOKEN` (Pro/Max subscription; create it with
`claude setup-token`). `ANTHROPIC_API_KEY` works instead for API billing.

**Retry.** Answer the question on the issue, then add `ready-for-claude` again. Each label is a fresh
run; attempts are not counted. Delete a leftover `claude/issue-N` branch first, because the run
pushes that name without force.

**Scope.** Claude's commits are pushed with the workflow's `GITHUB_TOKEN`, which cannot change
`.github/workflows/*` and does not trigger other workflows on the PR. The `issues` event runs the
workflow file on the default branch.
