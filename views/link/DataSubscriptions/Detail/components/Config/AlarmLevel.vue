<template>
  <div style="margin-top: 16px">
    <j-card-select
        :showImage="false"
        :options="levelList"
        v-model:aria-valuemax="selected"
        :column="5"
    />
  </div>
</template>

<script setup>
import {queryLevel} from "@device/api/rule-engine/config";

const levelList = ref([])
const selected = ref()

const handleSearch = async () => {
  const resp = await queryLevel()
  if(resp.success){
    levelList.value = resp.result.levels.map((item) => ({
      label: item.title,
      value: item.level,
    }))
  }
}

onMounted(() => {
  handleSearch()
})
</script>

<style lang="less" scoped>

</style>
