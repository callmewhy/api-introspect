import type { TRPCProcedureType } from '@trpc/server'

export type JSONSchema = Record<string, unknown>

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

export type Serializer = 'json' | 'superjson' | 'custom'

export interface IntrospectionResult {
  name?: string
  description: string
  serializer: Serializer
  pathFilter?: string
  procedures: EndpointInfo[]
  [key: string]: unknown
}

export interface IntrospectionRouterOptions extends IntrospectOptions {
  enabled?: boolean
  path?: string
  serializer?: Serializer
  meta?: Record<string, unknown>
}
