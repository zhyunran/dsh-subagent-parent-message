import assert from 'node:assert/strict'
import test from 'node:test'
import { createParentMessageTool, createSubagentSendMessageTool } from '../lib/tool.js'

function fakeCtx ({ parent, resolution } = {}) {
  const calls = []
  const flushes = []
  const agent = parent ?? {
    session: { id: 'session-parent' },
    followup (message) { calls.push({ mode: 'followup', message }) },
    steer (message) { calls.push({ mode: 'steer', message }) },
  }
  const ctx = {
    get (name) {
      if (name === 'agents') return { get: () => (resolution === undefined ? agent : undefined) }
      if (name === 'sessions') return { flush: async (session) => { flushes.push(session); return true } }
      if (name === 'sessionController') {
        return {
          resolveAgent: async () => {
            if (resolution === 'error') return { error: new Error('nope') }
            return { agent }
          },
        }
      }
      return undefined
    },
  }
  return { ctx, agent, calls, flushes }
}

const defineTool = (definition) => definition

function sender (parentId = 'session-parent') {
  return {
    id: 'session-child',
    session: { header: { id: 'session-child', parentSession: parentId } },
  }
}

function fakeSubagentCtx () {
  const calls = []
  const ctx = {
    get (name) {
      if (name !== 'subagents') return undefined
      return {
        async sendMessage (from, target, content, options) {
          calls.push({ from, target, content, options })
          return 'msg-1'
        },
      }
    },
  }
  return { ctx, calls }
}

test('delivers to the live direct parent and flushes', async () => {
  const { ctx, agent, calls, flushes } = fakeCtx()
  const tool = createParentMessageTool({ defineTool, ctx })
  const value = await tool.execute({ message: 'RESULT 391' }, { agent: sender() })
  assert.equal(tool.name, 'subagent_parent_message')
  assert.equal(value.delivered, true)
  assert.equal(value.parentSessionId, 'session-parent')
  assert.equal(value.mode, 'followup')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].mode, 'followup')
  assert.equal(calls[0].message.role, 'user')
  assert.equal(calls[0].message.source.kind, 'agent-message')
  assert.equal(calls[0].message.source.senderSessionId, 'session-child')
  assert.match(calls[0].message.content[0].text, /RESULT 391/)
  assert.equal(flushes.length, 1)
  assert.equal(flushes[0], agent.session)
})

test('supports steer mode', async () => {
  const { ctx, calls } = fakeCtx()
  const tool = createParentMessageTool({ defineTool, ctx })
  const value = await tool.execute({ message: 'steer me', mode: 'steer' }, { agent: sender() })
  assert.equal(value.mode, 'steer')
  assert.equal(calls[0].mode, 'steer')
})

test('resumes a cold parent through the Session controller', async () => {
  const { ctx, calls } = fakeCtx({ resolution: 'ok' })
  const tool = createParentMessageTool({ defineTool, ctx })
  const value = await tool.execute({ message: 'cold parent' }, { agent: sender() })
  assert.equal(value.parentSessionId, 'session-parent')
  assert.equal(calls.length, 1)
})

test('refuses an Agent without a direct parent', async () => {
  const { ctx } = fakeCtx()
  const tool = createParentMessageTool({ defineTool, ctx })
  await assert.rejects(
    tool.execute({ message: 'x' }, { agent: { id: 'session-root', session: { header: {} } } }),
    /no parentSession/,
  )
})

test('refuses an empty message', async () => {
  const { ctx } = fakeCtx()
  const tool = createParentMessageTool({ defineTool, ctx })
  await assert.rejects(tool.execute({ message: '   ' }, { agent: sender() }), /non-empty message/)
})

test('subagent_send_message delegates to ctx.subagents.sendMessage', async () => {
  const { ctx, calls } = fakeSubagentCtx()
  const tool = createSubagentSendMessageTool({ defineTool, ctx })
  const parent = sender()
  const value = await tool.execute({ agent_id: 'session-grandchild', message: 'keep going' }, { agent: parent })
  assert.equal(tool.name, 'subagent_send_message')
  assert.equal(value.messageId, 'msg-1')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].from, parent)
  assert.equal(calls[0].target, 'session-grandchild')
  assert.deepEqual(calls[0].content, [{ type: 'text', text: 'keep going' }])
  assert.ok(calls[0].options !== null && typeof calls[0].options === 'object')
})

test('subagent_send_message refuses empty target/message and missing service', async () => {
  const { ctx } = fakeSubagentCtx()
  const tool = createSubagentSendMessageTool({ defineTool, ctx })
  await assert.rejects(tool.execute({ agent_id: '', message: 'x' }, { agent: sender() }), /non-empty agent_id/)
  await assert.rejects(tool.execute({ agent_id: 'session-x', message: '  ' }, { agent: sender() }), /non-empty message/)
  const noService = createSubagentSendMessageTool({ defineTool, ctx: { get: () => undefined } })
  await assert.rejects(noService.execute({ agent_id: 'session-x', message: 'x' }, { agent: sender() }), /dsh-subagent service/)
})

test('both output schemas use defineTool property-level required', () => {
  const { ctx } = fakeCtx()
  const tools = [
    createParentMessageTool({ defineTool, ctx }),
    createSubagentSendMessageTool({ defineTool, ctx }),
  ]
  for (const tool of tools) {
    const schema = tool.output.schema
    assert.equal(schema.type, 'object')
    assert.equal(schema.required, undefined, `${tool.name} must not put required at the value-schema root`)
    for (const [name, property] of Object.entries(schema.properties)) {
      assert.equal(property.required, true, `${tool.name}.${name} must use property-level required: true`)
    }
  }
})
