import type { EndpointInfo, IntrospectOptions, JSONSchema } from '@api-introspect/core'
import { compactSchema, isExcludedPath, isIncludedPath } from '@api-introspect/core'
import type { AnyTRPCRouter } from '@trpc/server'
import { z } from 'zod'

interface ZodSchemaWithInternalDef {
  _zod?: { def?: { type?: string } }
  def?: { type?: string }
}

interface ProcedureMetaLike {
  description?: unknown
  [key: string]: unknown
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

type RpcProcedureType = 'query' | 'mutation' | 'subscription'
const PROCEDURE_TYPES = new Set<RpcProcedureType>(['query', 'mutation', 'subscription'])
const schemaCache = new WeakMap<z.ZodType, JSONSchema | undefined>()

export function introspectRouter(
  router: AnyTRPCRouter,
  options: IntrospectOptions = {},
): EndpointInfo[] {
  const includePrefixes = options.include ?? []
  const excludePrefixes = options.exclude ?? []
  const endpoints: EndpointInfo[] = []

  for (const [path, procedure] of Object.entries(router._def.procedures ?? {})) {
    if (includePrefixes.length > 0 && !isIncludedPath(path, includePrefixes))
      continue
    if (isExcludedPath(path, excludePrefixes))
      continue

    const def = getProcedureDef(procedure)
    const type = getProcedureType(def?.type)
    if (!def || !type) {
      continue
    }

    const description = getDescription(def.meta)
    const meta = getMeta(def.meta)
    const input = compactSchema(toInputJSONSchema(def.inputs))
    const output = compactSchema(toJSONSchema(def.output))

    endpoints.push({
      path,
      type,
      ...(description && { description }),
      ...(meta && { meta }),
      ...(input && { input }),
      ...(output && { output }),
    })
  }

  return endpoints
}

function getDescription(meta: ProcedureMetaLike | undefined) {
  return typeof meta?.description === 'string'
    ? meta.description
    : undefined
}

function getMeta(meta: ProcedureMetaLike | undefined): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object')
    return undefined

  const { description: _, ...rest } = meta
  if (Object.keys(rest).length === 0)
    return undefined

  return rest
}

function getProcedureDef(procedure: unknown) {
  if (!isObjectLike(procedure)) {
    return undefined
  }

  const { _def } = procedure as ProcedureLike
  return isRecord(_def) ? (_def as ProcedureDefLike) : undefined
}

function getProcedureType(type: unknown): RpcProcedureType | undefined {
  if (typeof type !== 'string' || !PROCEDURE_TYPES.has(type as RpcProcedureType)) {
    return undefined
  }

  return type as RpcProcedureType
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

function toInputJSONSchema(inputs: unknown[] | undefined) {
  const zodInputs = inputs?.filter(isZodSchema) ?? []
  if (zodInputs.length === 0) {
    return undefined
  }

  if (zodInputs.length === 1) {
    return toJSONSchema(zodInputs[0])
  }

  const [first, ...rest] = zodInputs
  const combinedSchema = rest.reduce((schema, input) => z.intersection(schema, input), first)
  return toJSONSchema(combinedSchema)
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
        const zodSchema = ctx.zodSchema as unknown as ZodSchemaWithInternalDef
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
