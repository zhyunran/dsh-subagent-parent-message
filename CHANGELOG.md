# Changelog

## 0.1.4 — 2026-11-15

### Fixed

- **Reverted the 0.1.3 schema regression.** `defineTool`'s `output.schema` uses the author value-schema dialect: `required: true` belongs on each **property**, and the compiler turns it into the enforced object-level array. Putting `required: [...]` at the value-schema root is rejected by `defineTool`.
- Restored the 0.1.2 shape: property-level `required: true` on `delivered`, `parentSessionId`, `mode`, `messageId`, and on `messageId` for `subagent_send_message`.
- The regression test now asserts property-level `required: true` and **no** root `required`.
- 0.1.3 is superseded; do not install it.

Parameters continue to use property-level `required: true`; both parameter and output author dialects agree here. The object-level-array rule applies to direct `ctx.tools.register()` raw schemas, not to `defineTool()`.

## 0.1.3 — 2026-11-15

> **Superseded by 0.1.4.** This release used the wrong output-schema dialect and can fail entry activation. Do not install it.

### Fixed

### Fixed

- `subagent_parent_message` and `subagent_send_message` now put `required` on the output schema **object**, as a string array. DSH 0.2.0-rc.2 rejects property-level `required: true` in `output.schema` and can fail the whole entry activation with `unsupported JSON schema`.
- Added a regression test that asserts object-level `required` arrays and no property-level `required` flags.

Parameters still use the author dialect's property-level `required: true`; only `output.schema` is raw JSON Schema.

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
