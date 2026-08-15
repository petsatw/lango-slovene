---
name: prep-release
description: Prepare to publish just-committed work to the release branch(es) that Railway deploys — fast-forward every release/* branch to the work and emit ONE copy-paste push block for the operator to run. Never touches main (legacy). Use right after the commit skill when the user wants to ship the current work to the release branch. Triggers on "prep release", "push to release", "sync release", "publish release", "update the release branch", or /prep-release.
---

# prep-release

You are invoked (typically right after the `commit` skill) to do the prep work for publishing the just-committed work to the **release branch(es)** this repo deploys from, then emit **one copy-paste block** the operator runs. You do the analysis and safety checks; **the operator runs the pushes** — never push from inside this skill. Only the operator can push here.

This is the release-branch analog of a publish-to-main flow, with one hard inversion for this repo: **`main` is legacy and must never be advanced** (docs/MVP.md "Legacy stays on `main`"). The MVP ships on `release/*`; `main` is left exactly where it is.

## Surfaces that must stay in sync

1. **The source branch** — the branch holding the just-committed work (normally `mvp`), pushed to `origin` so the remote tracks it.
2. **Every release branch** — `release/*` (today just `release/mvp-alpha`, the branch Railway deploys). Each must **fast-forward** to the work so a redeploy ships the new code. Discover them with `git for-each-ref --format='%(refname:short)' 'refs/heads/release/*'` so a future `release/*` is handled automatically — do not hardcode.

**Never in scope: `main`.** The emitted block must contain no `main` line. If the skill is invoked while `main` is checked out, STOP and report — legacy is not published from here.

## Procedure

Run all git commands from the repo root: `/Users/audocie/Apps/lango-slovenian`.

**Shell safety (this session and the operator's shell are zsh):** quote every glob — `'refs/heads/release/*'` — because zsh aborts an unquoted unmatched glob with `no matches found`. Iterate command output with `… | while IFS= read -r x; do …; done`, never `for x in $var`: zsh does not word-split an unquoted variable on newlines, so the loop body would receive all branches as one mangled token.

**ABSOLUTE RULE — ZERO inline comments inside any emitted ```bash block.** The operator pastes these into an interactive zsh that does **not** treat `#` as a comment (the `interactive_comments` option is off by default). Every `# …` line is therefore parsed as a command — which not only spams `zsh: command not found: #`, but, fatally, any `->`, `>`, or `>>` inside the comment text executes as a **redirection** that silently writes stray files into the repo root, and an apostrophe in the comment (e.g. "isn't") opens an unterminated quote that hangs the paste at `quote>`. Therefore: emit **no `#` lines, no trailing `# …`, nothing but runnable commands** inside every code block. Put **all** rationale in prose *above* the block, never inside it. No exceptions.

1. **Gather state** (read-only):
   - `git rev-parse --abbrev-ref HEAD` and `git rev-parse --short HEAD`.
   - `git remote` — the set of remotes to push to (this repo has `origin`; discover, don't assume).
   - `git for-each-ref --format='%(refname:short)' 'refs/heads/release/*'` — the release branches (quote the glob).
   - Each release branch sha.

2. **Determine the target commit `T`** — the commit to publish:
   - The **source branch** is the branch holding the just-committed work (the current branch, normally `mvp`). `T = HEAD`.
   - If the current branch is itself a `release/*` branch, `T = HEAD` and that branch needs no fast-forward — just the push.

3. **Safety checks — every one must pass, or STOP and report instead of emitting:**
   - **Not on `main`:** if the current branch is `main`, STOP — legacy is not published here.
   - **Working tree clean:** `git status --porcelain` is empty. (Uncommitted changes mean the commit isn't done — prep-release runs *after* `commit`.)
   - **Every `release/*` is an ancestor of `T`:** iterate zsh-safely — `git for-each-ref --format='%(refname:short)' 'refs/heads/release/*' | while IFS= read -r r; do git merge-base --is-ancestor "$r" "$T" && echo "ff-ok $r" || echo "DIVERGED $r"; done`. If any release branch has commits not in `T`, a `git branch -f` would silently discard them — STOP, name the branch and the orphaned commits, and do not emit a force-update.
   - **`origin` exists** (and note every remote found).

4. **Emit the copy-paste block** — built from the *discovered* remotes and release branches, every literal resolved (real repo root, real remote names, real release branches). Do not run it.

   Per-line rationale (state in prose, **never** as inline comments in the block): each `release/*` branch that is not checked out is force-updated to the work; then the source branch and every release branch are pushed to each remote. No checkout or re-park is needed — this is a single working tree, and the source branch stays checked out.

   For the current common case — committed on `mvp`, one release branch `release/mvp-alpha`, one remote `origin`:

   ```bash
   cd /Users/audocie/Apps/lango-slovenian
   git branch -f release/mvp-alpha mvp
   git push origin mvp release/mvp-alpha
   ```

   Substitute the *actual* source branch, remote names, and `release/*` branches from step 1. Multiple release branches → one `git branch -f <release> <source>` line each, all listed in the push. Multiple remotes → one push line per remote.

   **Edge — a release branch is checked out.** If `git worktree list` shows a `release/*` branch checked out (rare here — one working tree), `git branch -f` is refused for it. Fast-forward it in place instead — `git -C <path> merge --ff-only <source>` — and still push from this repo. State this only if it applies.

5. **Railway redeploy advisory — always state it.** Pushing a `release/*` branch triggers a Railway git deploy of that branch. Diff what's shipping: `git diff --name-only origin/release/mvp-alpha <T>`.
   - If the diff is docs-only (`docs/**`, `*.md`), say so: a redeploy still fires but has **no runtime effect** — the operator may skip pushing the release branch if they don't want the redeploy, pushing only the source branch.
   - If it touches audio, the asset store, or voice/model config (`assets/audio/**`, `server/adapters/**`, anything changing the serve-time env contract), point to **docs/DEPLOY.md** — the deploy only serves new audio if the branch carries the clips (gitignored `assets/` must be force-committed) and Railway's voice-id env matches the build. Remind the operator to re-run DEPLOY.md's recipe B (live probe) after the redeploy.

## What prep-release does NOT do

- **It does not push.** The operator runs the emitted block.
- **It does not touch `main`.** Legacy stays put; no `main` line is ever emitted.
- **It does not merge** diverged branches — if a release branch has commits not in the work, it STOPs.
- **It does not configure Railway env or run the DEPLOY.md verification** — it only advises when the diff warrants it.

## Notes

- Repo-aware via discovery (`git remote`, `release/*`), so a new remote or a future `release/*` branch needs no edit here.
- The push is the operator's; hand them a block they can paste and run with zero substitution.
