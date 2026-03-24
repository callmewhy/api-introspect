import type { AnyTRPCRouter } from '@trpc/server'
import type { z } from 'zod'

export function mockRouter(procedures: Record<string, unknown>) {
  return { _def: { procedures, _config: {} } } as unknown as AnyTRPCRouter & { _def: { procedures: Record<string, unknown> } }
}

export function mockProcedure(opts: {
  type: 'query' | 'mutation' | 'subscription'
  input?: z.ZodType
  output?: z.ZodType
  description?: string
  meta?: Record<string, unknown>
}) {
  const meta = opts.description || opts.meta
    ? { ...(opts.description && { description: opts.description }), ...opts.meta }
    : undefined

  return {
    _def: {
      type: opts.type,
      inputs: opts.input ? [opts.input] : [],
      output: opts.output,
      meta,
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
