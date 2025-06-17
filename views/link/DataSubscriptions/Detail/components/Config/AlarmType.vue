<template>
  <div style="margin-top: 16px">
    <j-card-select
        :showImage="false"
        :options="levelList"
        :column="5"
        v-model:value="selected"
        multiple
    />
  </div>
</template>

<script setup>
import {getTargetTypes} from "@device/api/rule-engine/config";
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

const onSave = () => {
  return new Promise((resolve) => {
    if (!selected.value.length) {
      onlyMessage($t('DataSubscriptions.Detail.index.697323-60'), 'error')
      return
    }
    resolve({
      terms: [
        {
          column: "targetType",
          termType: "in",
          value: selected.value
        }
      ],
      options: {
        typeName: levelList.value.filter(i => selected.value.includes(i.value)).map(i => i.label).join(',')
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
