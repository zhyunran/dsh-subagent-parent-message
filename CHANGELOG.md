# Changelog

## 0.1.2 — 2026-11-04

- Add `subagent_send_message`, a namespaced alias for the core `ctx.subagents.sendMessage()` channel, so a parent whose `send_message` is team-scoped can still message/steer a direct continuable child.
- Both tools remain non-colliding namespaced tools; the package name is unchanged.
- 7 unit tests; both tools compile with the real dsh-tools schema compiler.

## 0.1.1 — 2026-11-04

- Rename the model-facing tool `parent_message` → `subagent_parent_message` to keep a namespaced name and avoid colliding with a future core/team tool. The package name is unchanged.
- No behavior change: still resolves the direct parent from `session.header.parentSession` and delivers through the live Agent or `sessionController.resolveAgent` cold resume.
- 5 unit tests.

## 0.1.0 — 2026-11-04

- Add `parent_message` tool for delegated subagents.
- Resolve the direct parent from `session.header.parentSession`; deliver through the live Agent or `sessionController.resolveAgent` cold resume.
- Durable delivery via `agent.followup`/`agent.steer` + `ctx.sessions.flush`.
- `followup` and `steer` modes.
- 5 unit tests.
