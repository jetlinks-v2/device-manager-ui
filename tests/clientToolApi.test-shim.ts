export {
  clientToolOutput,
  clientToolResult,
  defineClientToolAnalyticalProducer,
  defineClientTool,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolDefinition'

export { defineAiClientToolFactory as defineClientToolFactory } from '@jetlinks-web-core/layout/components/AiChat/clientTools'
export { toAiClientToolSessionDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientToolRouting'

export const defineClientTools = <T>(tools: readonly T[]) => [...tools]
