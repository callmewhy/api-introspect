import { describe, expect, it } from 'vitest'

import { createIntrospectionRouter } from '../src'
import { getResolver, mockRouter } from './helpers'

function mockT() {
  return {
    procedure: {
      query: (resolver: () => unknown) => ({ _type: 'query', resolver, _def: { resolver } }),
    },
    router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
  }
}

describe('skill endpoint', () => {
  it('returns plain JSON skill text by default', () => {
    const result = createIntrospectionRouter(mockT(), mockRouter({}))
    const skillText = getResolver(result, '_introspect.skill.md')() as string

    expect(skillText).toContain('plain JSON')
    expect(skillText).not.toContain('superjson')
  })

  it('detects superjson transformer from config', () => {
    const appRouter = {
      _def: {
        procedures: {},
        _config: {
          transformer: {
            serialize: (v: unknown) => ({ json: v, meta: {} }),
            deserialize: (v: unknown) => v,
          },
        },
      },
    }

    const result = createIntrospectionRouter(mockT(), appRouter)
    const skillText = getResolver(result, '_introspect.skill.md')() as string

    expect(skillText).toContain('superjson')
    expect(skillText).not.toContain('plain JSON')
  })

  it('allows manual serializer override', () => {
    const result = createIntrospectionRouter(mockT(), mockRouter({}), { serializer: 'superjson' })
    const skillText = getResolver(result, '_introspect.skill.md')() as string

    expect(skillText).toContain('superjson')
  })
})
