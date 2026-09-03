<template>
  <j-page-container>
    <div class="iot-device-page">
      <Suspense>
        <IotDeviceAssetListView />
        <template #fallback>
          <div class="iot-device-page__loading">
            <a-spin />
          </div>
        </template>
      </Suspense>
    </div>
  </j-page-container>
</template>

<script setup lang="ts">
import IotDeviceAssetListView from './components/IotDeviceAssetListView.vue'
</script>

<style src="./styles/design-primitives.css"></style>
<style scoped lang="less">
.iot-device-page {
  width: 100%;
	background: color-mix(in srgb, var(--jet-theme-bg-container) 70%, transparent);
	border-radius: var(--r-4);
}

.iot-device-page__loading {
  display: grid;
  place-items: center;
  min-height: 15rem;
}</style>
