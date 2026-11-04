# Changelog

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
