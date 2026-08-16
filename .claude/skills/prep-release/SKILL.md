---
name: prep-release
description: Prepare to publish just-committed work to the release branch(es) that Railway deploys. `release/*` and `main` are branch-protected (PR-only), so this emits TWO copy-paste blocks for the operator — first a PUSH block for the source branch, then a PR block that opens a pull request into each release/* branch. Never touches main (legacy). Use right after the commit skill when the user wants to ship the current work to the release branch. Triggers on "prep release", "push to release", "sync release", "publish release", "update the release branch", or /prep-release.
---

# prep-release

You are invoked (typically right after the `commit` skill) to do the prep work for publishing the just-committed work to the **release branch(es)** this repo deploys from, then emit **two copy-paste blocks** the operator runs: a **push block** (source branch) and a **PR block** (one pull request per `release/*`). You do the analysis and safety checks; **the operator runs the push** — never push from inside this skill.

**Recent rule change — `release/*` and `main` are branch-protected (PR-only).** As of the ruleset change on this repo, changes to `release/*` and `main` **must go through a pull request** — a direct push to them is rejected by GitHub regardless of token scope. Everything else (the source branch `mvp`, topic branches) still takes a standard push. So the old flow (`git branch -f release/mvp-alpha mvp` + `git push origin … release/mvp-alpha`) is **dead**; the release branch is now advanced by **merging a PR**, and merging the PR is what triggers the Railway deploy.

This is the release-branch analog of a publish-to-main flow, with one hard inversion for this repo: **`main` is legacy and must never be advanced** (docs/MVP.md "Legacy stays on `main`"). The MVP ships on `release/*`; `main` is left exactly where it is.

## Surfaces that must stay in sync

1. **The source branch** — the branch holding the just-committed work (normally `mvp`), pushed to `origin` with a **standard push** (it is not protected). Since the PR's head is this branch, pushing it is also what updates any open PR.
2. **Every release branch** — `release/*` (today just `release/mvp-alpha`, the branch Railway deploys). Each is advanced by **opening and merging a PR** from the source branch into it — never a direct push. Discover them with `git for-each-ref --format='%(refname:short)' 'refs/heads/release/*'` so a future `release/*` is handled automatically — do not hardcode.

**Never in scope: `main`.** No block may contain a `main` push line or a PR that targets `main`. If the skill is invoked while `main` is checked out, STOP and report — legacy is not published from here.

## Auth note — pushing vs. opening a PR

Two different credentials, do not conflate them:

- **Pushing** the source branch uses the fine-grained PAT already stored in the macOS keychain (`credential.helper=osxkeychain`). No login step. The source branch is unprotected, so the push succeeds.
- **Opening the PR** uses `gh`, which has its **own** auth store and is **not** logged in here. It can reuse the same keychain PAT via `GH_TOKEN` — but only if that token grants **Pull requests: write**. If it lacks that scope, `gh` returns 403 and the operator opens the PR from the browser compare URL instead.
- **The agent may run the PR block itself** (it is a GitHub API call, not a push — only pushes are hard-blocked for the agent in this environment). The **push block is always the operator's.**

## Procedure

Run all git commands from the repo root: `/Users/audocie/Apps/lango-slovenian`.

**Shell safety (this session and the operator's shell are zsh):** quote every glob — `'refs/heads/release/*'` — because zsh aborts an unquoted unmatched glob with `no matches found`. Iterate command output with `… | while IFS= read -r x; do …; done`, never `for x in $var`: zsh does not word-split an unquoted variable on newlines, so the loop body would receive all branches as one mangled token.

**ABSOLUTE RULE — ZERO inline comments inside any emitted ```bash block.** The operator pastes these into an interactive zsh that does **not** treat `#` as a comment (the `interactive_comments` option is off by default). Every `# …` line is therefore parsed as a command — which not only spams `zsh: command not found: #`, but, fatally, any `->`, `>`, or `>>` inside the comment text executes as a **redirection** that silently writes stray files into the repo root, and an apostrophe in the comment (e.g. "isn't") opens an unterminated quote that hangs the paste at `quote>`. Therefore: emit **no `#` lines, no trailing `# …`, nothing but runnable commands** inside every code block. Put **all** rationale in prose *above* the block, never inside it. No exceptions.

1. **Gather state** (read-only):
   - `git rev-parse --abbrev-ref HEAD` and `git rev-parse --short HEAD`.
   - `git remote` and `git remote get-url origin` — the remote and its `owner/repo` slug (this repo is `petsatw/lango-slovene`; derive, don't assume).
   - `git for-each-ref --format='%(refname:short)' 'refs/heads/release/*'` — the release branches (quote the glob).
   - Whether the source branch is ahead of `origin/<source>` (`git rev-list --count origin/<source>..<source>`), so you know a push is actually needed.

2. **Determine the target commit `T`** — the commit to publish:
   - The **source branch** is the branch holding the just-committed work (the current branch, normally `mvp`). `T = HEAD`.
   - If the current branch is itself a `release/*` branch, STOP — you cannot open a PR from a protected branch into itself, and it cannot be pushed directly. Report that the work must be committed on `mvp` (or a topic branch) first.

3. **Safety checks — every one must pass, or STOP and report instead of emitting:**
   - **Not on `main`:** if the current branch is `main`, STOP — legacy is not published here.
   - **Working tree clean:** `git status --porcelain` is empty. (Uncommitted changes mean the commit isn't done — prep-release runs *after* `commit`.)
   - **`origin` exists** (and note every remote found).
   - **Per release branch, classify the PR (report, never a hard stop):** for each `release/*`, compute `git rev-list --count "$r".."$T"` (commits `T` adds) and `git rev-list --count "$T".."$r"` (commits the release branch has that `T` lacks).
     - adds == 0 → the release branch already contains `T`; **no PR needed** — say so and omit it from the PR block.
     - adds > 0 → a PR is warranted; it will carry those commits. Divergence (the release branch having its own commits, e.g. a `CODEOWNERS` merge) is **fine** — the PR merge reconciles both sides with no force and no data loss. Unlike the old `branch -f` flow, this is not a stop condition.

4. **Emit block 1 — the push** (source branch only), built from the discovered remote and source branch, every literal resolved. The operator runs it. If step 1 showed the source branch already in sync with its remote, say so and note this block is a no-op they can skip.

   For the current common case — committed on `mvp`, remote `origin`:

   ```bash
   cd /Users/audocie/Apps/lango-slovenian
   git push origin mvp
   ```

5. **Emit block 2 — the PR(s)**, one `gh pr create` per warranted `release/*`, targeting that branch with the source branch as head. The token line reuses the keychain PAT so `gh` needs no separate login; if the token lacks Pull requests: write, fall back to the browser compare URL stated below the block. One `gh pr create` line per warranted release branch.

   For the current common case — source `mvp`, release `release/mvp-alpha`, repo `petsatw/lango-slovene`:

   ```bash
   cd /Users/audocie/Apps/lango-slovenian
   TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | awk -F= '/^password=/{print $2}')
   GH_TOKEN="$TOKEN" gh pr create --repo petsatw/lango-slovene --base release/mvp-alpha --head mvp --fill
   ```

   Browser fallback (state the URL in prose, per release branch): `https://github.com/petsatw/lango-slovene/compare/release/mvp-alpha...mvp`.

   **Merging is a separate, deliberate step** — merging the PR is what deploys. State it in prose (never as a block the paste auto-runs): merge on the web after review, or `GH_TOKEN="$TOKEN" gh pr merge --repo petsatw/lango-slovene <number> --merge`. If an open PR already has the source branch as its head, note that pushing block 1 updates that PR in place — no new PR is needed, only block 1 then a merge.

6. **Railway redeploy advisory — always state it. The deploy fires on PR MERGE, not on the source-branch push.** Diff what will ship when the PR merges: `git diff --name-only origin/release/mvp-alpha <T>`.
   - If the diff is docs-only (`docs/**`, `*.md`), say so: a redeploy still fires on merge but has **no runtime effect** — the operator may choose not to merge if they don't want the redeploy.
   - If it touches audio, the asset store, or voice/model config (`assets/audio/**`, `server/adapters/**`, anything changing the serve-time env contract), point to **docs/DEPLOY.md** — the deploy only serves new audio if the branch carries the clips (gitignored `assets/` must be force-committed) and Railway's voice-id env matches the build. Remind the operator to re-run DEPLOY.md's recipe B (live probe) after the merge/redeploy.

## What prep-release does NOT do

- **It does not push.** The operator runs the push block.
- **It does not touch `main`.** Legacy stays put; no `main` push line and no PR targeting `main` is ever emitted.
- **It does not force-update or discard.** Release branches move only by PR merge; a diverged release branch is reconciled by the merge, never overwritten.
- **It does not merge the PR for you.** Merging is a deliberate, deploy-triggering step the operator (or agent, on request) takes after review.
- **It does not configure Railway env or run the DEPLOY.md verification** — it only advises when the diff warrants it.

## Notes

- Repo-aware via discovery (`git remote`, `git remote get-url origin`, `release/*`), so a new remote or a future `release/*` branch needs no edit here.
- The push is the operator's; the PR block the agent may run itself (API call, not a push). Both are handed over as paste-and-run blocks with zero substitution.
- Because the PR's head is the source branch, re-running prep-release after another commit usually just re-emits block 1 (push) — the existing PR picks up the new commit automatically; only a merge is then needed.
