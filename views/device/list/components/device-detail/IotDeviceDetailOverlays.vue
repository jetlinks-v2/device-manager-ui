<template>
  <IotTodoHandlerDrawer
      v-model:open="todoHandlerOpen"
      :todo="handlingTodo"
      :project-id="projectId"
      :all-devices="workbench?.devices ?? []"
      :busy="todoBusyId === handlingTodo?.id"
      @complete="onCompleteTodo"
      @snooze="onSnoozeTodo"
    />
  
    <IotAddDeviceDrawer
      v-model:open="editDrawerOpen"
      :project-id="projectId"
      :device="device"
      @saved="onDeviceSaved"
    />
  
    <IotDeviceTagEditorModal
      v-model:open="tagEditorOpen"
      :tags="thingModelTags"
      :saving="savingTags"
      @save="saveTags"
    />
  
    <JlDrawerShell
      :open="ruleInfoOpen"
      :width="440"
      icon="BranchesOutlined"
      :title="ruleInfoTitle"
      :sub="ruleInfoSub"
      @update:open="(value) => { ruleInfoOpen = value; if (!value) activeRuleTodo = null }"
    >
      <div class="dd-rule-panel">
        <p v-if="activeRuleTodo" class="dd-rule-panel__summary">
          {{ activeRuleTodo.detail }}
        </p>
        <ul v-if="activeRuleRows.length" class="dd-rules">
          <li v-for="rule in activeRuleRows" :key="rule.id">
            <div>
              <strong>{{ rule.name }}</strong>
              <small>{{ rule.trigger }}</small>
            </div>
            <p>{{ rule.action }}</p>
            <IotDeviceStatusPill :label="rule.status" :risk="rule.status === '建议调整' ? 'watch' : 'normal'" />
          </li>
        </ul>
        <CloudEmpty v-else class="dd-empty" :description="$t('IotDeviceDetail.detail.emptyRelatedRule')" />
      </div>
      <template #foot>
        <a-button @click="ruleInfoOpen = false; activeRuleTodo = null">{{ $t('IotDeviceDetail.common.close') }}</a-button>
      </template>
    </JlDrawerShell>
</template>

<script setup lang="ts">
import { toRefs, type PropType } from 'vue'
import JlDrawerShell from '../common/JlDrawerShell.vue'
import IotAddDeviceDrawer from '../IotAddDeviceDrawer.vue'
import IotDeviceTagEditorModal from '../IotDeviceTagEditorModal.vue'
import IotDeviceStatusPill from '../IotDeviceStatusPill.vue'
import IotTodoHandlerDrawer from '../IotTodoHandlerDrawer.vue'
import type { IotDeviceDetailViewState } from '../../hooks/useIotDeviceDetailView'

/** 详情编辑与待办处置弹层，由页面状态统一驱动。 */
type ViewState = Pick<IotDeviceDetailViewState,
  '$t' |
  'projectId' |
  'device' |
  'workbench' |
  'todoHandlerOpen' |
  'handlingTodo' |
  'todoBusyId' |
  'ruleInfoOpen' |
  'activeRuleTodo' |
  'savingTags' |
  'tagEditorOpen' |
  'editDrawerOpen' |
  'onDeviceSaved' |
  'thingModelTags' |
  'saveTags' |
  'activeRuleRows' |
  'ruleInfoTitle' |
  'ruleInfoSub' |
  'onCompleteTodo' |
  'onSnoozeTodo'
>
const props = defineProps({ state: { type: Object as PropType<ViewState>, required: true } })
const {
  $t,
  projectId,
  device,
  workbench,
  todoHandlerOpen,
  handlingTodo,
  todoBusyId,
  ruleInfoOpen,
  activeRuleTodo,
  savingTags,
  tagEditorOpen,
  editDrawerOpen,
  onDeviceSaved,
  thingModelTags,
  saveTags,
  activeRuleRows,
  ruleInfoTitle,
  ruleInfoSub,
  onCompleteTodo,
  onSnoozeTodo,
} = toRefs(props.state)
</script>

<style scoped src="../../styles/IotDeviceDetailOverlays.css"></style>
