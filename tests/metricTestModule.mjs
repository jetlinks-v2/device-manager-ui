import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { writeFile, rm } from 'node:fs/promises'
import { rmSync } from 'node:fs'
let index=0
/** Named source-mapped bundles make behavior tests measurable against the production TS files. */
export async function loadMetricTestModule(relative,mocks={}) {
  const entry=fileURLToPath(new URL(relative,import.meta.url))
  const outfile=fileURLToPath(new URL(`../.metric-test-${process.pid}-${index++}.mjs`,import.meta.url))
  const result=await build({entryPoints:[entry],outfile,bundle:true,write:false,sourcemap:'inline',platform:'node',format:'esm',external:['vue'],plugins:[{name:'metric-test-boundaries',setup(builder){
    builder.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:args.path.endsWith('.vue')?{path:args.path,namespace:'sfc'}:undefined)
    builder.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],resolveDir:dirname(entry)}))
    builder.onLoad({filter:/.*/,namespace:'sfc'},()=>({contents:'export default {name:"TestBoundary"}'}))
  }}]})
  await writeFile(outfile,result.outputFiles[0].text)
  if(!process.env.METRIC_TEST_COVERAGE) process.on('exit',()=>rmSync(outfile,{force:true}))
  return import(outfile)
}
