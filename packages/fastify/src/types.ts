import type { IntrospectOptions, Serializer } from '@api-introspect/core'

export interface IntrospectionPluginOptions extends IntrospectOptions {
  enabled?: boolean
  path?: string
  serializer?: Serializer
  meta?: {
    name?: string
    description?: string
    baseUrl?: string
    auth?: Record<string, unknown>
  }
}
