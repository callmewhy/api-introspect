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
    : 'standard JSON'

  const counts = [
    queries && `${queries} queries`,
    mutations && `${mutations} mutations`,
    subs && `${subs} subscriptions`,
  ].filter(Boolean).join(', ')

  const namespaces = [...new Set(procedures.map(p => p.path.split('.')[0]).filter(Boolean))]
  const nsExample = namespaces.length > 0 ? ` (e.g. /${endpointPath}.${namespaces[0]} to list only ${namespaces[0]} procedures)` : ''

  return `tRPC API with ${counts || 'no procedures'}. Encoding: ${encoding}. Queries: GET /<path>?input=<url-encoded-json>. Mutations: POST /<path> with JSON body. Response: {"result":{"data":<value>}}. Append .<namespace> to this endpoint to filter by path prefix${nsExample}.`
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
  const { enabled = true, path = '_introspect', meta, ...introspectOptions } = options

  if (!enabled) {
    return t.router({})
  }

  const procedures = introspectRouter(appRouter, introspectOptions)
  const serializer = options.serializer ?? detectSerializer(appRouter._def._config)

  const description = generateDescription(serializer, procedures, path)

  const result: IntrospectionResult = {
    ...meta,
    description,
    serializer,
    procedures,
  }

  // Build namespace sub-routes so e.g. /_introspect/user returns only user.* procedures
  const namespaces = [...new Set(
    procedures
      .map(p => p.path.split('.')[0])
      .filter((ns): ns is string => !!ns),
  )]

  // eslint-disable-next-line ts/no-explicit-any
  const routerDef: Record<string, any> = {
    [path]: t.procedure.query(() => result),
  }

  for (const ns of namespaces) {
    const filtered = procedures.filter(p => p.path.startsWith(`${ns}.`))
    const nsResult: IntrospectionResult = {
      ...meta,
      description: generateDescription(serializer, filtered, path),
      serializer,
      procedures: filtered,
    }
    // Dotted key e.g. '_introspect.user' maps to URL /_introspect/user
    routerDef[`${path}.${ns}`] = t.procedure.query(() => nsResult)
  }

  return t.router(routerDef)
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
