<template>
    <ConditionFilter
        v-model="filterTerms"
        :fields="filterFields"
        :common-fields="commonFilterFields"
        :placeholder="$t('IotDeviceList.filter.conditionPlaceholder')"
        @change="handleSearch"
    />
    <JProTable
        ref="deviceAlarm"
        :class="{ 'product-invalid-table': props.type === 'product' }"
        :columns="columns"
        mode="TABLE"
        :request="queryInvalidRows"
        :bodyStyle="props.type === 'product' ? { padding: 0 } : undefined"
        :defaultParams="{ sorts: [{ name: 'createTime', order: 'desc' }] }"
        :params="tableParams"
    >
        <template #createTime="slotProps">
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

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { queryInvalidData } from '@device-manager-ui/api/rule-engine/log';
import { useInstanceStore } from '@device-manager-ui/store/instance';
import { useProductStore } from '@device-manager-ui/store/product';
import { buildIotDeviceDetailPath, resolveIotProjectId } from '@device-manager-ui/views/device/list/hooks/useIotDeviceRouting';
import ConditionFilter, {
    buildQueryFilter,
    type ConditionFilterField,
    type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter';
import dayjs from 'dayjs';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
  type: {
        type: String,
        default: 'device',
    },
});
const route = useRoute();
const router = useRouter();
const instanceStore = useInstanceStore();
const productStore = useProductStore();
const current = computed(() =>
    props.type === 'device' ? instanceStore.current : productStore.current,
);
const columns = props.type === 'device' ? [
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

const filterFields = computed<ConditionFilterField[]>(() => columns.map((column) => ({
    title: column.title,
    dataIndex: column.dataIndex,
    search: column.dataIndex === 'createTime'
        ? { type: 'date' }
        : { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] },
})));
const commonFilterFields = computed(() =>
    props.type === 'product'
        ? ['thingName', 'description', 'value']
        : ['description', 'value'],
);
const filterTerms = ref<ConditionFilterTerm[]>([]);
const submittedTerms = ref<ConditionFilterTerm[]>([]);
const tableParams = computed(() => ({
    terms: [
        {
            terms: [{
                column: props.type === 'device' ? 'thingId' : 'templateId',
                value: current.value?.id,
                termType: 'eq',
            }],
            type: 'and',
        },
        ...(buildQueryFilter(submittedTerms.value, filterFields.value).terms || []),
    ],
}));

function queryInvalidRows(params: Record<string, unknown>) {
    // 产品详情异步加载完成前不允许省略所属产品条件查询无效数据。
    if (!current.value?.id) {
        return Promise.resolve({
            success: true,
            result: {
                data: [],
                total: 0,
                pageIndex: Number(params.pageIndex ?? 0),
                pageSize: Number(params.pageSize ?? 10),
            },
        });
    }
    return queryInvalidData(params);
}

const gotoDevice = (id: string) => {
    // 不通过可能尚未同步完成的菜单映射，直接使用资源中心已注册的设备详情路径。
    void router.push(buildIotDeviceDetailPath(resolveIotProjectId(route), id, undefined, route));
};
const handleSearch = (payload?: { terms?: ConditionFilterTerm[] }) => {
    submittedTerms.value = payload?.terms || filterTerms.value;
    deviceAlarm.value?.reload?.();
};
const deviceAlarm = ref();

watch(
    () => current.value?.id,
    () => deviceAlarm.value?.reload?.(),
);
</script>
<style lang="less" scoped>
.product-invalid-table {
    width: 100%;
}

.deviceId {
    cursor: pointer;
    color:#4096FF;
}
</style>
