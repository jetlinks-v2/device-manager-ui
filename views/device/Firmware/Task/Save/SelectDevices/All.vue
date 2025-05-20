<template>
  <DeviceTable ref="tableRef" type="All" />
</template>

<script setup>
import DeviceTable from './DeviceTable.vue';

const tableRef = ref()
const onSave = () => {
  return new Promise((resolve, reject) => {
    tableRef.value
        .onSave()
        .then((dt) => {
          resolve(dt);
        })
        .catch((err) => {
          reject(err);
        });
  });
};

defineExpose({ onSave })
</script>

<style lang="less" scoped>

</style>
