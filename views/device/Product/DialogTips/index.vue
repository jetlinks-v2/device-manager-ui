<template>
  <a-modal :open="open" :mask-closable="false" :footer="null" width="640px" @cancel="skip">
    <section class="product-created-guide">
      <header class="product-created-guide__header">
        <span class="product-created-guide__icon"><AIcon type="CheckCircleFilled" /></span>
        <div>
          <h2>{{ $t('DialogTips.index.379211-0') }}</h2>
          <p>{{ $t('DialogTips.index.379211-13', { name: productName || productId }) }}</p>
        </div>
      </header>

      <ol class="product-created-guide__steps">
        <li v-for="step in steps" :key="step.key" :class="['product-created-guide__step', { 'is-ready': step.ready, 'is-complete': step.complete }]">
          <span class="product-created-guide__step-number"><AIcon v-if="step.complete" type="CheckOutlined" />{{ step.complete ? '' : step.order }}</span>
          <div class="product-created-guide__step-content">
            <a-flex align="center" justify="space-between" :gap="16">
              <strong>{{ $t(step.title) }}</strong>
              <a-tooltip :title="step.ready ? undefined : $t(step.reason)">
                <a-button :type="step.key === 'access' && step.ready ? 'primary' : 'default'" :disabled="!step.ready || step.complete" :loading="step.key === 'enable' && enablingProduct" @click="emitStep(step.key)">
                  {{ $t(step.complete ? 'DialogTips.index.379211-24' : step.action) }}
                </a-button>
              </a-tooltip>
            </a-flex>
            <p>{{ $t(step.complete ? 'DialogTips.index.379211-25' : step.description) }}</p>
          </div>
        </li>
      </ol>

      <footer class="product-created-guide__footer">
        <a-button type="text" @click="skip">{{ $t('DialogTips.index.379211-23') }}</a-button>
        <a-button type="primary" @click="defer">{{ $t('DialogTips.index.379211-17') }}</a-button>
      </footer>
    </section>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  productId: { type: String, default: '' },
  productName: { type: String, default: '' },
  accessConfigured: { type: Boolean, default: false },
  metadataSaved: { type: Boolean, default: false },
  productEnabled: { type: Boolean, default: false },
  enablingProduct: { type: Boolean, default: false },
  showBatchImport: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'configure-access'): void
  (event: 'configure-metadata'): void
  (event: 'enable-product'): void
  (event: 'add-device'): void
  (event: 'batch-import'): void
  (event: 'skip'): void
  (event: 'defer'): void
}>()

const steps = computed(() => {
  const accessDone = props.accessConfigured
  const enabled = props.productEnabled
  return [
    { key: 'access', order: 1, title: 'DialogTips.index.379211-5', description: 'DialogTips.index.379211-6', action: 'DialogTips.index.379211-14', reason: '', ready: true, complete: accessDone },
    { key: 'metadata', order: 2, title: 'DialogTips.index.379211-18', description: 'DialogTips.index.379211-19', action: 'DialogTips.index.379211-20', reason: 'DialogTips.index.379211-22', ready: accessDone, complete: props.metadataSaved },
    { key: 'enable', order: 3, title: 'DialogTips.index.379211-21', description: 'DialogTips.index.379211-26', action: 'DialogTips.index.379211-27', reason: 'DialogTips.index.379211-22', ready: accessDone, complete: enabled },
    { key: 'device', order: 4, title: 'DialogTips.index.379211-7', description: 'DialogTips.index.379211-8', action: 'DialogTips.index.379211-15', reason: 'DialogTips.index.379211-28', ready: enabled, complete: false },
    ...(props.showBatchImport ? [{ key: 'import', order: 5, title: 'DialogTips.index.379211-11', description: 'DialogTips.index.379211-12', action: 'DialogTips.index.379211-16', reason: 'DialogTips.index.379211-28', ready: enabled, complete: false }] : []),
  ]
})

function emitStep(key: string) {
  if (key === 'access') emit('configure-access')
  if (key === 'metadata') emit('configure-metadata')
  if (key === 'enable') emit('enable-product')
  if (key === 'device') emit('add-device')
  if (key === 'import') emit('batch-import')
}

function skip() {
  emit('skip')
}

function defer() {
  emit('defer')
}
</script>

<style lang="less" scoped>
.product-created-guide { padding: var(--space-2) 0 0; }
.product-created-guide__header { display: flex; align-items: flex-start; gap: var(--space-3); padding-bottom: var(--space-5); border-bottom: 1px solid var(--border-color-split, #f0f0f0); }
.product-created-guide__icon { display: grid; flex: 0 0 auto; place-items: center; width: 36px; height: 36px; color: var(--ant-color-success, #52c41a); font-size: 28px; }
.product-created-guide__header h2 { margin: 0; color: var(--text-color, rgba(0, 0, 0, .88)); font-size: 18px; line-height: 1.5; }
.product-created-guide__header p, .product-created-guide__step p { margin: 4px 0 0; color: var(--text-color-secondary, rgba(0, 0, 0, .45)); line-height: 1.6; }
.product-created-guide__steps { display: grid; gap: var(--space-3); padding: var(--space-5) 0; margin: 0; list-style: none; }
.product-created-guide__step { display: flex; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border-color-split, #f0f0f0); border-radius: 8px; opacity: .58; }
.product-created-guide__step.is-ready { opacity: 1; }
.product-created-guide__step.is-ready:not(.is-complete) { border-color: var(--ant-color-primary-border, #91caff); background: var(--ant-color-primary-bg, #e6f4ff); }
.product-created-guide__step.is-complete { opacity: 1; background: var(--ant-color-success-bg, #f6ffed); }
.product-created-guide__step-number { display: grid; flex: 0 0 auto; place-items: center; width: 24px; height: 24px; color: var(--ant-color-primary, #1677ff); background: var(--ant-color-primary-bg, #e6f4ff); border-radius: 50%; font-weight: 600; }
.is-complete .product-created-guide__step-number { color: var(--ant-color-success, #52c41a); background: var(--ant-color-success-bg, #f6ffed); }
.product-created-guide__step-content { flex: 1; min-width: 0; }
.product-created-guide__step-content :deep(.ant-btn) { width: 5.25rem; text-align: center; }
.product-created-guide__footer { display: flex; justify-content: flex-end; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border-color-split, #f0f0f0); }
</style>
