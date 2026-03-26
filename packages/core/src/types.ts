export type JSONSchema = Record<string, unknown>

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'

export type ProcedureType = 'query' | 'mutation' | 'subscription' | 'http'

interface BaseEndpointInfo {
  path: string
  description?: string
  meta?: Record<string, unknown>
  output?: JSONSchema
}

interface RpcEndpointInfo extends BaseEndpointInfo {
  type: 'query' | 'mutation' | 'subscription'
  method?: never
  input?: JSONSchema
}

interface HttpEndpointInfo extends BaseEndpointInfo {
  type: 'http'
  method: HttpMethod
  params?: JSONSchema
  query?: JSONSchema
  body?: JSONSchema
}

export type EndpointInfo = RpcEndpointInfo | HttpEndpointInfo

export interface IntrospectOptions {
  include?: readonly string[]
  exclude?: readonly string[]
}

export type Serializer = 'json' | 'superjson' | 'custom'

export interface IntrospectionMeta {
  name: string
  [key: string]: unknown
}

export interface IntrospectionResult {
  name?: string
  description: string
  serializer: Serializer
  procedures?: EndpointInfo[]
  endpoints?: EndpointInfo[]
  [key: string]: unknown
}
