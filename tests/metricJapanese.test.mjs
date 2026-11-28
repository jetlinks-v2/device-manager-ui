import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createMetricLoader} from '../../rule-engine-manager-ui/tests/helpers/metricRuntime.mjs'

const load=createMetricLoader()
const {iotMetricStarters}=load('../device-manager-ui/views/metric/Template/starters.ts')
const {localizedTemplate,metricTemplateTextEntries}=load('components/Metric/template/text.ts')

test('all built-in IoT examples have Japanese text and retain calculation declarations',()=>{
  for(const starter of iotMetricStarters){
    assert.ok(starter.providerNameI18n.ja,starter.id)
    assert.ok(starter.groupNameI18n.ja,starter.id)
    const template=starter.template
    for(const key of Object.keys(metricTemplateTextEntries(template)))assert.ok(template.options.i18nMessages[key]?.ja,`${starter.id}: ${key}`)
    const japanese=localizedTemplate(template,'ja')
    assert.notEqual(japanese.name,template.name)
    const restore=localizedTemplate(japanese,'zh')
    assert.deepEqual(restore,localizedTemplate(template,'zh'),'only display text may change')
  }
})

test('metric navigation has Japanese messages for every Chinese and English key',()=>{
  const read=language=>JSON.parse(readFileSync(new URL(`../locales/lang/${language}.json`,import.meta.url),'utf8'))
  const japanese=read('ja')
  for(const language of ['zh','en'])for(const key of Object.keys(read(language)).filter(key=>key.startsWith('DeviceMetrics.'))){
    assert.ok(japanese[key],key)
  }
})
