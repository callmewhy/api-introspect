import type { IntrospectionResult } from '@api-introspect/core'

import { formatSummary } from './format'
import type { ParsedArgs } from './types'

export const SUMMARY_THRESHOLD = 10

export function outputIntrospection(introspection: IntrospectionResult, args: ParsedArgs) {
  const { format } = args
  const count = (introspection.endpoints ?? introspection.procedures)?.length ?? 0
  const autoSummary = count > SUMMARY_THRESHOLD
  const useSummary = format ? format === 'summary' : autoSummary

  if (useSummary) {
    console.log(formatSummary(introspection))
  }
  else {
    console.log(JSON.stringify(introspection, null, 2))
  }
}
