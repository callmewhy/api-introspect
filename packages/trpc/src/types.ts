import type { IntrospectOptions, Serializer } from '@api-introspect/core'

export interface IntrospectionRouterOptions<TPath extends string = string> extends IntrospectOptions {
  enabled?: boolean
  path?: TPath
  serializer?: Serializer
  meta?: {
    name?: string
    description?: string
    baseUrl?: string
    auth?: Record<string, unknown>
  }
}
