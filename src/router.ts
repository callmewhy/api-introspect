import type { AnyTRPCRouter, TRPCRootObject } from '@trpc/server'
import { initTRPC } from '@trpc/server'

import { introspectRouter } from './introspect'
import { detectSerializer } from './serializer'
import type { EndpointInfo, IntrospectionResult, IntrospectionRouterOptions, Serializer } from './types'

type InitTRPCOptions = Parameters<typeof initTRPC.create>[0]
/* eslint-disable ts/no-explicit-any */
type AnyTRPCRoot = TRPCRootObject<any, any, any, any>
/* eslint-enable ts/no-explicit-any */

function generateDescription(serializer: Serializer, procedures: EndpointInfo[], endpointPath: string): string {
  const queries = procedures.filter(p => p.type === 'query').length
  const mutations = procedures.filter(p => p.type === 'mutation').length
  const subs = procedures.filter(p => p.type === 'subscription').length

  const encoding = serializer === 'superjson'
    ? 'SuperJSON (wrap input with {json,meta}, unwrap responses the same way)'
    : serializer === 'custom'
      ? 'a custom tRPC transformer (wire format is server-defined)'
      : 'standard JSON'

  const transportHint = serializer === 'custom'
    ? 'Queries and mutations use the server\'s custom transformer, so inspect that transformer to encode requests and decode responses.'
    : 'Queries: GET /<path>?input=<url-encoded-json>. Mutations: POST /<path> with JSON body. Response: {"result":{"data":<value>}}.'

  const counts = [
    queries && `${queries} queries`,
    mutations && `${mutations} mutations`,
    subs && `${subs} subscriptions`,
  ].filter(Boolean).join(', ')

  const prefixes = [...new Set(procedures.map(p => p.path.split('.')[0]).filter(Boolean))]
  const prefixExample = prefixes.length > 0 ? ` (e.g. /${endpointPath}.${prefixes[0]} to list only ${prefixes[0]} procedures)` : ''

  return `tRPC API with ${counts || 'no procedures'}. Encoding: ${encoding}. ${transportHint} Append .<prefix> to this endpoint to filter by path prefix${prefixExample}.`
}

function mergeDescription(baseDescription: string, extraDescription: unknown) {
  return typeof extraDescription === 'string' && extraDescription.trim()
    ? `${baseDescription} ${extraDescription.trim()}`
    : baseDescription
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

  const result: IntrospectionResult = {
    ...meta,
    description: mergeDescription(
      generateDescription(serializer, procedures, path),
      meta?.description,
    ),
    serializer,
    procedures,
  }

  // Build sub-routes for every path prefix so multi-level filtering works.
  // e.g. /_introspect.user, /_introspect.user.profile, /_introspect.user.profile.get
  const prefixes = new Set<string>()
  for (const p of procedures) {
    const parts = p.path.split('.')
    for (let i = 1; i <= parts.length; i++) {
      prefixes.add(parts.slice(0, i).join('.'))
    }
  }

  // eslint-disable-next-line ts/no-explicit-any
  const routerDef: Record<string, any> = {
    [path]: t.procedure.query(() => result),
  }

  for (const prefix of prefixes) {
    const filtered = procedures.filter(p => p.path === prefix || p.path.startsWith(`${prefix}.`))
    const prefixResult: IntrospectionResult = {
      ...meta,
      description: mergeDescription(
        generateDescription(serializer, filtered, path),
        meta?.description,
      ),
      serializer,
      pathFilter: prefix,
      procedures: filtered,
    }
    routerDef[`${path}.${prefix}`] = t.procedure.query(() => prefixResult)
  }

  return t.router(routerDef)
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
  )
}

export function addIntrospectionEndpoint<TRouter extends AnyTRPCRouter>(
  router: TRouter,
  options: IntrospectionRouterOptions = {},
) {
  if (options.enabled === false) {
    return router
  }

  const runtimeConfig = { ...(router._def._config as InitTRPCOptions & { $types?: unknown }) }
  delete runtimeConfig.$types

  const t = initTRPC.create(runtimeConfig)

  return withIntrospection(t, router, options)
}
