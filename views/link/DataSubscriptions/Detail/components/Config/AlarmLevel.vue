<template>
  <div style="margin-top: 16px">
    <j-card-select
        :showImage="false"
        :options="levelList"
        v-model:value="selected"
        :column="5"
        multiple
    />
  </div>
</template>

<script setup>
import {queryLevel} from "@device/api/rule-engine/config";
import {onlyMessage} from "@jetlinks-web/utils";
import {useI18n} from "vue-i18n";

const props = defineProps({
  value: {
    type: Array,
    default: () => []
  },
});

const levelList = ref([])
const selected = ref([])
const {t: $t} = useI18n();
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

const onSave = () => {
  return new Promise((resolve) => {
    if (!selected.value.length) {
      onlyMessage($t('DataSubscriptions.Detail.index.697323-60'), 'error')
      return
    }
    resolve({
      terms: [
        {
          column: "level",
          termType: "in",
          value: selected.value
        }
      ],
      options: {
        name: levelList.value.filter(i => selected.value.includes(i.value)).map(i => i.label).join(',')
      }
    })
  });
};

watch(() => props.value, (val) => {
  selected.value = val
}, {
  immediate: true,
  deep: true,
})

defineExpose({onSave})
</script>

<style lang="less" scoped>

</style>
