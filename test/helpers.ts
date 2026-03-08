import type { z } from 'zod'

export function mockRouter(procedures: Record<string, unknown>) {
  return { _def: { procedures, _config: {} } }
}

export function mockProcedure(opts: {
  type: 'query' | 'mutation' | 'subscription'
  input?: z.ZodType
  output?: z.ZodType
  description?: string
}) {
  return {
    _def: {
      type: opts.type,
      inputs: opts.input ? [opts.input] : [],
      output: opts.output,
      meta: opts.description ? { description: opts.description } : undefined,
    },
  }
}

export function getResolver(
  router: { _def: { procedures: Record<string, unknown> } },
  path: string,
) {
  return (
    router._def.procedures[path] as {
      _def: { resolver: () => unknown }
    }
  )._def.resolver
}
