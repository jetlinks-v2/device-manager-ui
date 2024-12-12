<template>
    <a-modal
        :title="$t('Tags.Save.446332-0')"
        :width="1000"
        :visible="true"
        :confirmLoading="loading"
        @ok="handleOk"
        @cancel="handleCancel"
    >
        <a-table
            rowKey="id"
            :columns="columns"
            :data-source="dataSource"
            bordered
            :pagination="false"
        >
            <template #bodyCell="{ column, text, record }">
                <div style="width: 280px">
                    <template v-if="['key', 'name'].includes(column.dataIndex)">
                        <j-ellipsis>{{ text }}</j-ellipsis>
                    </template>
                    <template v-else>
                        <j-value-item
                            v-model:modelValue="record.value"
                            :itemType="record.type"
                            :options="
                                record.type === 'enum'
                                    ? (record?.dataType?.elements || []).map(
                                          (item) => {
                                              return {
                                                  label: item.text,
                                                  value: item.value,
                                              };
                                          },
                                      )
                                    : record.type === 'boolean'
                                    ? [
                                          { label: record?.dataType?.trueText, value: record?.dataType?.trueValue },
                                          { label: record?.dataType?.falseText, value: record?.dataType?.falseValue },
                                      ]
                                    : undefined
                            "
                        />
                    </template>
                </div>
            </template>
        </a-table>
    </a-modal>
</template>

<script lang="ts" setup>
import { useInstanceStore } from '../../../../../../../store/instance';
import { cloneDeep } from 'lodash-es';
import { saveTags, delTags } from '../../../../../../../api/instance';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const emit = defineEmits(['close', 'save']);

const columns = [
    {
        title: 'ID',
        dataIndex: 'key',
        with: '33%',
    },
    {
        title: $t('Product.index.660348-28'),
        dataIndex: 'name',
        with: '33%',
    },
    {
        title: $t('Properties.OtherSetting.237457-26'),
        dataIndex: 'value',
        with: '34%',
    },
];
const instanceStore = useInstanceStore();

const dataSource = ref<Record<any, any>[]>([]);
const loading = ref(false)

watchEffect(() => {
    const arr = instanceStore.current?.tags || [];
    dataSource.value = cloneDeep(arr);
});

const handleOk = async () => {
    if (dataSource.value.length) {
        loading.value = true
        const list = (dataSource.value || [])
            .filter((item: any) => item?.key && (item?.value !== undefined && item?.value !== null))
            .map((i: any) => {
                const { dataType, ...extra } = i;
                return { ...extra };
            });
        if (list.length) {
            // 填值
            const resp = await saveTags(instanceStore.current?.id || '', list).finally(()=>{
                loading.value = false
            });
            if (resp.status === 200) {
                onlyMessage($t('Product.index.660348-18'));
            }
        }
        const _list = (dataSource.value || []).filter((item: any) => item?.key && (item?.value === undefined || item?.value === null));
        if (_list.length) {
            // 删除值
            _list.map(async (item: any) => {
                if (item.id) {
                    await delTags(instanceStore.current?.id || '', item.id).catch(()=>{
                        loading.value = false
                    });
                }
            });
        }
        setTimeout(() => {
            loading.value = false
            emit('save');
        }, 1000)
    } else {
        emit('close');
    }
};

const handleCancel = () => {
    emit('close');
};
</script>
