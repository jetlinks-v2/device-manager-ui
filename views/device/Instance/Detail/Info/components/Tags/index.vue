<template>
    <div style="margin-top: 20px">
        <a-descriptions bordered :labelStyle="{width: '150px'}">
            <template #title>
                {{$t('Operator.index.745665-15')}}
                <j-permission-button
                    type="link"
                    @click="visible = true"
                    hasPermission="device/Instance:update"
                >
                    <AIcon type="EditOutlined" />{{ $t('Product.index.660348-13') }}
                </j-permission-button>
            </template>
            <a-descriptions-item
                :span="1"
                v-for="item in dataSource"
                :key="item.key"
            >
                <template #label>
                    <j-ellipsis>{{ `${item.name}（${item.key})` }}</j-ellipsis>
                </template>
                <j-ellipsis>{{ findName(item) }}</j-ellipsis>
            </a-descriptions-item>
        </a-descriptions>
        <Save v-if="visible" @close="visible = false" @save="saveBtn" />
    </div>
</template>

<script lang="ts" setup>
import { useInstanceStore } from '../../../../../../../store/instance';
import Save from './Save.vue';

const instanceStore = useInstanceStore();

const dataSource = ref<Record<any, any>[]>([]);
const visible = ref<boolean>(false);

watchEffect(() => {
    const arr = instanceStore.current?.tags || [];
    dataSource.value = arr as Record<any, any>[];
});

const saveBtn = () => {
    visible.value = false;
    if (instanceStore.current.id) {
        instanceStore.refresh(instanceStore.current.id);
    }
};

const findName = (item: any) => {
  let name = undefined
  if (item.dataType) {
    let arr = item.dataType?.elements || []
    if(item.dataType?.type === 'boolean'){
      arr = [
        {
          text: item.dataType.trueText,
          value: item.dataType.trueValue,
        },
        {
          text: item.dataType.falseText,
          value: item.dataType.falseValue,
        }
      ]
    }
    const _element = arr?.find((a: any) => a.value === item.value)
    name = _element?.text
  }
  return name || item.value
}
</script>
