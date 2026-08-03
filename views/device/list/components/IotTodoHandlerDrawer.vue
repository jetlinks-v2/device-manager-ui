<template>
  <JlDrawerShell
    :open="open"
    :width="520"
    :icon="iconName"
    :title="todo?.title ?? $t('IotDeviceDetail.todoHandler.handleTitle')"
    :sub="subTitle"
    @update:open="(v) => emit('update:open', v)"
  >
    <template v-if="todo && targetModule" #head-extra>
      <a-button
        size="small"
        class="todo-handler__module-link"
        :disabled="busy"
        @click="onOpenModule"
      >
        <template #icon>
          <AIcon type="ArrowUpOutlined" aria-hidden="true" />
        </template>
        {{ targetModule.label }}
      </a-button>
    </template>

    <div v-if="todo" class="todo-handler">
      <!-- 待办元信息 -->
      <section class="todo-handler__meta">
        <div class="todo-handler__priority">
          <IotDeviceStatusPill :risk="todo.priority" />
          <span v-if="todo.sourceLabel" class="todo-handler__source-pill">{{ todo.sourceLabel }}</span>
        </div>
        <p class="todo-handler__detail">{{ todo.detail }}</p>
        <p class="todo-handler__tags">
          <span><AIcon type="UserOutlined" aria-hidden="true" />{{ todo.ownerLabel }}</span>
          <span v-if="todo.dueAt"><AIcon type="ClockCircleOutlined" aria-hidden="true" />{{ todo.dueAt }}</span>
        </p>
      </section>

      <section v-if="todo.records?.length" class="todo-handler__section" :aria-label="$t('IotDeviceDetail.todoHandler.recordsSection')">
        <header>
          <AIcon type="HistoryOutlined" aria-hidden="true" />
          <h3>{{ $t('IotDeviceDetail.todoHandler.recordsSection') }}</h3>
        </header>
        <ul class="todo-handler__records">
          <li v-for="record in todo.records" :key="record.id">
            <strong>{{ record.actor }}</strong>
            <span>{{ record.actedAt }}</span>
            <p>{{ record.action }}</p>
          </li>
        </ul>
      </section>

      <!-- ─── 按 actionKind 切换 drawer 内容 ─── -->

      <!-- a. diagnose: 关联设备 + 主点位 + 派生原因 -->
      <template v-if="todo.actionKind === 'diagnose' || !todo.actionKind">
        <section v-if="relatedDevices.length" class="todo-handler__section" :aria-label="$t('IotDeviceDetail.todoHandler.relatedDevices')">
          <header>
            <AIcon type="HddOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.todoHandler.sectionCount', { name: $t('IotDeviceDetail.todoHandler.relatedDevices'), count: relatedDevices.length }) }}</h3>
          </header>
          <ul class="todo-handler__device-list">
            <li v-for="d in relatedDevices" :key="d.id">
              <strong>{{ d.name }}</strong>
              <span class="todo-handler__device-meta">{{ d.location }} · {{ d.lastSeen }}</span>
              <IotDeviceStatusPill :status="d.status" />
            </li>
          </ul>
        </section>

        <section v-if="todo.evidence?.length" class="todo-handler__section" :aria-label="$t('IotDeviceDetail.todoHandler.derivedBasis')">
          <header>
            <AIcon type="BulbOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.todoHandler.derivedBasis') }}</h3>
          </header>
          <ul class="todo-handler__evidence">
            <li v-for="e in todo.evidence" :key="e">{{ e }}</li>
          </ul>
        </section>
      </template>

      <!-- b. verify-alarm: 告警事件 + 现场指引 -->
      <template v-else-if="todo.actionKind === 'verify-alarm'">
        <section v-if="relatedAlarms.length" class="todo-handler__section" :aria-label="$t('IotDeviceDetail.todoHandler.alarmEvents')">
          <header>
            <AIcon type="AlertOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.todoHandler.sectionCount', { name: $t('IotDeviceDetail.todoHandler.alarmEvents'), count: relatedAlarms.length }) }}</h3>
          </header>
          <ul class="todo-handler__alarms">
            <li v-for="a in relatedAlarms" :key="a.id">
              <span class="todo-handler__alarms-time">{{ a.occurredAt }}</span>
              <div>
                <strong>{{ a.title }}</strong>
                <p>{{ a.payload.summary }}</p>
              </div>
              <span class="todo-handler__alarms-level" :data-level="a.payload.level">{{ alarmLevelLabel(a.payload.level) }}</span>
            </li>
          </ul>
        </section>

        <section class="todo-handler__section" :aria-label="$t('IotDeviceDetail.todoHandler.onSiteGuide')">
          <header>
            <AIcon type="EnvironmentOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.todoHandler.onSiteGuide') }}</h3>
          </header>
          <ul class="todo-handler__evidence">
            <li>{{ $t('IotDeviceDetail.todoHandler.onSiteGuideDispatch') }}</li>
            <li>{{ $t('IotDeviceDetail.todoHandler.onSiteGuideVideo') }}</li>
            <li v-for="e in todo.evidence ?? []" :key="e">{{ e }}</li>
          </ul>
        </section>
      </template>

      <!-- c. adjust-rule: 每条涉及规则一个可编辑表单。系统给建议，用户决定最终值。 -->
      <template v-else-if="todo.actionKind === 'adjust-rule'">
        <section class="todo-handler__section" :aria-label="$t('IotDeviceDetail.todoHandler.ruleAdjust')">
          <header>
            <AIcon type="ControlOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.todoHandler.ruleCount', { count: ruleAdjustments.length }) }}</h3>
          </header>
          <p class="todo-handler__tip">
            {{ $t('IotDeviceDetail.todoHandler.ruleTip') }}
          </p>

          <article
            v-for="adj in ruleAdjustments"
            :key="adj.ruleId"
            class="todo-handler__rule"
          >
            <header>
              <strong>{{ adj.deviceName }}</strong>
              <span>{{ adj.ruleName }}</span>
            </header>
            <p class="todo-handler__rule-current">{{ $t('IotDeviceDetail.todoHandler.currentValue', { value: adj.currentTrigger }) }}</p>
            <p class="todo-handler__rule-suggestion">
              <AIcon type="BulbOutlined" aria-hidden="true" />
              {{ $t('IotDeviceDetail.todoHandler.suggestionValue', { value: adj.suggestionText }) }}
            </p>

            <div class="todo-handler__rule-fields">
              <label>
                <span>{{ $t('IotDeviceDetail.todoHandler.threshold') }}</span>
                <div class="todo-handler__rule-input">
                  <a-input-number
                    v-model:value="ruleForms[adj.ruleId].value"
                    :step="adj.unit === '分钟' ? 5 : 1"
                  />
                  <em>{{ displayUnit(adj.unit) }}</em>
                </div>
                <small>{{ $t('IotDeviceDetail.todoHandler.suggestedThreshold', { value: adj.suggestedValue, unit: displayUnit(adj.unit) }) }}</small>
              </label>
              <label>
                <span>{{ $t('IotDeviceDetail.todoHandler.duration') }}</span>
                <div class="todo-handler__rule-input">
                  <a-input-number
                    v-model:value="ruleForms[adj.ruleId].duration"
                    :step="5"
                  />
                  <em>{{ $t('IotSceneLinkage.unit.minutes') }}</em>
                </div>
                <small>{{ $t('IotDeviceDetail.todoHandler.suggestedDuration', { value: adj.suggestedDuration }) }}</small>
              </label>
            </div>

            <div class="todo-handler__rule-actions">
              <a-button
                class="todo-handler__rule-apply-suggestion"
                size="small"
                @click="applySuggestionToForm(adj)"
              >
                <template #icon>
                  <AIcon type="CheckOutlined" aria-hidden="true" />
                </template>
                {{ $t('IotDeviceDetail.todoHandler.useSuggestion') }}
              </a-button>
              <a-button
                v-if="isFormDirty(adj)"
                class="todo-handler__rule-reset"
                size="small"
                @click="resetForm(adj)"
              >
                {{ $t('IotDeviceDetail.todoHandler.restoreInitial') }}
              </a-button>
            </div>
          </article>
        </section>
      </template>

      <!-- d. view-grouping: 分组建议 -->
      <template v-else-if="todo.actionKind === 'view-grouping'">
        <section class="todo-handler__section" :aria-label="$t('IotDeviceDetail.todoHandler.groupSuggestion')">
          <header>
            <AIcon type="FolderOpenOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.todoHandler.groupSuggestion') }}</h3>
          </header>
          <ul class="todo-handler__evidence">
            <li v-for="e in todo.evidence ?? []" :key="e">{{ e }}</li>
          </ul>
        </section>
      </template>

      <!-- e. create-ticket: 维修工单 —— 当前在 inbox 提示，由维修模块承接 -->
      <template v-else-if="todo.actionKind === 'create-ticket'">
        <aside class="todo-handler__teaser">
          <header>
            <AIcon type="ToolOutlined" aria-hidden="true" />
            <span>{{ $t('IotDeviceDetail.todoHandler.dispatchRepair') }}</span>
          </header>
          <p>{{ $t('IotDeviceDetail.todoHandler.repairComingSoon') }}</p>
        </aside>
      </template>
    </div>

<template #foot>
      <a-button :disabled="busy" @click="emit('update:open', false)">{{ $t('IotDeviceDetail.common.cancel') }}</a-button>

      <!-- create-ticket 是升级 teaser，没有具体处置动作，只显示"关闭" -->
      <template v-if="todo && todo.actionKind !== 'create-ticket'">
        <label class="todo-handler__action-select">
          <span>{{ $t('IotDeviceDetail.todoHandler.selectAction') }}</span>
          <a-select
            :value="selectedActionKey"
            :disabled="busy"
            :options="actionSelectOptions"
            :placeholder="$t('IotDeviceDetail.todoHandler.selectPlaceholder')"
            @change="onActionSelectChange"
          />
        </label>
        <a-button
          type="primary"
          :disabled="busy || !selectedActionKey"
          @click="onExecuteSelectedAction"
        >
          <template #icon>
            <AIcon :type="primaryActionIcon" aria-hidden="true" />
          </template>
          {{ $t('IotDeviceDetail.todoHandler.execute') }}
        </a-button>
      </template>
    </template>
  </JlDrawerShell>
</template>

<script setup lang="ts">
/**
 * IotTodoHandlerDrawer · 单条待办的 inline 处理 drawer。
 *
 * 决议（详见 walkthrough · 今日待办反馈）：
 *  - 主按钮不再"跳转"，改为打开 drawer inline 处理，避免丢失上下文
 *  - drawer 内容按 actionKind 路由不同视图（关联设备 / 告警事件 / 规则建议 / 分组 / teaser）
 *  - footer 三段：标已处理 / 标暂缓 / 去完整视图（保留逃生口）
 *  - "去完整视图"之外，标已处理 + 标暂缓 都会让卡片从待办列表消失
 */
import { computed, reactive, ref, watch, type PropType } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import JlDrawerShell from './common/JlDrawerShell.vue'
import IotDeviceStatusPill from './IotDeviceStatusPill.vue'
import { buildIotDeviceDiagnosisPath } from '../hooks/useIotDeviceRouting'
import { iotDeviceService } from '../services/iotDevice.service'
import type { IotDevice, IotDeviceTodo } from '../types'

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  todo: {
    type: Object as PropType<IotDeviceTodo | null>,
    default: null,
  },
  allDevices: {
    type: Array as PropType<IotDevice[]>,
    required: true,
  },
  projectId: {
    type: String,
    required: true,
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const { t: $t } = useI18n()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'complete' | 'snooze', todoId: string, action?: string): void
}>()

const iconName = computed(() => {
  switch (props.todo?.actionKind) {
    case 'verify-alarm': return 'AlertOutlined'
    case 'adjust-rule': return 'ControlOutlined'
    case 'view-grouping': return 'FolderOpenOutlined'
    case 'create-ticket': return 'ToolOutlined'
    case 'diagnose':
    default: return 'MedicineBoxOutlined'
  }
})

const subTitle = computed(() => {
  if (!props.todo) return ''
  return $t('IotDeviceDetail.todoHandler.subtitle', {
    count: props.todo.deviceIds.length,
    owner: props.todo.ownerLabel,
  })
})

const selectedActionKey = ref('')

const actionSelectOptions = computed(() => {
  if (!props.todo) return []
  const options = [
    { label: $t('IotDeviceDetail.todoHandler.action.snooze'), value: 'snooze' },
  ]
  if (props.todo.actionKind === 'diagnose') options.push({ label: $t('IotDeviceDetail.todoHandler.action.notifyOwner'), value: 'notify' })
  if (props.todo.actionKind === 'verify-alarm') options.push({ label: $t('IotDeviceDetail.todoHandler.action.dispatched'), value: 'dispatch' })
  if (props.todo.actionKind === 'adjust-rule') options.push({ label: $t('IotDeviceDetail.todoHandler.action.observe'), value: 'observe' })
  options.push({ label: primaryActionLabel.value, value: 'primary' })
  return options
})

const targetModule = computed(() => {
  if (!props.todo) return null
  const firstDeviceId = props.todo.deviceIds[0]
  switch (props.todo.actionKind) {
    case 'verify-alarm':
      return { label: $t('IotDeviceDetail.todoHandler.openAlarm'), path: '/alarm' }
    case 'adjust-rule':
      return { label: $t('IotDeviceDetail.todoHandler.openRuleConfig'), path: '/alarm/rule-assistant?from=iot-workbench' }
    case 'view-grouping':
      return { label: $t('IotDeviceDetail.todoHandler.openDeviceGroups'), path: `/iot/groups?projectId=${props.projectId}` }
    case 'diagnose':
    default:
      return firstDeviceId
        ? { label: $t('IotDeviceDetail.todoHandler.openDiagnosis'), path: buildIotDeviceDiagnosisPath(props.projectId, firstDeviceId) }
        : null
  }
})

/* 主操作 label/icon 按 actionKind 切换。所有处置动作都在 drawer 内闭环，
   不再跳转到完整视图（决议见 walkthrough · 今日待办反馈）。 */
const primaryActionLabel = computed(() => {
  switch (props.todo?.actionKind) {
    case 'verify-alarm': return $t('IotDeviceDetail.todoHandler.action.confirmedNormal')
    /* adjust-rule 主按钮应用的是 *用户当前编辑的值*，不是 hardcode 建议值。
       系统建议只是 advice；用户在 drawer 里有完整的调整权利。 */
    case 'adjust-rule': return $t('IotDeviceDetail.todoHandler.action.applyAdjustments')
    case 'view-grouping': return $t('IotDeviceDetail.todoHandler.action.acceptGrouping')
    case 'diagnose':
    default: return $t('IotDeviceDetail.todoHandler.action.markHandled')
  }
})

const primaryActionIcon = computed(() => {
  switch (props.todo?.actionKind) {
    case 'verify-alarm': return 'SafetyCertificateOutlined'
    case 'adjust-rule': return 'CheckCircleOutlined'
    case 'view-grouping': return 'CheckCircleOutlined'
    case 'diagnose':
    default: return 'CheckCircleOutlined'
  }
})

const relatedDevices = computed<IotDevice[]>(() => {
  if (!props.todo) return []
  const ids = new Set(props.todo.deviceIds)
  return props.allDevices.filter((d) => ids.has(d.id))
})

const relatedAlarms = computed(() => {
  /* 告警事件聚合：从关联设备的 alarms 数组扁平化取出 */
  return relatedDevices.value.flatMap((d) =>
    d.alarms.map((a) => ({ ...a, deviceName: d.name })),
  )
})

/* ----- adjust-rule 表单：每条涉及规则一个独立 form ----- */

interface RuleAdjustment {
  ruleId: string
  deviceId: string
  deviceName: string
  ruleName: string
  currentTrigger: string
  currentValue: number
  currentDuration: number
  unit: string
  suggestedValue: number
  suggestedDuration: number
  suggestionText: string
}

/* mock 规则建议库：按 rule.id 给结构化建议。
   真实实现时从告警中心 rule-assistant 派生。 */
type RuleAdjustmentHint = Omit<RuleAdjustment, 'deviceId' | 'deviceName' | 'ruleName' | 'currentTrigger' | 'ruleId' | 'suggestionText'> & {
  suggestionKey: string
}

const RULE_ADJUSTMENT_HINTS: Record<string, RuleAdjustmentHint> = {
  'r-mall-atrium-air': {
    currentValue: 1000,
    currentDuration: 20,
    unit: 'ppm',
    suggestedValue: 1200,
    suggestedDuration: 30,
    suggestionKey: 'IotDeviceDetail.todoHandler.ruleHint.mallAtriumAir',
  },
  'r-mall-parking-co': {
    currentValue: 30,
    currentDuration: 5,
    unit: 'ppm',
    suggestedValue: 35,
    suggestedDuration: 8,
    suggestionKey: 'IotDeviceDetail.todoHandler.ruleHint.mallParkingCo',
  },
  'r-chem-pressure': {
    currentValue: 0.85,
    currentDuration: 10,
    unit: 'MPa',
    suggestedValue: 0.9,
    suggestedDuration: 15,
    suggestionKey: 'IotDeviceDetail.todoHandler.ruleHint.chemicalPressure',
  },
  'r-care-garden-flow': {
    currentValue: 10,
    currentDuration: 20,
    unit: 'm³/h',
    suggestedValue: 12,
    suggestedDuration: 30,
    suggestionKey: 'IotDeviceDetail.todoHandler.ruleHint.careGardenFlow',
  },
}

const ruleAdjustments = computed<RuleAdjustment[]>(() => {
  if (props.todo?.actionKind !== 'adjust-rule') return []
  const out: RuleAdjustment[] = []
  for (const device of relatedDevices.value) {
    for (const rule of device.rules) {
      if (rule.status !== '建议调整') continue
      const hint = RULE_ADJUSTMENT_HINTS[rule.id]
      if (!hint) continue
      const { suggestionKey, ...adjustment } = hint
      out.push({
        ruleId: rule.id,
        deviceId: device.id,
        deviceName: device.name,
        ruleName: rule.name,
        currentTrigger: rule.trigger,
        ...adjustment,
        suggestionText: $t(suggestionKey),
      })
    }
  }
  return out
})

interface RuleFormState {
  value: number
  duration: number
}

const ruleForms = reactive<Record<string, RuleFormState>>({})

/* 当 todo 变化或 ruleAdjustments 变化时，初始化 form 为当前值（不自动用建议值） */
watch(
  ruleAdjustments,
  (list) => {
    for (const adj of list) {
      if (!ruleForms[adj.ruleId]) {
        ruleForms[adj.ruleId] = { value: adj.currentValue, duration: adj.currentDuration }
      }
    }
    /* 清理已不在的 rule */
    const keepIds = new Set(list.map((a) => a.ruleId))
    for (const key of Object.keys(ruleForms)) {
      if (!keepIds.has(key)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ruleForms[key]
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.todo?.id,
  () => {
    selectedActionKey.value = ''
  },
  { immediate: true },
)

function applySuggestionToForm(adj: RuleAdjustment) {
  ruleForms[adj.ruleId] = {
    value: adj.suggestedValue,
    duration: adj.suggestedDuration,
  }
}

function resetForm(adj: RuleAdjustment) {
  ruleForms[adj.ruleId] = {
    value: adj.currentValue,
    duration: adj.currentDuration,
  }
}

function isFormDirty(adj: RuleAdjustment): boolean {
  const f = ruleForms[adj.ruleId]
  if (!f) return false
  return f.value !== adj.currentValue || f.duration !== adj.currentDuration
}

function displayUnit(unit: string) {
  return unit === '分钟' ? $t('IotSceneLinkage.unit.minutes') : unit
}

function alarmLevelLabel(level: IotDevice['alarms'][number]['payload']['level']) {
  if (level === '紧急') return $t('IotDeviceDetail.common.level.critical')
  if (level === '重要') return $t('IotDeviceDetail.common.level.major')
  return $t('IotDeviceDetail.common.level.info')
}

function onSnooze() {
  if (!props.todo) return
  emit('snooze', props.todo.id, $t('IotDeviceDetail.todoHandler.record.snoozed'))
  emit('update:open', false)
}

function onComplete(action = $t('DeviceAlarm.record.handled')) {
  if (!props.todo) return
  emit('complete', props.todo.id, action)
  emit('update:open', false)
}

async function onNotifyOwner() {
  if (!props.todo) return
  const firstDeviceId = props.todo.deviceIds[0]
  if (firstDeviceId) {
    await iotDeviceService.notifyOwner(props.projectId, firstDeviceId)
  }
  onComplete($t('IotDeviceDetail.todoHandler.action.notifyOwner'))
}

/* verify-alarm · 已派人到现场：进入“已分配”，表示已交由现场执行。 */
function onMarkDispatched() {
  onComplete($t('IotDeviceDetail.todoHandler.action.dispatched'))
}

function onObserve() {
  onComplete($t('IotDeviceDetail.todoHandler.action.observe'))
}

/* 主操作只负责产生日志动作文本；具体落到“已分配/待复核/已处理”
   由 adapter 统一按业务规则判定，避免 UI 层硬编码状态。 */
function onPrimaryAction() {
  if (!props.todo) return
  const action = (() => {
    switch (props.todo.actionKind) {
      case 'verify-alarm':
        return $t('IotDeviceDetail.todoHandler.record.confirmedNormal')
      case 'adjust-rule':
        return $t('IotDeviceDetail.todoHandler.record.adjustmentsApplied')
      case 'view-grouping':
        return $t('IotDeviceDetail.todoHandler.record.groupingAccepted')
      case 'diagnose':
      default:
        return $t('DeviceAlarm.record.handled')
    }
  })()
  onComplete(action)
}

async function onActionMenuSelect({ key }: { key: string }) {
  switch (key) {
    case 'snooze':
      onSnooze()
      return
    case 'notify':
      await onNotifyOwner()
      return
    case 'dispatch':
      onMarkDispatched()
      return
    case 'observe':
      onObserve()
      return
    case 'primary':
    default:
      onPrimaryAction()
  }
}

function onActionSelectChange(value: unknown) {
  selectedActionKey.value = String(value ?? '')
}

async function onExecuteSelectedAction() {
  if (!selectedActionKey.value) return
  await onActionMenuSelect({ key: selectedActionKey.value })
}

function onOpenModule() {
  if (!targetModule.value) return
  router.push(targetModule.value.path)
}
</script>

<style scoped>
/* stylelint-disable no-descending-specificity */
.todo-handler {
  display: grid;
  gap: 1.125rem;
  padding: 1rem 1.125rem;
}

.todo-handler__module-link {
  white-space: nowrap;
}

.todo-handler__action-select {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.todo-handler__action-select :deep(.ant-select) {
  min-width: 10.25rem;
}

.todo-handler__meta {
  display: grid;
  gap: var(--space-2);
}

.todo-handler__priority {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.todo-handler__source-pill {
  font-size: var(--fs-14);
  font-weight: 600;
  color: var(--jet-theme-text-disabled);
  border: 0.0625rem dashed var(--jet-theme-primary);
  border-radius: 62.4375rem;
  padding: calc(var(--space-1) / 2) var(--space-2);
}

.todo-handler__detail {
  margin: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-body);
  line-height: 1.6;
}

.todo-handler__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.875rem;
  margin: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.todo-handler__tags span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.todo-handler__tags :deep(svg) {
  width: 0.75rem;
  height: 0.75rem;
}

/* 段卡：drawer 内单层卡，符合宪法 §详情页排版 */
.todo-handler__section {
  display: grid;
  gap: var(--space-2);
  padding-top: 0.875rem;
  border-top: 0.0625rem solid var(--jet-theme-border);
}

.todo-handler__section header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.todo-handler__section header :deep(svg) {
  width: 0.8125rem;
  height: 0.8125rem;
  color: var(--jet-theme-primary);
}

.todo-handler__section h3 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.todo-handler__device-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.todo-handler__device-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
}

.todo-handler__device-list li:last-child {
  border-bottom: 0;
}

.todo-handler__device-list strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
}

.todo-handler__device-meta {
  grid-column: 1 / 2;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.todo-handler__records {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.todo-handler__records li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.25rem 0.75rem;
  padding: 0.625rem 0;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
}

.todo-handler__records li:last-child {
  border-bottom: 0;
}

.todo-handler__records strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
}

.todo-handler__records span {
  color: var(--jet-theme-text-disabled); font-size: var(--fs-14);
}

.todo-handler__records p {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.6;
}

.todo-handler__evidence {
  list-style: disc;
  padding-left: 1.125rem;
  margin: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.7;
  display: grid;
  gap: var(--space-1);
}

.todo-handler__alarms {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.todo-handler__alarms li {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  padding: 0.625rem 0;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
}

.todo-handler__alarms li:last-child {
  border-bottom: 0;
}

.todo-handler__alarms-time {
  color: var(--jet-theme-text-disabled); font-size: var(--fs-14);
}

.todo-handler__alarms strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
}

.todo-handler__alarms p {
  margin: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.55;
}

.todo-handler__alarms-level {
  font-size: var(--fs-14);
  font-weight: 600;
  padding: calc(var(--space-1) / 2) var(--space-2);
  border-radius: 62.4375rem;
}

.todo-handler__alarms-level[data-level='紧急'] { color: var(--jet-theme-error); background: var(--err-bg); }
.todo-handler__alarms-level[data-level='重要'] { color: var(--jet-theme-warning); background: var(--warn-bg); }
.todo-handler__alarms-level[data-level='提醒'] { color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }

.todo-handler__tip {
  margin: 0.375rem 0 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.55;
}

/* adjust-rule 表单 · 每条规则一个 form 卡片 */
.todo-handler__rule {
  display: grid;
  gap: var(--space-2);
  padding: 0.75rem 0.875rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
  margin-top: var(--space-3);
}

.todo-handler__rule > header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.25rem 0.625rem;
  margin-bottom: 0;
}

.todo-handler__rule > header strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
}

.todo-handler__rule > header span {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.todo-handler__rule-current {
  margin: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.5;
}

.todo-handler__rule-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 0.3125rem;
  margin: 0;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--jet-theme-radius-sm);
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.55;
}

.todo-handler__rule-suggestion :deep(svg) {
  width: 0.75rem;
  height: 0.75rem;
  margin-top: 0.125rem;
  color: var(--jet-theme-primary);
  flex-shrink: 0;
}

.todo-handler__rule-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.todo-handler__rule-fields label {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.todo-handler__rule-fields label > span {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-weight: 600;
}

.todo-handler__rule-input {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  padding: 0 0.625rem;
  background: var(--jet-theme-bg-container);
}

.todo-handler__rule-input:focus-within {
  border-color: var(--jet-theme-border-secondary);
  box-shadow: 0 0 0 0.1875rem var(--jet-theme-primary-soft);
}

.todo-handler__rule-input :deep(.ant-input-number) {
  width: 100%;
}

.todo-handler__rule-input :deep(.ant-input-number-input) { font-size: var(--fs-14);
  font-weight: 600;
}

.todo-handler__rule-input em {
  font-style: normal;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  flex-shrink: 0;
}

.todo-handler__rule-fields label > small {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14); }

.todo-handler__rule-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.todo-handler__rule-apply-suggestion {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.1875rem 0.625rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 62.4375rem;
  background: var(--jet-theme-bg-container);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  cursor: pointer;
  transition: all 0.12s;
}

.todo-handler__rule-apply-suggestion :deep(svg) {
  width: 0.6875rem;
  height: 0.6875rem;
  color: var(--jet-theme-primary);
}

.todo-handler__rule-apply-suggestion:hover {
  border-color: var(--jet-theme-primary);
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text);
}

.todo-handler__rule-reset {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 0.1875rem;
}

.todo-handler__rule-reset:hover {
  color: var(--jet-theme-text);
}

/* 升级 teaser */
/* v4.7：teaser block 现在仅作"敬请期待"占位，简化样式 */
.todo-handler__teaser {
  display: grid;
  gap: 0.375rem;
  padding: 0.875rem 1rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
}

.todo-handler__teaser header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-body);
  font-weight: 600;
}

.todo-handler__teaser header :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-text-disabled);
}

.todo-handler__teaser p {
  margin: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.6;
}

footer :deep(.ant-btn svg) {
  width: 0.8125rem;
  height: 0.8125rem;
}</style>
