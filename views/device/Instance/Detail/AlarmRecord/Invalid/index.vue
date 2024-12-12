<template>
    <pro-search
        :columns="columns"
        target="device-instance"
        @search="handleSearch"
    ></pro-search>
    <JProTable
        ref="deviceAlarm"
        :columns="columns"
        mode="TABLE"
        :request="queryInvalidData"
        :defaultParams="{
            sorts: [{ name: 'createTime', order: 'desc' }],
            terms: [
                {
                    terms: [
                        {
                            column:
                                props.goal === 'device'
                                    ? 'thingId'
                                    : 'templateId',
                            value: current.id,
                            termType: 'eq',
                        },
                    ],
                    type: 'and',
                },
            ],
        }"
        :params="params"
        ><template #createTime="slotProps">
            {{ dayjs(slotProps.createTime).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
        <template #thingName="slotProps">
            <j-ellipsis>
                {{ $t('Invalid.index.031367-0') }}
                <span
                    class="deviceId"
                     @click="() => gotoDevice(slotProps.thingId)"
                    >{{ slotProps.thingName }}</span
                ></j-ellipsis
            >
        </template>
    </JProTable>
</template>

<script setup>
import { queryInvalidData } from '../../../../../../api/rule-engine/log';
import { useInstanceStore } from '../../../../../../store/instance';
import { useProductStore } from '../../../../../../store/product';
import { useMenuStore } from '@/store';
import dayjs from 'dayjs';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
    goal: {
        type: String,
        default: 'device',
    },
});
const menuStory = useMenuStore();
const { current } =
    props.goal === 'device' ? useInstanceStore() : useProductStore();
const columns = props.goal === 'device' ? [
    {
        title: $t('Invalid.index.031367-1'),
        dataIndex: 'createTime',
        key: 'createTime',
        scopedSlots: true,
        search: {
            type: 'date',
        },
    },
    {
        title: $t('Invalid.index.031367-2'),
        dataIndex: 'description',
        key: 'description',
    },
    {
        title: $t('Invalid.index.031367-3'),
        dataIndex: 'value',
        key: 'value',
        search: {
            type: 'string',
        },
    },
] : [
    {
        title: $t('Invalid.index.031367-1'),
        dataIndex: 'createTime',
        key: 'createTime',
        scopedSlots: true,
        search: {
            type: 'date',
        },
    },
    {
        title: $t('Invalid.index.031367-4'),
        dataIndex: 'thingName',
        key: 'thingName',
        scopedSlots: true,
        search: {
            type: 'string',
        },
    },
    {
        title: $t('Invalid.index.031367-2'),
        dataIndex: 'description',
        key: 'description',
    },
    {
        title: $t('Invalid.index.031367-3'),
        dataIndex: 'value',
        key: 'value',
        search: {
            type: 'string',
        },
    },
]

const gotoDevice = (id) => {
    menuStory.jumpPage('device/Instance/Detail', { params: { id, tab: 'Running' }});
};
const handleSearch = (e) => {
    params.value = e;
};
const params = ref();
</script>
<style lang="less" scoped>
.deviceId {
    cursor: pointer;
    color:#4096FF;
}
</style>

