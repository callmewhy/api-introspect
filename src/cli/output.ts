import type { IntrospectionResult } from '../types'
import { formatSummary } from './format'

export const SUMMARY_THRESHOLD = 10

export function outputIntrospection(introspection: IntrospectionResult) {
  if ((introspection.procedures?.length ?? 0) > SUMMARY_THRESHOLD) {
    console.log(formatSummary(introspection))
  }
  else {
    console.log(JSON.stringify(introspection, null, 2))
  }
}
