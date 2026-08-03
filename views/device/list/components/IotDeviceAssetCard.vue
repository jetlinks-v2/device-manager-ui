<template>
  <EntityCard class="asset-device-card" :interactive="false">
    <template #icon>
      <figure class="asset-device-card__media">
        <img :src="imageUrl" :alt="$t('IotDeviceList.imageAlt', { name: device.name })" loading="lazy" @error="$emit('image-error', $event)">
      </figure>
    </template>
    <template #title>
      <a-button type="link" class="asset-device-card__name" @click="$router.push(detailPath)">
        {{ device.name }}
      </a-button>
    </template>
    <template #badges>
      <IotDeviceStatusPill :label="status.label" :tone="status.tone" />
    </template>
    <template #subtitle>
      <span class="asset-device-card__location">{{ device.area || '--' }} · {{ device.scenario || '--' }}</span>
    </template>
    <template #body>
      <div class="asset-device-card__facts">
        <span>
          <small>{{ $t('IotDeviceDetail.assetCard.deviceId') }}</small>
          <code>{{ device.identifier }}</code>
        </span>
        <span>
          <small>{{ $t('IotDeviceDetail.assetCard.deviceTemplate') }}</small>
          <strong>{{ device.productName }}</strong>
        </span>
        <span>
          <small>{{ $t('IotDeviceDetail.assetCard.owner') }}</small>
          <strong>{{ device.owner || '--' }}</strong>
        </span>
        <span>
          <small>{{ $t('IotDeviceDetail.assetCard.lastReport') }}</small>
          <strong>{{ lastSeenText }}</strong>
        </span>
      </div>
      <div v-if="device.tags.length" class="asset-device-card__tags">
        <span v-for="tag in device.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
      </div>
    </template>
    <template #footer>
      <div class="asset-device-card__footer-meta">
        <span class="alarm-cell" :data-risk="device.risk">{{ alarmText }}</span>
        <span>{{ device.deviceType }}</span>
      </div>
      <div class="asset-device-card__footer-actions">
        <a-button size="small" @click="$router.push(detailPath)">
          {{ $t('IotDeviceDetail.assetCard.detail') }}
        </a-button>
        <a-popover :open="actionMenuOpen" trigger="click" placement="bottomRight" @openChange="actionMenuOpen = $event">
          <template #content>
            <div class="asset-more-popover" role="menu" :aria-label="$t('IotDeviceDetail.assetCard.menuAria')" @click.stop>
              <a-button type="text" block role="menuitem" :disabled="actionBusy" @click="handleEdit">{{ $t('IotDeviceDetail.assetCard.edit') }}</a-button>
              <a-button type="text" block role="menuitem" :disabled="actionBusy" @click="handleToggleEnabled">
                {{ disabled ? $t('IotDeviceDetail.assetCard.enable') : $t('IotDeviceDetail.assetCard.disable') }}
              </a-button>
              <a-button
                type="text"
                danger
                block
                role="menuitem"
                :disabled="actionBusy || !canDelete"
                :title="canDelete ? undefined : $t('IotDeviceDetail.assetCard.disableBeforeDelete')"
                @click="handleDelete"
              >
                {{ $t('IotDeviceDetail.assetCard.delete') }}
              </a-button>
            </div>
          </template>
          <a-button size="small" @click.stop>{{ $t('IotDeviceDetail.assetCard.more') }}</a-button>
        </a-popover>
      </div>
    </template>
  </EntityCard>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'

import IotDeviceStatusPill from './IotDeviceStatusPill.vue'
import type { IotDevice } from '../types'

type PillTone = 'ok' | 'warn' | 'err' | 'info' | 'muted'

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  detailPath: { type: String, required: true },
  imageUrl: { type: String, required: true },
  status: { type: Object as PropType<{ label: string; tone: PillTone }>, required: true },
  alarmText: { type: String, required: true },
  lastSeenText: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  actionBusy: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'image-error', event: Event): void
  (e: 'edit', device: IotDevice): void
  (e: 'toggle-enabled', device: IotDevice): void
  (e: 'delete', device: IotDevice): void
}>()

const actionMenuOpen = ref(false)

function closeActionMenu() {
  actionMenuOpen.value = false
}

function handleEdit() {
  closeActionMenu()
  emit('edit', props.device)
}

function handleToggleEnabled() {
  closeActionMenu()
  emit('toggle-enabled', props.device)
}

function handleDelete() {
  closeActionMenu()
  emit('delete', props.device)
}
</script>

<style scoped>
.asset-device-card { height: 100%; min-height: 100%; width: 100%; }
.asset-device-card :deep(.ec-top) { align-items: center; }
.asset-device-card :deep(.ec-body) { display: grid; gap: var(--space-4); }
.asset-device-card :deep(.ec-footer) {
  gap: var(--space-3);
  flex-wrap: wrap;
}
.asset-device-card__media {
  width: 9rem;
  height: 5.5rem;
  margin: 0;
  overflow: hidden;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
  flex-shrink: 0;
}
.asset-device-card__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.asset-device-card__name { color: var(--jet-theme-text); text-decoration: none; }
.asset-device-card__name:hover { color: var(--jet-theme-primary); }
.asset-device-card__location {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-device-card__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-5);
}
.asset-device-card__facts span {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}
.asset-device-card__facts small { color: var(--jet-theme-text-disabled); font-size: var(--fs-14); }
.asset-device-card__facts strong,
.asset-device-card__facts code {
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 500;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-device-card__facts code { color: var(--jet-theme-text-secondary); }
.asset-device-card__tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.asset-device-card__tags span {
  max-width: 8rem;
  overflow: hidden;
  padding: var(--space-1) var(--space-3);
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius-sm);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-device-card__footer-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}
.asset-device-card__footer-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}
.alarm-cell { color: var(--jet-theme-text-disabled); }
.alarm-cell[data-risk='urgent'] {
  color: var(--jet-theme-error);
  font-weight: 600;
}
.alarm-cell[data-risk='watch'] {
  color: var(--jet-theme-warning);
  font-weight: 600;
}
.asset-more-popover {
  display: grid;
  width: 8.75rem;
  gap: var(--space-1);
}
@media (width <= 53.75rem) {
  .asset-device-card :deep(.ec-top) { align-items: flex-start; }
  .asset-device-card__media {
    width: 7rem;
    height: 4.375rem;
  }
  .asset-device-card__facts { grid-template-columns: minmax(0, 1fr); }
}
</style>
