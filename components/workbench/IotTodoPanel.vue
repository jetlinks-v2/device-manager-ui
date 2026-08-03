<template>
  <section class="todo-panel" :aria-label="$t('IotWorkbench.todos.aria')">
    <header class="overview-section-head todo-panel__head">
      <h3>{{ $t('IotWorkbench.todos.title') }}</h3>
      <div class="todo-panel__stats" :aria-label="$t('IotWorkbench.todos.statsAria')">
        <span><strong>{{ pending }}</strong> {{ $t('IotWorkbench.todos.pending') }}</span>
      </div>
    </header>

    <div v-if="rows.length" class="todo-list">
      <article
        v-for="todo in rows"
        :key="todo.id"
        class="todo-row"
        role="button"
        tabindex="0"
        @click="emit('open', todo)"
        @keydown.enter.prevent="emit('open', todo)"
        @keydown.space.prevent="emit('open', todo)"
      >
        <div class="todo-row__badges">
          <span class="todo-row__type" :data-kind="riskKind(todo)">
            {{ riskKindLabel(todo) }}
          </span>
          <span class="todo-row__priority" :data-priority="todo.priority">
            {{ priorityLabel(todo) }}
          </span>
        </div>

        <div class="todo-row__main">
          <h4>{{ title(todo) }}</h4>
          <p>{{ detail(todo) }}</p>
          <div class="todo-row__meta">
            <span>{{ deviceLabel(todo) }}</span>
            <span>{{ todo.ownerLabel }}</span>
          </div>
        </div>

        <div class="todo-row__side">
          <a-button type="primary" ghost size="small" @click.stop="emit('open', todo)">
            <AIcon :type="'ArrowRightOutlined'" aria-hidden="true" />
            {{ todo.actionLabel || $t('IotWorkbench.todos.action') }}
          </a-button>
        </div>
      </article>
    </div>

    <CloudEmpty v-else class="todo-empty" :description="$t('IotWorkbench.todos.empty')" />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { IotDeviceTodo, IotRiskKind } from '../../types'

defineProps<{
  rows: IotDeviceTodo[]
  pending: number
  riskKind: (todo: IotDeviceTodo) => IotRiskKind
  riskKindLabel: (todo: IotDeviceTodo) => string
  priorityLabel: (todo: IotDeviceTodo) => string
  title: (todo: IotDeviceTodo) => string
  detail: (todo: IotDeviceTodo) => string
  deviceLabel: (todo: IotDeviceTodo) => string
}>()

const emit = defineEmits<{
  open: [todo: IotDeviceTodo]
}>()

const { t: $t } = useI18n()
</script>
