<template>
  <div style="margin-top: 16px">
    <j-card-select
        :showImage="false"
        :options="levelList"
        :column="5"
        v-model:aria-valuemax="selected"
    />
  </div>
</template>

<script setup>
import {getTargetTypes} from "@device/api/rule-engine/config";

const levelList = ref([])
const selected = ref()

const handleSearch = async () => {
  const resp = await getTargetTypes()
  if(resp.success){
    levelList.value = resp.result.map((item) => ({
      ...item,
      label: item.name,
      value: item.id,
    }))
  }
}

onMounted(() => {
  handleSearch()
})
</script>

<style lang="less" scoped>

</style>
