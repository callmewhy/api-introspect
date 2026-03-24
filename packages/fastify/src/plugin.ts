import type { IntrospectionResult } from '@api-introspect/core'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import type { RouteInfo } from './introspect'
import { introspectRoutes } from './introspect'
import type { IntrospectionPluginOptions } from './types'

const SKIP_METHODS = new Set(['HEAD'])

function generateDescription(extraDescription?: string) {
  const base = 'Fastify HTTP API. Use "npx api-introspect <base-url>" to discover endpoints.'
  if (extraDescription?.trim()) {
    return `${base} ${extraDescription.trim()}`
  }
  return base
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
    if (routeOptions.url === path)
      return

    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method]

    for (const method of methods) {
      if (SKIP_METHODS.has(method.toUpperCase()))
        continue
      const routeMeta = (routeOptions.config as Record<string, unknown>)?.meta as Record<string, unknown> | undefined

      collected.push({
        method: method.toUpperCase(),
        url: routeOptions.url,
        schema: routeOptions.schema as RouteInfo['schema'],
        ...(routeMeta && Object.keys(routeMeta).length > 0 && { meta: routeMeta }),
      })
    }
  })

  fastify.get(path, async () => {
    if (!payload) {
      const procedures = introspectRoutes(collected, introspectOptions)
      payload = {
        ...(meta?.name && { name: meta.name }),
        description: generateDescription(meta?.description),
        serializer,
        procedures,
      }
    }
    return payload
  })
}

export const introspection = fp(introspectionPlugin, {
  name: '@api-introspect/fastify',
  fastify: '>=4.0.0',
})
