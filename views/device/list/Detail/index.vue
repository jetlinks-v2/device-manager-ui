<template>
  <j-page-container>
    <div class="iot-device-detail-page">
      <Suspense>
        <IotDeviceDetailView :key="String(route.params.deviceId || route.params.id)" />
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
import { useRoute } from 'vue-router'

// 切换设备时重建各内容宿主，旧请求与旧设备页签不带入新设备。
const route = useRoute()
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
