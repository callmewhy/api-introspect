import type { AnyTRPCRouter, TRPCRootObject } from '@trpc/server'

import { introspectRouter } from './introspect'
import { detectSerializer } from './serializer'
import type { IntrospectionResult, IntrospectionRouterOptions } from './types'

/* eslint-disable ts/no-explicit-any */
type AnyTRPCRoot = TRPCRootObject<any, any, any, any>
/* eslint-enable ts/no-explicit-any */

function generateDescription(endpointPath: string, prefixes: string[]): string {
  const prefixExample = prefixes.length > 0 ? ` (e.g. /${endpointPath}.${prefixes[0]} to list only ${prefixes[0]} procedures)` : ''

  return `tRPC API. Use "npx trpc-introspect <base-url> [procedure] [input]" to discover and call procedures. Append .<prefix> to this endpoint to filter by path prefix${prefixExample}.`
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

  // Build sub-routes for every path prefix so multi-level filtering works.
  // e.g. /_introspect.user, /_introspect.user.profile, /_introspect.user.profile.get
  const prefixes = new Set<string>()
  for (const p of procedures) {
    const parts = p.path.split('.')
    for (let i = 1; i <= parts.length; i++) {
      prefixes.add(parts.slice(0, i).join('.'))
    }
  }

  const topLevelPrefixes = [...new Set(procedures.map(p => p.path.split('.')[0]).filter(Boolean))]
  const description = mergeDescription(
    generateDescription(path, topLevelPrefixes),
    meta?.description,
  )

  const result: IntrospectionResult = {
    ...(meta?.name && { name: meta.name }),
    description,
    serializer,
    procedures,
  }

  // eslint-disable-next-line ts/no-explicit-any
  const routerDef: Record<string, any> = {
    [path]: t.procedure.query(() => result),
  }

  for (const prefix of prefixes) {
    const filtered = procedures.filter(p => p.path === prefix || p.path.startsWith(`${prefix}.`))
    const prefixResult: IntrospectionResult = {
      ...(meta?.name && { name: meta.name }),
      description,
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
  ) as TRouter
}
