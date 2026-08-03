<template>
  <j-page-container>
    <div class="iot-device-detail-page">
      <Suspense>
        <IotDeviceDetailView />
        <template #fallback>
          <div class="iot-device-detail-page__loading">
            <a-spin />
          </div>
        </template>
      </Suspense>
    </div>
  </j-page-container>
</template>

<script setup lang="ts">
import IotDeviceDetailView from '../components/IotDeviceDetailView.vue'
import { useDeviceDetailAgent } from '../agent/useDeviceDetailAgent'

useDeviceDetailAgent()
</script>

<style src="../styles/design-primitives.css"></style>

<style scoped>
.iot-device-detail-page {
  width: 100%;
}

.iot-device-detail-page__loading {
  display: grid;
  place-items: center;
  min-height: 15rem;
}</style>
