<template>
    <a-form ref="formRef" :model="modelRef">
        <a-table
            :columns="columns"
            :data-source="modelRef.dataSource"
            :pagination="false"
        >
            <template #bodyCell="{ column, text, record, index }">
                <div>
                    <template
                        v-if="['name'].includes(column.dataIndex)"
                    >
                        <span>{{ text }}</span>
                    </template>
                    <template v-else-if="['valueType'].includes(column.dataIndex)">
                        <span>{{ text.type }}</span>
                    </template>
                    <template v-else>
                        <a-form-item
                            :name="['dataSource', index, 'value']"
                            :rules="[
                                {
                                    required: !!record.required,
                                    message: '该字段为必填字段',
                                },
                            ]"
                        >
                            <j-value-item
                                v-model:modelValue="record.value"
                                :itemType="record.valueType.type"

                                :options="
                                    record.valueType.type === 'enum'
                                        ? (
                                              record?.valueType?.elements || []
                                          ).map((item) => {
                                              return {
                                                  label: item.text,
                                                  value: item.value,
                                              };
                                          })
                                        : record.valueType.type  === 'boolean'
                                        ? [
                                              { label: '是', value: true },
                                              { label: '否', value: false },
                                          ]
                                        : undefined
                                "
                            />
                        </a-form-item>
                    </template>
                </div>
            </template>
        </a-table>
    </a-form>
</template>

<script lang="ts" setup>
import { PropType } from 'vue';

type Emits = {
    (e: 'update:modelValue', data: Record<string, any>[]): void;
};
const _emit = defineEmits<Emits>();

const _props = defineProps({
    modelValue: {
        type: Array as PropType<Record<string, any>[]>,
        default: '',
    },
});
const columns = [
    {
        title: '参数名称',
        dataIndex: 'name',
        with: '33%',
    },
    {
        title: '类型',
        dataIndex: 'valueType',
        with: '33%',
    },
    {
        title: '值',
        dataIndex: 'value',
        with: '34%',
    },
];

const modelRef = reactive<{
    dataSource: any[];
}>({
    dataSource: [],
});

const formRef = ref<any>(null);

watchEffect(() => {
    modelRef.dataSource = _props?.modelValue || []
    console.log(modelRef.dataSource);
})

const onSave = () =>
    new Promise((resolve, reject) => {
        formRef.value?.validate().then((_data: any) => {
            _emit('update:modelValue', modelRef.dataSource)
            resolve(true);
        }).catch(() => {
            reject(false)
        })
    });

defineExpose({ onSave });
</script>

<style lang="less" scoped>
:deep(.ant-form-item) {
    margin: 0 !important;
    height: 30px;
}
</style>
