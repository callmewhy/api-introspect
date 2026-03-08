import type { AnyTRPCRouter, TRPCRootObject } from '@trpc/server'
import { initTRPC } from '@trpc/server'

import { introspectRouter } from './introspect'
import { detectSerializer, generateSkillText } from './serializer'
import type { IntrospectionRouterOptions } from './types'

type InitTRPCOptions = Parameters<typeof initTRPC.create>[0]
/* eslint-disable ts/no-explicit-any */
type AnyTRPCRoot = TRPCRootObject<any, any, any, any>
/* eslint-enable ts/no-explicit-any */

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
  const { enabled = true, path = '_introspect', ...introspectOptions } = options

  if (!enabled) {
    return t.router({})
  }

  const endpoints = introspectRouter(appRouter, introspectOptions)
  const serializer = options.serializer ?? detectSerializer(appRouter._def._config)
  const skillText = generateSkillText(serializer)

  return t.router({
    [path]: t.procedure.query(() => endpoints),
    [`${path}.skill.md`]: t.procedure.query(() => skillText),
  })
}

export function withIntrospection<TRouter extends AnyTRPCRouter>(
  t: AnyTRPCRoot,
  appRouter: TRouter,
  options: IntrospectionRouterOptions = {},
) {
  return t.mergeRouters(
    appRouter,
    createIntrospectionRouter(t, appRouter, options),
  )
}

export function addIntrospectionEndpoint<TRouter extends AnyTRPCRouter>(
  router: TRouter,
  options: IntrospectionRouterOptions = {},
) {
  const runtimeConfig = { ...(router._def._config as InitTRPCOptions & { $types?: unknown }) }
  delete runtimeConfig.$types

  const t = initTRPC.create(runtimeConfig)

  return withIntrospection(t, router, options)
}
