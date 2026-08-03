<template>
  <a-drawer v-model:open="visible" :title="title" width="880" :mask-closable="false" destroy-on-close>
    <a-spin :spinning="loading">
      <a-form layout="vertical">
        <a-form-item :label="$t('IotSceneLinkage.form.name')" required>
          <a-input v-model:value="form.name" :placeholder="$t('IotSceneLinkage.placeholder.name')" />
        </a-form-item>
        <a-form-item :label="$t('IotSceneLinkage.form.description')">
          <a-textarea v-model:value="form.description" :rows="2" :placeholder="$t('IotSceneLinkage.placeholder.description')" />
        </a-form-item>

        <section class="editor-section">
          <h3>{{ $t('IotSceneLinkage.editor.trigger') }}</h3>
          <a-radio-group v-model:value="form.triggerKind" button-style="solid" @change="resetTrigger">
            <a-radio-button value="manual">{{ $t('IotSceneLinkage.trigger.manual') }}</a-radio-button>
            <a-radio-button value="repeat">{{ $t('IotSceneLinkage.trigger.repeat') }}</a-radio-button>
            <a-radio-button value="date">{{ $t('IotSceneLinkage.trigger.date') }}</a-radio-button>
            <a-radio-button value="interval">{{ $t('IotSceneLinkage.trigger.interval') }}</a-radio-button>
            <a-radio-button value="property">{{ $t('IotSceneLinkage.trigger.property') }}</a-radio-button>
            <a-radio-button value="event">{{ $t('IotSceneLinkage.trigger.event') }}</a-radio-button>
            <a-radio-button value="online">{{ $t('IotSceneLinkage.operator.online') }}</a-radio-button>
            <a-radio-button value="offline">{{ $t('IotSceneLinkage.operator.offline') }}</a-radio-button>
            <a-radio-button value="alarm" disabled>{{ $t('IotSceneLinkage.trigger.alarm') }}</a-radio-button>
          </a-radio-group>

          <template v-if="isTimer">
            <a-form-item v-if="form.triggerKind === 'repeat'" :label="$t('IotSceneLinkage.editor.time')">
              <a-time-picker v-model:value="repeatTime" format="HH:mm" value-format="HH:mm" />
            </a-form-item>
            <a-form-item v-else-if="form.triggerKind === 'date'" :label="$t('IotSceneLinkage.editor.dateTime')">
              <a-date-picker v-model:value="form.dateTime" show-time format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" />
            </a-form-item>
            <a-space v-else>
              <a-form-item :label="$t('IotSceneLinkage.editor.interval')"><a-input-number v-model:value="form.interval" :min="1" /></a-form-item>
              <a-form-item :label="$t('IotSceneLinkage.editor.unit')"><a-select v-model:value="form.intervalUnit" :options="intervalUnits" style="width: 120px" /></a-form-item>
            </a-space>
          </template>

          <template v-if="isDevice">
            <a-form-item :label="$t('IotSceneLinkage.form.product')" required>
              <a-select v-model:value="form.productId" show-search :filter-option="false" :options="productOptions" :loading="productLoading" :placeholder="$t('IotSceneLinkage.placeholder.product')" @dropdownVisibleChange="open => open && loadProducts()" @search="loadProducts" @change="onProductChange" />
            </a-form-item>
            <a-form-item :label="$t('IotSceneLinkage.editor.autoInclude')">
              <a-switch v-model:checked="form.dynamicScope" @change="changeScope" />
            </a-form-item>
            <a-form-item :label="form.dynamicScope ? $t('IotSceneLinkage.editor.groups') : $t('IotSceneLinkage.scope.fixed')" required>
              <a-select v-if="!form.dynamicScope" v-model:value="form.deviceIds" mode="multiple" show-search :filter-option="false" :options="deviceOptions" :loading="deviceLoading" :placeholder="$t('IotSceneLinkage.placeholder.device')" @dropdownVisibleChange="open => open && loadDevices()" @search="loadDevices" />
              <a-space v-else direction="vertical" style="width: 100%">
                <a-radio-group v-model:value="form.dynamicScopeType" @change="changeScopeType">
                  <a-radio-button value="device-group">{{ $t('IotSceneLinkage.editor.groups') }}</a-radio-button>
                  <a-radio-button value="space">{{ $t('IotSceneLinkage.editor.areas') }}</a-radio-button>
                </a-radio-group>
                <a-select v-model:value="form.groupIds" mode="multiple" show-search :filter-option="false" :options="scopeOptions" :loading="scopeLoading" :placeholder="form.dynamicScopeType === 'space' ? $t('IotSceneLinkage.editor.areas') : $t('IotSceneLinkage.editor.groups')" @dropdownVisibleChange="open => open && loadScopes()" />
              </a-space>
            </a-form-item>
            <template v-if="form.triggerKind === 'property'">
              <a-space align="start">
                <a-form-item :label="$t('IotSceneLinkage.form.property')"><a-select v-model:value="form.propertyId" :options="propertyOptions" @dropdownVisibleChange="open => open && loadProductDetail()" /></a-form-item>
                <a-form-item :label="$t('IotSceneLinkage.form.termType')"><a-select v-model:value="form.termType" :options="termOptions" /></a-form-item>
                <a-form-item :label="$t('IotSceneLinkage.form.termValue')"><a-input v-model:value="form.termValue" /></a-form-item>
              </a-space>
            </template>
            <a-form-item v-else-if="form.triggerKind === 'event'" :label="$t('IotSceneLinkage.form.event')"><a-select v-model:value="form.eventId" :options="eventOptions" @dropdownVisibleChange="open => open && loadProductDetail()" /></a-form-item>
          </template>
        </section>

        <section class="editor-section">
          <h3>{{ $t('IotSceneLinkage.editor.actions') }}</h3>
          <a-space direction="vertical" style="width: 100%">
            <div v-for="(action, index) in form.actions" :key="index" class="action-row">
              <span>{{ actionLabel(action) }}</span>
              <template v-if="action.type === 'delay'">
                <a-input-number v-model:value="action.time" :min="1" />
                <a-select v-model:value="action.unit" :options="delayUnits" style="width: 110px" />
              </template>
              <a-button type="link" danger @click="form.actions.splice(index, 1)">{{ $t('IotSceneLinkage.action.delete') }}</a-button>
            </div>
            <a-button @click="addDelay">{{ $t('IotSceneLinkage.action.addDelay') }}</a-button>
            <a-button @click="actionEditor = 'device'">{{ $t('IotSceneLinkage.action.addDevice') }}</a-button>
            <a-button @click="actionEditor = 'notify'">{{ $t('IotSceneLinkage.action.addNotify') }}</a-button>
          </a-space>
        </section>

      </a-form>
      <DeviceActionModal v-if="actionEditor === 'device'" @cancel="actionEditor = undefined" @save="saveDeviceAction" />
      <NotifyActionModal v-if="actionEditor === 'notify'" @cancel="actionEditor = undefined" @save="saveNotifyAction" />
    </a-spin>
    <template #footer><a-space><a-button @click="visible = false">{{ $t('IotSceneLinkage.action.cancel') }}</a-button><a-button type="primary" :loading="saving" @click="save">{{ $t('IotSceneLinkage.action.save') }}</a-button></a-space></template>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web-core/utils/comm'
import { createSceneLinkage, getProduct, getSceneDetail, queryDevices, queryProducts, updateSceneLinkage } from '../../../api/scene-linkage'
import { queryDeviceGroupDetailList_api } from '../../../api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from '../../../api/spaceArea'
import DeviceActionModal from '../../../../rule-engine-manager-ui/views/Scene/Save/action/Device/index.vue'
import NotifyActionModal from '../../../../rule-engine-manager-ui/views/Scene/Save/action/Notify/index.vue'
import { buildRequest, defaultForm, normalizeResult, toForm, type SceneLinkageForm } from '../utils'

const emit = defineEmits(['success'])
const { t: $t } = useI18n()
const visible = ref(false); const loading = ref(false); const saving = ref(false); const productLoading = ref(false); const deviceLoading = ref(false); const productDetailLoaded = ref(false)
const scopeLoading = ref(false)
const actionEditor = ref<'device' | 'notify'>()
const productOptions = ref<any[]>([]); const deviceOptions = ref<any[]>([]); const scopeOptions = ref<any[]>([]); const propertyOptions = ref<any[]>([]); const eventOptions = ref<any[]>([])
const form = reactive<SceneLinkageForm>(defaultForm())
const title = computed(() => form.id ? $t('IotSceneLinkage.title.edit') : $t('IotSceneLinkage.title.add'))
const isDevice = computed(() => ['property', 'event', 'online', 'offline'].includes(form.triggerKind))
const isTimer = computed(() => ['repeat', 'date', 'interval'].includes(form.triggerKind))
const repeatTime = computed({ get: () => form.repeatTime, set: value => form.repeatTime = value })
const intervalUnits = computed(() => [{ label: $t('IotSceneLinkage.unit.minutes'), value: 'minutes' }, { label: $t('IotSceneLinkage.unit.hours'), value: 'hours' }])
const delayUnits = computed(() => [{ label: $t('IotSceneLinkage.unit.seconds'), value: 'seconds' }, ...intervalUnits.value])
const termOptions = computed(() => ['gt', 'gte', 'eq', 'lte', 'lt'].map(value => ({ label: $t(`IotSceneLinkage.term.${value}`), value })))

const reset = () => { Object.assign(form, defaultForm()); productOptions.value = []; deviceOptions.value = []; scopeOptions.value = []; propertyOptions.value = []; eventOptions.value = []; productDetailLoaded.value = false }
const open = async (id?: string) => { reset(); visible.value = true; if (!id) return; loading.value = true; try { const response: any = await getSceneDetail(id); Object.assign(form, toForm(response.result || response)) } finally { loading.value = false } }
const loadProducts = async (keyword?: string) => { productLoading.value = true; try { const res = await queryProducts({ terms: keyword ? [{ column: 'name', termType: 'like', value: keyword }] : [] }); productOptions.value = normalizeResult(res).data.map((item: any) => ({ label: item.name, value: item.id })) } finally { productLoading.value = false } }
const loadDevices = async (keyword?: string) => { if (!form.productId) return onlyMessage($t('IotSceneLinkage.message.selectProductFirst'), 'warning'); deviceLoading.value = true; try { const terms: any[] = [{ column: 'productId', value: form.productId }]; if (keyword) terms.push({ column: 'name', termType: 'like', value: keyword }); const res = await queryDevices({ terms }); deviceOptions.value = normalizeResult(res).data.map((item: any) => ({ label: item.name || item.id, value: item.id })) } finally { deviceLoading.value = false } }
const loadScopes = async () => { if (scopeOptions.value.length) return; scopeLoading.value = true; try { scopeOptions.value = form.dynamicScopeType === 'space' ? (await queryProjectSpaceAreaSettings_api('')).areas.map(item => ({ label: item.name, value: item.id })) : (await queryDeviceGroupDetailList_api()).map(item => ({ label: item.name, value: item.id })) } finally { scopeLoading.value = false } }
const loadProductDetail = async () => { if (!form.productId || productDetailLoaded.value) return; const response: any = await getProduct(form.productId); const metadata = (response.result || response).metadata || '{}'; const json = typeof metadata === 'string' ? JSON.parse(metadata) : metadata; propertyOptions.value = (json.properties || []).map((item: any) => ({ label: item.name || item.id, value: item.id })); eventOptions.value = (json.events || []).map((item: any) => ({ label: item.name || item.id, value: item.id })); productDetailLoaded.value = true }
const onProductChange = (_value: string, option: any) => { form.productName = option?.label; form.deviceIds = []; form.groupIds = []; productDetailLoaded.value = false }
const changeScope = () => { form.deviceIds = []; form.groupIds = [] }
const changeScopeType = () => { form.groupIds = []; scopeOptions.value = [] }
const resetTrigger = () => { form.propertyId = undefined; form.eventId = undefined }
const addDelay = () => form.actions.push({ type: 'delay', time: 1, unit: 'seconds' })
const actionLabel = (action: SceneLinkageForm['actions'][number]) => $t(`IotSceneLinkage.action.${action.type}`)
const saveDeviceAction = (config: Record<string, any>, options?: Record<string, any>) => { form.actions.push({ type: 'device', config, options }); actionEditor.value = undefined }
const saveNotifyAction = (config: Record<string, any>, options?: Record<string, any>) => { form.actions.push({ type: 'notify', config, options }); actionEditor.value = undefined }
const save = async () => { if (!form.name) return onlyMessage($t('IotSceneLinkage.message.nameRequired'), 'warning'); if (isDevice.value && (!form.productId || (!form.dynamicScope && !form.deviceIds.length) || (form.dynamicScope && !form.groupIds.length))) return onlyMessage($t('IotSceneLinkage.message.deviceRequired'), 'warning'); if (form.triggerKind === 'property' && (!form.propertyId || form.termValue === undefined || form.termValue === '')) return onlyMessage($t('IotSceneLinkage.message.propertyRequired'), 'warning'); if (form.triggerKind === 'event' && !form.eventId) return onlyMessage($t('IotSceneLinkage.message.eventRequired'), 'warning'); if (!form.actions.length) return onlyMessage($t('IotSceneLinkage.message.actionRequired'), 'warning'); saving.value = true; try { const request = buildRequest(form); form.id ? await updateSceneLinkage(form.id, request) : await createSceneLinkage(request); onlyMessage($t('IotSceneLinkage.message.saved', { name: form.name }), 'success'); visible.value = false; emit('success') } finally { saving.value = false } }
defineExpose({ open })
</script>

<style scoped>
.editor-section { padding: 16px; margin-bottom: 16px; border: 1px solid #e5e6eb; border-radius: 6px; }
.editor-section h3 { margin: 0 0 16px; font-size: 14px; }
.action-row { display: flex; gap: 8px; align-items: center; }
</style>
