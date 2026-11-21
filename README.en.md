# dsh-subagent-parent-message

**English** · [<kbd>中文</kbd>](README.md)

**Bidirectional messaging tools for delegated DSH subagents.**

- `subagent_parent_message` — child → direct parent. It reads the parent from the child's own Session header and delivers a durable peer-session message, so one-shot/workflow children can report without writing a file first.
- `subagent_send_message` — a namespaced alias for the core adjacent-agent channel (parent ↔ direct continuable child). Use it when the parent's `send_message` is shadowed by a team-scoped tool with a different schema.

## Why

DSH core `send_message` only authorizes a **resident continuable child** to message its **direct parent**, and the parent often sees a *different* `send_message` (`{target, message}` from the experimental team tool) instead of the core one (`{agent_id, message}`). In practice:

- `subagent` / `subagent_fork` children can reach the parent, but the parent cannot reply when its `send_message` is team-scoped.
- `workflow` `agent()` / `pipeline()` children are **one-shot**; they have no continuation activation, so core `send_message` fails.
- Nested children often only know a root/grandparent id; core only accepts the **direct** parent/child (`subagent "<id>" is unavailable`).
- The old workaround was "write everything to disk so the parent can read it". It still works, but it is not a message.

These two namespaced tools cover both directions without adding another `send_message` collision.

## Tools

### `subagent_parent_message` — child → parent

```json
subagent_parent_message({ "message": "self-contained progress or result" })
subagent_parent_message({ "message": "...", "mode": "steer" })
```

- `followup` (default): queue a new parent turn; wakes an idle parent.
- `steer`: inject at the parent's next step while it is running.
- Resolves the direct parent from `session.header.parentSession`; no parent id required.
- Uses the live parent Agent or `sessionController.resolveAgent` cold resume, then `agent.followup`/`steer` + `ctx.sessions.flush`.
- Works for **one-shot/workflow children** because it does not depend on a continuation activation.
- Refuses self-delivery and never accepts an arbitrary target.

### `subagent_send_message` — parent ↔ direct continuable child

```json
subagent_send_message({ "agent_id": "session-…", "message": "keep going" })
```

- Thin namespaced adapter over `ctx.subagents.sendMessage()`.
- The subagent service still enforces **direct parent/child** adjacency and continuation residency.
- Useful when the parent's `send_message` is team-scoped (`target` schema), so the core channel is otherwise unreachable by name.
- It cannot wake a one-shot child; for a one-shot child's report use `subagent_parent_message` in the child.

## Delivery shape

```
[Subagent message from session-…]
This is a peer message from a delegated child, not the human user. Treat it as a task update.
---
<your message>
```

`subagent_parent_message` uses `agent.followup(message)` (or `agent.steer`) + `ctx.sessions.flush(agent.session)`; `subagent_send_message` delegates to `ctx.subagents.sendMessage()`.

## Limits

- `subagent_parent_message`: **direct parent only**, no attachments, no team mailbox; parent must be live or resumable.
- `subagent_send_message`: only direct parent/child with a resident continuable activation; it does not replace team `send_message` for teammates.
- Neither tool waits for the other side's answer; one call is one message.
- For file attachments use `dsh-cross-session`; for teammates use `agent_teams_send_message`.

## Install

Requires DSH 0.2.x.

```powershell
dsh plugin --profile <profile> add C:\path\to\dsh-subagent-parent-message-0.1.4.tgz
# or
dsh plugin --profile <profile> add https://codeload.github.com/zhyunran/dsh-subagent-parent-message/tar.gz/<40-char-commit>
```

Restart DSH once after install; both tools are global and visible to subagents.

## Status

- 8 unit tests (`node --test test/*.test.mjs`): live parent, cold resume, steer, missing parent, empty message, `subagent_send_message` delegation, missing service, and output-schema required placement.
- Real `dsh-tools` schema compile for both tools.
- Live verified: `subagent` child → parent via core `send_message`; `workflow` one-shot child → parent via `subagent_parent_message` (`followup` and `steer`).
- No runtime dependencies; peer-depends only on `@deepseek-ai/dsh-tools`.

## License

MIT. See [LICENSE](LICENSE).

---

Built for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
