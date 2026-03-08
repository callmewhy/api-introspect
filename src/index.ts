import type { AnyTRPCRouter, TRPCProcedureType, TRPCRootObject } from '@trpc/server'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

type JSONSchema = Record<string, unknown>

interface ZodSchemaWithInternalDef extends z.ZodType {
  _zod?: { def?: { type?: string } }
  def?: { type?: string }
}

interface ProcedureMetaLike {
  description?: unknown
}

interface ProcedureDefLike {
  type?: unknown
  meta?: ProcedureMetaLike
  inputs?: unknown[]
  output?: unknown
}

interface ProcedureLike {
  _def?: ProcedureDefLike
}

type InitTRPCOptions = Parameters<typeof initTRPC.create>[0]
/* eslint-disable ts/no-explicit-any */
type AnyTRPCRoot = TRPCRootObject<any, any, any, any>
/* eslint-enable ts/no-explicit-any */

const PROCEDURE_TYPES = new Set<TRPCProcedureType>(['query', 'mutation', 'subscription'])
const schemaCache = new WeakMap<z.ZodType, JSONSchema | undefined>()

export interface EndpointInfo {
  path: string
  type: TRPCProcedureType
  description: string | undefined
  input: JSONSchema | undefined
  output: JSONSchema | undefined
}

export interface IntrospectOptions {
  exclude?: string[]
}

export interface IntrospectionRouterOptions extends IntrospectOptions {
  enabled?: boolean
  path?: string
}

export function introspectRouter(
  router: AnyTRPCRouter,
  options: IntrospectOptions = {},
): EndpointInfo[] {
  const excludePrefixes = options.exclude ?? []
  const endpoints: EndpointInfo[] = []

  for (const [path, procedure] of Object.entries(router._def.procedures ?? {})) {
    if (isExcludedPath(path, excludePrefixes)) {
      continue
    }

    const def = getProcedureDef(procedure)
    const type = getProcedureType(def?.type)
    if (!def || !type) {
      continue
    }

    endpoints.push({
      path,
      type,
      description: getDescription(def.meta),
      input: toJSONSchema(def.inputs?.[0]),
      output: toJSONSchema(def.output),
    })
  }

  return endpoints
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
  const { enabled = true, path = '_introspect', ...introspectOptions } = options

  if (!enabled) {
    return t.router({})
  }

  const endpoints = introspectRouter(appRouter, introspectOptions)

  return t.router({
    [path]: t.procedure.query(() => endpoints),
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

function getDescription(meta: ProcedureMetaLike | undefined) {
  return typeof meta?.description === 'string'
    ? meta.description
    : undefined
}

function getProcedureDef(procedure: unknown) {
  if (!isObjectLike(procedure)) {
    return undefined
  }

  const { _def } = procedure as ProcedureLike
  return isRecord(_def) ? (_def as ProcedureDefLike) : undefined
}

function getProcedureType(type: unknown) {
  if (typeof type !== 'string' || !PROCEDURE_TYPES.has(type as TRPCProcedureType)) {
    return undefined
  }

  return type as TRPCProcedureType
}

function isExcludedPath(path: string, excludePrefixes: string[]) {
  return excludePrefixes.some(prefix => path.startsWith(prefix))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
}

function isZodSchema(value: unknown): value is z.ZodType {
  return value instanceof z.ZodType
}

function toJSONSchema(schema: unknown) {
  if (!isZodSchema(schema)) {
    return undefined
  }

  const cachedSchema = schemaCache.get(schema)
  if (cachedSchema !== undefined || schemaCache.has(schema)) {
    return cachedSchema
  }

  try {
    const jsonSchema = z.toJSONSchema(schema, {
      unrepresentable: 'any',
      override: (ctx) => {
        const zodSchema = ctx.zodSchema as ZodSchemaWithInternalDef
        const type = zodSchema._zod?.def?.type ?? zodSchema.def?.type

        if (type === 'date') {
          ctx.jsonSchema.type = 'string'
          ctx.jsonSchema.format = 'date-time'
          ctx.jsonSchema.deprecated = true
          ctx.jsonSchema.title = 'Unsupported Date'
          ctx.jsonSchema.description
            = 'Date is not supported. Use z.coerce.date() if you need a string-compatible input'
        }
      },
    })

    const { $schema: _, ...normalizedSchema } = jsonSchema as JSONSchema
    schemaCache.set(schema, normalizedSchema)
    return normalizedSchema
  }
  catch {
    schemaCache.set(schema, undefined)
    return undefined
  }
}
