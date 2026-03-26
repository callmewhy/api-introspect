import type { IntrospectionResult } from '@api-introspect/core'
import type { AnyTRPCRouter, TRPCRootObject } from '@trpc/server'

import { introspectRouter } from './introspect'
import { detectSerializer } from './serializer'
import type { IntrospectionRouterOptions } from './types'

/* eslint-disable ts/no-explicit-any */
type AnyTRPCRoot = TRPCRootObject<any, any, any, any>
/* eslint-enable ts/no-explicit-any */

const defaultDescription = 'tRPC API. Use "npx api-introspect <base-url> [procedure] [input]" to discover and call procedures.'

function generateDescription(description: unknown): string {
  return typeof description === 'string' && description.trim()
    ? description.trim()
    : defaultDescription
}

/**
 * Creates a tRPC router with an introspection query procedure.
 *
 * The introspection payload is precomputed when this helper is called,
 * so the query stays cheap at request time.
 *
 * @example
 * ```ts
 * const appRouter = t.router({ ... })
 * const rootRouter = t.mergeRouters(
 *   appRouter,
 *   createIntrospectionRouter(t, appRouter),
 * )
 * ```
 */
export function createIntrospectionRouter(
  t: AnyTRPCRoot,
  appRouter: AnyTRPCRouter,
  options: IntrospectionRouterOptions = {},
) {
  const {
    enabled = true,
    path = '_introspect',
    meta,
    serializer: serializerOverride,
    ...introspectOptions
  } = options

  if (!enabled) {
    return t.router({})
  }

  const procedures = introspectRouter(appRouter, introspectOptions)
  const serializer = serializerOverride ?? detectSerializer(appRouter._def._config)

  const { description: metaDescription, ...restMeta } = meta ?? {} as Record<string, unknown>

  const result: IntrospectionResult = {
    ...restMeta,
    description: generateDescription(metaDescription),
    serializer,
    procedures,
  }

  return t.router({
    [path]: t.procedure.query(() => result),
  })
}

export function withIntrospection<TRouter extends AnyTRPCRouter>(
  t: AnyTRPCRoot,
  appRouter: TRouter,
  options: IntrospectionRouterOptions = {},
) {
  if (options.enabled === false) {
    return appRouter
  }

  return t.mergeRouters(
    appRouter,
    createIntrospectionRouter(t, appRouter, options),
  ) as TRouter
}
