# dsh-subagent-parent-message

**A reliable `subagent_parent_message` tool for delegated subagents.** It reads the direct parent from the child's own Session header and delivers a durable peer-session message, so one-shot/workflow children can report progress without writing a file first.

[中文说明](README.zh.md)

## Why

DSH core `send_message` only authorizes a **resident continuable child** to message its **direct parent**. In practice:

- `subagent` / `subagent_fork` children can use it, but the tool is easy to misread when the same name is shadowed by a team-scoped `send_message` (`target` schema) in the parent session.
- `workflow` `agent()` / `pipeline()` children are **one-shot**; they have no continuation activation, so their `send_message` to a parent fails.
- Nested children often only know a root/grandparent id; core only accepts the **direct** parent/child, and the error is `subagent "<id>" is unavailable`.
- The old workaround was "write everything to disk so the parent can read it". That still works, but it is not a message.

This plugin adds one unambiguous tool that solves the child→parent direction for all of those cases.

## Usage

A delegated child calls:

```json
subagent_parent_message({ "message": "self-contained progress or result" })
```

Optional:

```json
subagent_parent_message({ "message": "...", "mode": "steer" })
```

- `followup` (default): queue a new parent turn; wakes an idle parent.
- `steer`: inject at the parent's next step while it is running.

The parent sees a normal peer-session message (`source.kind = "agent-message"`, `senderSessionId = child`) and can act on it. No parent id, model lookup, or continuation activation is required from the child.

The tool resolves the parent in this order:

1. `ctx.get('agents').get(parentSession)` — already live;
2. `ctx.sessionController.resolveAgent(parentSession)` — cold resume;
3. error — the child can still fall back to writing a file.

## Delivery shape

```
[Subagent message from session-…]
This is a peer message from a delegated child, not the human user. Treat it as a task update.
---
<your message>
```

It uses the same durable path as DSH's Schedule/cross-session delivery:
`agent.followup(message)` (or `agent.steer`) + `ctx.sessions.flush(agent.session)`.

## Limits

- **Direct parent only.** It refuses to self-deliver and never accepts an arbitrary target; a child cannot use it to message a grandparent, sibling, or any other session.
- The parent Session must be live or resumable. A finished one-shot parent that cannot be resumed will fail with a clear error; use workflow return values or files in that case.
- No file attachments (use the cross-session plugin if you need files); no team mailbox semantics (use `agent_teams_send_message` for teams).
- One tool call is one message; it does not wait for the parent to answer.

## Install

Requires DSH 0.2.x.

```powershell
dsh plugin --profile <profile> add C:\path\to\dsh-subagent-parent-message-0.1.0.tgz
# or
dsh plugin --profile <profile> add https://codeload.github.com/<owner>/dsh-subagent-parent-message/tar.gz/<40-char-commit>
```

Restart DSH once after install. The tool is global, so it is also visible to subagents.

## Status

- 5 unit tests pass (`node --test test/*.test.mjs`): live parent, cold parent resume, steer mode, missing parent, empty message.
- No runtime dependencies; peer-depends only on `@deepseek-ai/dsh-tools`.
- Intended to complement, not replace, core `send_message`: use core for continuous child/parent control, `subagent_parent_message` for one-shot/nested children and for child→parent reporting when the parent's `send_message` name is team-scoped.

## License

MIT. See [LICENSE](LICENSE).

---

Built for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
