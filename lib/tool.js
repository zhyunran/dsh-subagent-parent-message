/**
 * Tool factory kept separate from the plugin entry so unit tests can load it
 * with a stub `defineTool` and no DSH installation.
 *
 * @module dsh-subagent-parent-message/tool
 */

import { randomUUID } from 'node:crypto'

/** Build the exact user-role message DSH's Agent inbox expects. */
export function createUserMessage ({ content, source }) {
  return Object.freeze({
    id: randomUUID(),
    role: 'user',
    content,
    source,
  })
}

/** Read the direct parent id from a calling subagent, or throw a useful error. */
export function directParentId (agent) {
  if (agent === undefined || agent === null) {
    throw new Error('subagent_parent_message requires a calling Agent (exec.agent was undefined)')
  }
  const header = agent.session?.header
  const parentId = header?.parentSession
  if (typeof parentId !== 'string' || parentId.length === 0) {
    throw new Error('subagent_parent_message is only available to a delegated subagent with a direct parent session; this Agent has no parentSession')
  }
  if (parentId === agent.id) throw new Error('subagent_parent_message resolved the calling Agent as its own parent; refusing to self-deliver')
  return parentId
}

/** Resolve the live parent Agent, resuming a cold parent when the controller supports it. */
export async function resolveParent (ctx, parentId) {
  const live = ctx.get('agents')?.get?.(parentId)
  if (live !== undefined && live !== null) return live

  const controller = ctx.get('sessionController')
  if (controller === undefined || controller === null || typeof controller.resolveAgent !== 'function') {
    throw new Error(`parent session "${parentId}" is not currently live, and this DSH build has no Session controller to resume it`)
  }
  const found = await controller.resolveAgent(parentId)
  if (found !== undefined && found !== null && typeof found === 'object' && found.error !== undefined) {
    throw new Error(`parent session "${parentId}" could not be resumed: ${String(found.error)}`)
  }
  const agent = found !== undefined && found !== null && typeof found === 'object' && found.agent !== undefined
    ? found.agent
    : (typeof found?.followup === 'function' ? found : undefined)
  if (agent === undefined || agent === null) {
    throw new Error(`parent session "${parentId}" could not be resumed as a live Agent`)
  }
  return agent
}

function render (args, value) {
  return [{
    type: 'text',
    text: `parent message delivered to ${value.parentSessionId} (${value.mode})`,
  }]
}

/**
 * Build the `subagent_parent_message` tool definition.
 *
 * @param {{ defineTool: Function, ctx: any }} input
 */
export function createParentMessageTool ({ defineTool, ctx }) {
  return defineTool({
    name: 'subagent_parent_message',
    description: 'Send a progress report or result to your direct parent session. Use this from a delegated subagent; it resolves the parent automatically and works for one-shot/background children. The parent receives a durable peer message and is woken if idle. Do not use a team-target send_message for this.',
    parameters: {
      message: {
        type: 'string',
        required: true,
        description: 'Self-contained progress report or result for the parent.',
      },
      mode: {
        type: 'string',
        enum: ['followup', 'steer'],
        description: 'followup (default) queues a new parent turn; steer injects at the parent\'s next step while it is running.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          delivered: { type: 'boolean', required: true },
          parentSessionId: { type: 'string', required: true },
          mode: { type: 'string', required: true, enum: ['followup', 'steer'] },
          messageId: { type: 'string', required: true },
        },
      },
      render,
    },
    async execute (args, exec) {
      const sender = exec.agent
      const parentId = directParentId(sender)
      const text = typeof args.message === 'string' ? args.message : ''
      if (text.trim().length === 0) throw new Error('subagent_parent_message requires a non-empty message')
      const mode = args.mode === 'steer' ? 'steer' : 'followup'
      const parent = await resolveParent(ctx, parentId)
      const message = createUserMessage({
        content: [{
          type: 'text',
          text: `[Subagent message from ${sender.id}]\nThis is a peer message from a delegated child, not the human user. Treat it as a task update.\n---\n${text}`,
        }],
        source: {
          kind: 'agent-message',
          form: 'relay',
          senderSessionId: sender.id,
        },
      })
      if (mode === 'steer') parent.steer(message)
      else parent.followup(message)
      const sessions = ctx.get('sessions')
      if (sessions !== undefined && sessions !== null && typeof sessions.flush === 'function') {
        try {
          await sessions.flush(parent.session)
        } catch {
          /* the follow-up is already enqueued; a flush failure must not lose it */
        }
      }
      return {
        delivered: true,
        parentSessionId: parentId,
        mode,
        messageId: message.id,
      }
    },
  })
}

/**
 * A namespaced alias for the core adjacent-agent messaging channel.
 *
 * The parent session often sees a team-scoped `send_message` (`target` schema)
 * instead of the core one (`agent_id` schema), so it cannot reply to or steer
 * a continuable subagent. This tool exposes the same `ctx.subagents.sendMessage`
 * operation under a non-colliding name; the service still enforces direct
 * parent/child adjacency and continuation residency.
 */
export function createSubagentSendMessageTool ({ defineTool, ctx }) {
  return defineTool({
    name: 'subagent_send_message',
    description: 'Send a message to a direct continuable subagent child, or to your direct parent, through the core subagent channel. Use this when your scope\'s send_message is team-scoped/shadowed; it does not use team membership. Returns delivery confirmation, not the answer.',
    parameters: {
      agent_id: {
        type: 'string',
        required: true,
        description: 'A direct continuable child session id, or your direct parent when you are a resident continuable child.',
      },
      message: {
        type: 'string',
        required: true,
        description: 'Self-contained message to deliver.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          messageId: { type: 'string', required: true },
        },
      },
      render: (args) => [{
        type: 'text',
        text: `message delivered to agent ${args.agent_id}`,
      }],
    },
    async execute (args, exec) {
      const sender = exec.agent
      if (sender === undefined || sender === null) {
        throw new Error('subagent_send_message requires a calling Agent (exec.agent was undefined)')
      }
      const target = typeof args.agent_id === 'string' ? args.agent_id.trim() : ''
      if (target.length === 0) throw new Error('subagent_send_message requires a non-empty agent_id')
      const text = typeof args.message === 'string' ? args.message : ''
      if (text.trim().length === 0) throw new Error('subagent_send_message requires a non-empty message')
      const subagents = ctx.get('subagents')
      if (subagents === undefined || subagents === null || typeof subagents.sendMessage !== 'function') {
        throw new Error('subagent_send_message requires the dsh-subagent service (ctx.subagents.sendMessage is unavailable)')
      }
      const messageId = await subagents.sendMessage(
        sender,
        target,
        [{ type: 'text', text }],
        { signal: exec.signal },
      )
      if (typeof messageId !== 'string' || messageId.length === 0) {
        throw new Error('subagent_send_message received no delivery id from the subagent service')
      }
      return { messageId }
    },
  })
}
