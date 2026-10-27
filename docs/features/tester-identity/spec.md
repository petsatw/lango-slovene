# Tester identity

Each tester has their own code, and the code is the learner. A tester's progress and records follow
the code across browsers and devices, Safari and the iOS home-screen app included.

## 1. Invite link

- The invite link carries the code as `?c=<code>`. The client stores it in `localStorage.testerCode`,
  removes `?c=` from the address bar, and sends it as the `x-tester-code` header on every API call
  that reads or writes learner data, including the live session create call. Media loads
  (`/api/speak`, `/api/image`) are shared across learners and carry no learner headers.
- A code in a later link replaces the stored one.

## 2. Allowlist

- `TESTER_CODES` is a comma-separated env var that lists the valid codes. Code values live only in the
  env. Who holds which code is recorded outside the repo.
- Every tester gets their own code. Two people on one code are one learner.
- The repo and its tests use placeholders such as `TEST-01`.

## 3. learnerId

The server resolves every request to one learner:

| `x-tester-code` | learnerId | `testerCode` stored |
|---|---|---|
| on the allowlist | derived from the code: `t-` + the first 16 hex characters of `sha256(code)` | the code |
| unknown or absent | the per-browser `x-learner-id` | `null` |

- The derived id ignores `x-learner-id`, so two browsers with the same code read and write one learner
  model and one learning history (`/api/learner` returns the same model in both).
- An `x-learner-id` with the `t-` prefix is treated as absent, so a derived id is reachable only through
  its code.
- `learner.resolveId(code, learnerId)` and `learner.testerCodeFrom(code)` in `server/assets/learner.ts`
  resolve the id and return the code or `null`. Every writer resolves through these two functions;
  `server/server.ts` wraps them as `learnerOf(req)` and `testerCodeOf(req)`.

## 4. Records carry the learner

Every server record carries `learnerId` and `testerCode`:
- turn-log rows (`server/assets/turnlog.ts`), which also carry the `sessionId` or `runId` they belong to
- session records (`server/assets/sessions.ts`)
- live session logs (`server/live/log.ts`)
- events ([events spec](../events/spec.md#2-row))
- improvement copies ([improvement consent](../consent-privacy/spec.md#2-improvement-consent))

These fields are how the learning history, Delete my data and an emailed request find a learner's data.

## 5. Live access

- An allowlisted tester code opens the live tutor with no prompt.
- `LIVE_ACCESS_CODE` is the operator override. It opens live for a request without an allowlisted code.
- A request with neither gets `403` with a message that names the invite link.

## 6. Code in Settings

- Settings shows the stored code ([Settings](../consent-privacy/spec.md#3-settings)), or the learnerId
  when the browser has no allowlisted code. `GET /api/me` returns `{ testerCode }`: the allowlisted code,
  or `null`.
- Opening the invite link in another browser reconnects that browser to the same progress and history.
