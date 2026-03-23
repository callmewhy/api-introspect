export interface ParsedArgs {
  baseUrl: string | undefined
  procedure: string | undefined
  input: string | undefined
  headers: Record<string, string>
  format: 'summary' | 'full' | undefined
  method: string | undefined
}
