import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 独立交付副本可显式指定公共仓库；普通工作区沿用原来的模块布局。
const root=process.env.METRIC_TEST_CORE_ROOT || fileURLToPath(new URL('../../../jetlinks-web-core/',import.meta.url))
export const {createMetricLoader,flush,sourceRoot}=await import(pathToFileURL(resolve(root,'tests/helpers/metricRuntime.mjs')).href)
