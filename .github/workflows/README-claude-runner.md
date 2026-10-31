# Claude runner

`claude-runner.yml` runs Claude Code (`anthropics/claude-code-action@v1`) on a slice issue.

**Trigger.** Add the label `ready-for-claude` to an issue. The run takes only issues opened by the
repo owner, a member or a collaborator; for anyone else it removes the label and comments why.

**Branch.** Every run works on `claude/issue-N`. The first run creates it from `mvp`; later runs
continue from it. At the end the workflow commits everything Claude wrote except `PR.md` and
`BLOCKED.md`, pushes the branch and opens or updates one PR to `mvp` with `Closes #N`.

**Issue text.** Before Claude starts, the workflow writes the issue's title, labels, body and the comments by petsatw
to `.claude/issue.md` with `gh` and the job's `GITHUB_TOKEN`. Claude reads the issue from that file and
does not call `gh` for it. The file is gitignored and listed in `.git/info/exclude`, so no commit
includes it.

**Acceptance check.** One in-repo script, `npx tsx server/probes/<name>.ts`, that Claude writes as part
of the slice. It starts the server with its own env, uses `fetch`, and drives headless Chromium through
the repo's `playwright` (the workflow installs Chromium).

**Outcomes.** Claude ends each run by writing one file at the repo root:

| File | Outcome |
| :- | :- |
| `PR.md` | The check passed. It holds the summary and the check's command and output. The PR body is `PR.md`, the PR is marked ready, and the issue gets `pr-open`. |
| `BLOCKED.md`, first line `BLOCKED: <question>` | A decision, a secret or the spec is needed, or the check fails. The issue gets `blocked`. |
| `BLOCKED.md`, first line `HANDOFF: <reason>` | The slice is built and a check needed for acceptance cannot run in the runner. The issue gets `grok-handoff`. This is rare. |

On both `BLOCKED.md` outcomes the work so far is saved in a draft PR whose body is `BLOCKED.md`, and
the issue gets a comment with `BLOCKED.md` and the PR link. A run that ends without either file counts as
`BLOCKED:`.

**Run status.** A run that ends with `pr-open` is green. A `blocked` or `grok-handoff` run is red: after the
comment, the label and the run alert, its last step fails and names the outcome, the question and the
comment link.

**Labels.**

| Label | Meaning |
| :- | :- |
| `ready-for-claude` | Queued. The run removes it when it starts. |
| `claude-working` | A run is on the issue. |
| `pr-open` | The PR from `claude/issue-N` is ready for review, with the acceptance-check output. |
| `blocked` | Claude asked a question. The comment and the draft PR body hold it. |
| `grok-handoff` | The tech lead agent takes over: it fixes the check or the runner setup and re-runs, or runs the check itself and finishes the PR. The workflow creates the label on first use. |
| `reviewed` | On a PR: the tech lead agent reviewed it and it is ready for Chris to merge. The tech lead removes it when new commits land, and re-adds it after reviewing them. Chris merges only PRs that carry it. |

**Secret.** Repo secret `CLAUDE_CODE_OAUTH_TOKEN` (Pro/Max subscription; create it with
`claude setup-token`).

**Run alert.** When the run labels an issue `pr-open`, `blocked` or `grok-handoff`, it POSTs JSON to the
URL in repo secret `CLAUDE_BLOCK_WEBHOOK_URL`. Repo secret `CLAUDE_BLOCK_WEBHOOK_KEY` holds either the full
Authorization header line (`Authorization: Bearer abc123`) or only its value (`Bearer abc123`). The run sends
one `Authorization:` header from it. Chris adds both secrets. Body:

```json
{"issue": 24, "label": "pr-open" | "blocked" | "grok-handoff", "comment_url": "<issue comment html_url>",
 "question": "<first line of BLOCKED.md without its prefix>", "pr_url": "<PR url>", "run_url": "<run url>",
 "repo": "petsatw/lango-slovene"}
```

On `pr-open`, `comment_url` and `question` are `null` and `pr_url` is the ready PR. A missing secret or a
failed POST logs a line and leaves the run's outcome unchanged.

**Retry.** Answer the question on the issue, then add `ready-for-claude` again. The run continues from
`claude/issue-N` and the same PR. Each label is a fresh run; attempts are not counted.

**Scope.** The workflow pushes with its `GITHUB_TOKEN`, which cannot change `.github/workflows/*` and
does not trigger other workflows on the PR. The `issues` event runs the workflow file on the default
branch. Opening PRs needs **Settings → Actions → General → Allow GitHub Actions to create and approve
pull requests**.
