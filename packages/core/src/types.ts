export type JSONSchema = Record<string, unknown>

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'

export type ProcedureType = 'query' | 'mutation' | 'subscription' | 'http'

interface BaseEndpointInfo {
  path: string
  description?: string
  input?: JSONSchema
  output?: JSONSchema
}

interface RpcEndpointInfo extends BaseEndpointInfo {
  type: 'query' | 'mutation' | 'subscription'
  method?: never
}

interface HttpEndpointInfo extends BaseEndpointInfo {
  type: 'http'
  method: HttpMethod
}

export type EndpointInfo = RpcEndpointInfo | HttpEndpointInfo

export interface IntrospectOptions {
  include?: readonly string[]
  exclude?: readonly string[]
}

export type Serializer = 'json' | 'superjson' | 'custom'

export interface IntrospectionResult {
  name?: string
  description: string
  serializer: Serializer
  procedures: EndpointInfo[]
}
