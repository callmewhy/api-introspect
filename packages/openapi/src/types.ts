import type { JSONSchema } from '@api-introspect/core'

export interface OpenAPIInfo {
  title?: string
  description?: string
  version?: string
}

export interface OpenAPIServer {
  url: string
  description?: string
}

export interface OpenAPIParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie' | 'body' | 'formData'
  required?: boolean
  description?: string
  schema?: JSONSchema
  /** Swagger 2.0 inlines schema fields directly on the parameter. */
  type?: string
  $ref?: string
  [key: string]: unknown
}

export interface OpenAPIMediaType {
  schema?: JSONSchema
  [key: string]: unknown
}

export interface OpenAPIRequestBody {
  description?: string
  required?: boolean
  content?: Record<string, OpenAPIMediaType>
  $ref?: string
  [key: string]: unknown
}

export interface OpenAPIResponse {
  description?: string
  content?: Record<string, OpenAPIMediaType>
  /** Swagger 2.0 puts the schema directly on the response. */
  schema?: JSONSchema
  $ref?: string
  [key: string]: unknown
}

export interface OpenAPIOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
  responses?: Record<string, OpenAPIResponse>
  security?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface OpenAPIPathItem {
  summary?: string
  description?: string
  parameters?: OpenAPIParameter[]
  get?: OpenAPIOperation
  put?: OpenAPIOperation
  post?: OpenAPIOperation
  delete?: OpenAPIOperation
  options?: OpenAPIOperation
  head?: OpenAPIOperation
  patch?: OpenAPIOperation
  trace?: OpenAPIOperation
  [key: string]: unknown
}

export interface OpenAPIComponents {
  schemas?: Record<string, JSONSchema>
  parameters?: Record<string, OpenAPIParameter>
  requestBodies?: Record<string, OpenAPIRequestBody>
  responses?: Record<string, OpenAPIResponse>
  [key: string]: unknown
}

export interface OpenAPIDocument {
  openapi?: string
  swagger?: string
  info?: OpenAPIInfo
  servers?: OpenAPIServer[]
  paths?: Record<string, OpenAPIPathItem>
  components?: OpenAPIComponents
  /** Swagger 2.0 fields. */
  definitions?: Record<string, JSONSchema>
  parameters?: Record<string, OpenAPIParameter>
  responses?: Record<string, OpenAPIResponse>
  host?: string
  basePath?: string
  schemes?: string[]
  [key: string]: unknown
}
