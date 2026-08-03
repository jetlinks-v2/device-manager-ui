<template>
  <j-page-container>
    <main class="iot-health-route">
      <Suspense>
        <IotDeviceHealthView />
        <template #fallback>
          <div class="iot-health-route__loading">
            <a-spin />
          </div>
        </template>
      </Suspense>
    </main>
  </j-page-container>
</template>

<script setup lang="ts">
import IotDeviceHealthView from './components/IotDeviceHealthView.vue'
</script>

<style scoped>
.iot-health-route {
  display: grid;
}

.iot-health-route__loading {
  display: grid;
  place-items: center;
  min-height: 15rem;
}
</style>
