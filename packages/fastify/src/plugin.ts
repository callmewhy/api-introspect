import type { IntrospectionResult } from '@api-introspect/core'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import type { RouteInfo } from './introspect'
import { introspectRoutes } from './introspect'
import type { IntrospectionPluginOptions } from './types'

const SKIP_METHODS = new Set(['HEAD'])
const INTROSPECT_MARKER = '_apiIntrospect'

function generateDescription(description?: string) {
  const base = 'Fastify HTTP API. Use "npx api-introspect <base-url>" to discover endpoints.'
  return description?.trim()
    ? `${base} ${description.trim()}`
    : base
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
  let payload: IntrospectionResult | null = null

  fastify.addHook('onRoute', (routeOptions) => {
    const config = routeOptions.config as Record<string, unknown> | undefined
    if (config?.[INTROSPECT_MARKER])
      return

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

  fastify.get(path, { config: { [INTROSPECT_MARKER]: true } }, async () => {
    if (!payload) {
      const endpoints = introspectRoutes(collected, introspectOptions)
      payload = {
        ...(meta?.name && { name: meta.name }),
        ...(meta?.baseUrl && { baseUrl: meta.baseUrl }),
        description: generateDescription(meta?.description),
        ...(meta?.auth && { auth: meta.auth }),
        serializer,
        endpoints,
      }
    }
    return payload
  })
}

export const introspection = fp<IntrospectionPluginOptions>(introspectionPlugin, {
  name: '@api-introspect/fastify',
  fastify: '>=4.0.0',
})
