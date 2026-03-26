import type { IntrospectionResult } from '@api-introspect/core'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import type { RouteInfo } from './introspect'
import { introspectRoutes } from './introspect'
import type { IntrospectionPluginOptions } from './types'

const SKIP_METHODS = new Set(['HEAD'])
const defaultDescription = 'Fastify HTTP API. Use "npx api-introspect <base-url> [endpoint] [input]" to discover and call endpoints.'

function generateDescription(description: unknown): string {
  return typeof description === 'string' && description.trim()
    ? description.trim()
    : defaultDescription
}

async function introspectionPlugin(
  fastify: FastifyInstance,
  options: IntrospectionPluginOptions = {},
) {
  const {
    enabled = true,
    path = '/_introspect',
    meta,
    serializer = 'json',
    ...introspectOptions
  } = options

  if (!enabled)
    return

  const collected: RouteInfo[] = []

  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url === path)
      return
    if (routeOptions.url.split('/').some(s => s.startsWith('_')))
      return

    const config = routeOptions.config as Record<string, unknown> | undefined
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method]

    for (const method of methods) {
      if (SKIP_METHODS.has(method.toUpperCase()))
        continue
      const rawMeta = config?.meta
      const isObject = rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
      const routeMeta = isObject ? rawMeta as Record<string, unknown> : undefined

      collected.push({
        method: method.toUpperCase(),
        url: routeOptions.url,
        schema: routeOptions.schema as RouteInfo['schema'],
        ...(routeMeta && Object.keys(routeMeta).length > 0 && { meta: routeMeta }),
      })
    }
  })

  const { description: metaDescription, ...restMeta } = meta ?? {} as Record<string, unknown>

  let precomputed: IntrospectionResult | null = null

  fastify.get(path, async () => {
    if (!precomputed) {
      const endpoints = introspectRoutes(collected, introspectOptions)
      precomputed = {
        ...restMeta,
        description: generateDescription(metaDescription),
        serializer,
        endpoints,
      }
    }
    return precomputed
  })
}

export const introspection = fp<IntrospectionPluginOptions>(introspectionPlugin, {
  name: '@api-introspect/fastify',
  fastify: '>=4.0.0',
})
