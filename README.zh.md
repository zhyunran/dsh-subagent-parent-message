# dsh-subagent-parent-message

**给子 agent 一个可靠的 `subagent_parent_message` 工具。** 它从子会话自己的 header 里读出直接父会话，然后走持久化的 peer-session 消息通道送达；一次性/workflow 子代理不必先落盘才能汇报。

[English](README.md)

## 为什么需要

DSH 核心 `send_message` 只允许 **resident continuable child** 给**直接父**发消息。实际使用中：

- `subagent` / `subagent_fork` 子代理可以用，但父会话里的同名 `send_message` 可能被 Team 版（参数是 `target`）覆盖，模型很容易看错。
- `workflow` 的 `agent()` / `pipeline()` 子代理是**一次性**的，没有 continuation activation，给父发 `send_message` 会失败。
- 嵌套子代理通常只知道 root/祖父 id；核心只接受**直接父/直接子**，报错是 `subagent "<id>" is unavailable`。
- 以前的救急办法是“子 agent 把全部信息落盘，父会话读文件”。这仍然有效，但它不是消息。

这个插件加一个不歧义的工具，专门解决 child→parent 方向。

## 用法

子代理调用：

```json
subagent_parent_message({ "message": "自包含的进度或结果" })
```

可选：

```json
subagent_parent_message({ "message": "...", "mode": "steer" })
```

- `followup`（默认）：给父会话排一个新回合；父会话 idle 时会被唤醒。
- `steer`：父会话正在运行时，在它的下一个 step 注入。

父会话看到一条正常的 peer-session 消息（`source.kind = "agent-message"`，`senderSessionId = 子会话`），可以直接处理。子代理不需要知道父 id、不需要模型查找、不需要 continuation activation。

解析顺序：

1. `ctx.get('agents').get(parentSession)` —— 父已 live；
2. `ctx.sessionController.resolveAgent(parentSession)` —— 冷恢复；
3. 报错 —— 子代理仍可退回写文件。

## 投递形态

```
[Subagent message from session-…]
This is a peer message from a delegated child, not the human user. Treat it as a task update.
---
<你的消息>
```

走的是 DSH Schedule / cross-session 同样的持久路径：
`agent.followup(message)`（或 `agent.steer`）+ `ctx.sessions.flush(agent.session)`。

## 限制

- **只发直接父。** 不允许自投递，也不接受任意 target；子代理不能用它给祖父、兄弟或任何其他会话发消息。
- 父 Session 必须 live 或可冷恢复。已经结束且无法恢复的一次性父会话会明确报错；这种情况用 workflow 返回值或落盘。
- 不支持文件附件（要发文件用 cross-session 插件）；不实现 Team 邮箱语义（teammate 之间用 `agent_teams_send_message`）。
- 一次调用只投一条消息，不等待父会话回答。

## 安装

需要 DSH 0.2.x。

```powershell
dsh plugin --profile <profile> add C:\path\to\dsh-subagent-parent-message-0.1.0.tgz
# 或
dsh plugin --profile <profile> add https://codeload.github.com/<owner>/dsh-subagent-parent-message/tar.gz/<40位commit>
```

装完重启一次 DSH。工具是全局的，子代理也能看到。

## 状态

- 5 个单元测试全过（`node --test test/*.test.mjs`）：live 父、冷恢复父、steer、无父、空消息。
- 无运行时依赖；只 peer-depend `@deepseek-ai/dsh-tools`。
- 它是核心 `send_message` 的补充，不是替代：continuable 子代理的父子控制仍可用核心；一次性/嵌套子代理、以及父会话的 `send_message` 被 Team 版覆盖时，用 `subagent_parent_message`。

## 许可

MIT，见 [LICENSE](LICENSE)。

---

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 而写。
