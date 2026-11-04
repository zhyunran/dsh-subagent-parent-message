/**
 * dsh-subagent-parent-message: a `subagent_parent_message` tool for delegated
 * subagents. It resolves the direct parent from the child's Session header and
 * delivers a durable peer-session message, so one-shot/workflow children are
 * not limited to writing files.
 *
 * @module dsh-subagent-parent-message
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { createParentMessageTool } from './tool.js'

export const name = 'subagent-parent-message'
export const inject = ['tools']

export function apply (ctx) {
  ctx.tools.register(createParentMessageTool({ defineTool, ctx }))
}
