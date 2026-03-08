import type { TRPCProcedureType } from '@trpc/server'

export type JSONSchema = Record<string, unknown>

export interface EndpointInfo {
  path: string
  type: TRPCProcedureType
  description?: string
  input?: JSONSchema
  output?: JSONSchema
}

export interface IntrospectOptions {
  include?: readonly string[]
  exclude?: readonly string[]
}

export type Serializer = 'json' | 'superjson' | 'custom'

export interface IntrospectionResult {
  name?: string
  description: string
  serializer: Serializer
  pathFilter?: string
  procedures: EndpointInfo[]
}

export interface IntrospectionRouterOptions<TPath extends string = string> extends IntrospectOptions {
  enabled?: boolean
  path?: TPath
  serializer?: Serializer
  meta?: {
    name?: string
    description?: string
  }
}
