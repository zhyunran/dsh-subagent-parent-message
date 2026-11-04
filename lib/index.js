/**
 * dsh-subagent-parent-message: bidirectional tools for delegated subagents.
 *
 * - `subagent_parent_message`: child -> direct parent through the durable
 *   peer-session path.
 * - `subagent_send_message`: namespaced core adjacent-agent messaging
 *   (parent <-> direct continuable child) for profiles where `send_message`
 *   is shadowed by a team-scoped tool.
 *
 * @module dsh-subagent-parent-message
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { createParentMessageTool, createSubagentSendMessageTool } from './tool.js'

export const name = 'subagent-parent-message'
export const inject = ['tools']

export function apply (ctx) {
  ctx.tools.register(createParentMessageTool({ defineTool, ctx }))
  ctx.tools.register(createSubagentSendMessageTool({ defineTool, ctx }))
}
