<template>
  <j-page-container>
    <main class="iot-groups-route">
      <IotDeviceGroupsView />
    </main>
  </j-page-container>
</template>

<script setup lang="ts">
import IotDeviceGroupsView from './components/IotDeviceGroupsView.vue'
</script>

<style scoped>
.iot-groups-route {
  display: grid;
  min-width: 0;
}
</style>
