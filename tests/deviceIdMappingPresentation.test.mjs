import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createComponentLoader } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

test('mapping icon distinguishes configured, unconfigured, loading and failure for editable and readonly viewers', async () => {
  let state
  const load = createComponentLoader({
    'vue-i18n': { useI18n: () => ({ t:key=>key }) },
    './useDeviceIdMapping': { useDeviceIdMapping: () => state },
    '@jetlinks-web-core/components/SkeletonText': { __esModule:true, default:{render:()=>h('span',{'data-skeleton':true})} },
  })
  const Mapping = load('../../modules/device-manager-ui/views/device/Instance/Detail/components/DeviceIdMapping.vue').default
  for (const expected of ['mapped','unmapped','loading','error']) for (const canUpdate of [true,false]) {
    state = {
      target:ref({id:'device-A',accessId:'access-A'}), isPluginGateway:ref(true), inkingVisible:ref(false),
      inklingDeviceId:ref(expected==='mapped'?'external-A':undefined), channelId:ref('plugin-A'),
      loading:ref(expected==='loading'), loadFailed:ref(expected==='error'), openInklingModal(){}, saveInkling(){},
    }
    const app=createSSRApp({render:()=>h(Mapping,{iconOnly:true,canUpdate})})
    app.component('a-tooltip',{setup:(_,{slots})=>()=>slots.default?.()})
    app.component('a-button',{setup:(_,{slots})=>()=>h('button',[slots.icon?.(),slots.default?.()])})
    app.component('AIcon',{props:['type'],setup:p=>()=>h('svg',{'data-icon':p.type})})
    const html=await renderToString(app)
    assert.match(html,new RegExp(`data-state="${expected}"`))
    assert.equal(html.includes('<button'),canUpdate)
    assert.equal(html.includes('data-skeleton'),expected==='loading')
    if(expected!=='loading') assert.match(html,new RegExp(`data-icon="${({mapped:'LinkOutlined',unmapped:'DisconnectOutlined',error:'ExclamationCircleOutlined'})[expected]}"`))
    if(!canUpdate) assert.match(html,/role="img"/)
  }
})
