# dsh-subagent-parent-message

[English](README.md) · **中文**

**给被委派子 agent 的双向消息工具。**

- `subagent_parent_message` —— 子 → 直接父。从子会话自己的 header 读直接父，走持久 peer-session 消息通道；一次性/workflow 子代理不必先落盘才能汇报。
- `subagent_send_message` —— 核心 adjacent-agent 通道的带命名空间别名（父 ↔ 直接 continuable 子）。当父会话的 `send_message` 被 Team 版（`target` schema）覆盖时使用。

## 为什么需要

DSH 核心 `send_message` 只允许 **resident continuable child** 给**直接父**发消息；而父会话经常看到的是 **Team 版** `send_message`（`{target, message}`），不是核心版（`{agent_id, message}`）。实际使用中：

- `subagent` / `subagent_fork` 子代理能发父，但父的 `send_message` 被 Team 版覆盖后无法回消息；
- `workflow` 的 `agent()` / `pipeline()` 子代理是 **one-shot**，没有 continuation activation，核心 `send_message` 会失败；
- 嵌套子代理通常只知道 root/祖父 id，核心只接受**直接父/直接子**，报 `subagent "<id>" is unavailable`；
- 以前的救急办法是“全部落盘让父读”。仍然有效，但它不是消息。

这两个带命名空间的工具补上双向通道，不新增 `send_message` 撞名。

## 工具

### `subagent_parent_message` —— 子 → 父

```json
subagent_parent_message({ "message": "自包含的进度或结果" })
subagent_parent_message({ "message": "...", "mode": "steer" })
```

- `followup`（默认）：给父排一个新回合；父 idle 时唤醒。
- `steer`：父正在运行时在下一个 step 注入。
- 从 `session.header.parentSession` 自动取直接父，不需要父 id。
- 父 live 则直接用；否则 `sessionController.resolveAgent` 冷恢复；然后 `agent.followup`/`steer` + `ctx.sessions.flush`。
- **一次性/workflow 子代理也能用**，因为不依赖 continuation activation。
- 拒绝自投递，不接受任意 target。

### `subagent_send_message` —— 父 ↔ 直接 continuable 子

```json
subagent_send_message({ "agent_id": "session-…", "message": "继续" })
```

- 对 `ctx.subagents.sendMessage()` 的带命名空间薄封装。
- 服务端仍强制**直接父/直接子**关系与 continuation residency。
- 父会话的 `send_message` 被 Team 版覆盖时，用它按 `agent_id` 联系直接子。
- 不能唤醒 one-shot 子代理；one-shot 子代理的汇报用 `subagent_parent_message`。

## 投递形态

```
[Subagent message from session-…]
This is a peer message from a delegated child, not the human user. Treat it as a task update.
---
<你的消息>
```

`subagent_parent_message` 走 `agent.followup`（或 `steer`）+ `ctx.sessions.flush`；`subagent_send_message` 委托 `ctx.subagents.sendMessage()`。

## 限制

- `subagent_parent_message`：只发直接父；不支持附件/Team 邮箱；父必须 live 或可冷恢复。
- `subagent_send_message`：只对直接父/直接 continuable 子有效；不替代 teammate 的 Team 消息。
- 都不等待对方回答；一次调用一条消息。
- 要发文件用 `dsh-cross-session`；teammate 之间用 `agent_teams_send_message`。

## 安装

需要 DSH 0.2.x。

```powershell
dsh plugin --profile <profile> add C:\path\to\dsh-subagent-parent-message-0.1.4.tgz
# 或
dsh plugin --profile <profile> add https://codeload.github.com/zhyunran/dsh-subagent-parent-message/tar.gz/<40位commit>
```

装完重启一次 DSH；两个工具都是全局的，子代理也能看到。

## 状态

- 8 个单元测试：live 父、冷恢复、steer、无父、空消息、`subagent_send_message` 委托、服务缺失、输出 schema 的 required 位置。
- 两个工具都通过真实 `dsh-tools` schema 编译器。
- 真机验证：`subagent` 子 → 父核心通道；`workflow` one-shot 子 → 父 `subagent_parent_message`（followup 与 steer）。
- 无运行时依赖；只 peer-depend `@deepseek-ai/dsh-tools`。

## 许可

MIT，见 [LICENSE](LICENSE)。

---

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 而写。
