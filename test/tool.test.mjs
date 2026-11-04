import assert from 'node:assert/strict'
import test from 'node:test'
import { createParentMessageTool } from '../lib/tool.js'

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
