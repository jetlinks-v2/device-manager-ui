<template>
    <a-input
        :placeholder="$t('Save.SelectDevices.386303-0')"
        v-model:value="checkLable"
        :disabled="true"
    >
        <template #addonAfter>
            <AIcon
                :class="data.view ? 'disabled' : ''"
                type="EditOutlined"
                @click="onVisible"
            />
        </template>
    </a-input>
    <a-modal
        v-if="visible"
        :title="$t('Save.SelectDevices.386303-1')"
        :ok-text="$t('Save.SelectDevices.386303-2')"
        :cancel-text="$t('Save.SelectDevices.386303-3')"
        :visible="true"
        width="80%"
        @cancel="handleCancel"
        @ok="handleOk"
    >
        <pro-search
            :columns="columns"
            target="search-select-device"
            @search="handleSearch"
            type="simple"
        />
        <j-pro-table
            ref="tableRef"
            mode="TABLE"
            :columns="columns"
            :request="queryDetailList"
            :defaultParams="defaultParams"
            :rowSelection="{
                selectedRowKeys: _selectedRowKeys,
                onSelect: onSelectChange,
                onSelectAll: onSelectAllChange,
                onChange: onChange,
            }"
            :params="params"
        >
            <template #headerLeftRender>
                <a-checkbox
                    v-if="checkAllData.length !== 0"
                    v-model:checked="state.checkAll"
                    :indeterminate="state.indeterminate"
                    @change="onCheckAllChange"
                    style="margin-left: 8px"
                >
                    {{ $t('Save.SelectDevices.386303-4') }}
                </a-checkbox>
            </template>
            <template #productId="slotProps">
                <span>{{ slotProps.productName }}</span>
            </template>
            <template #state="slotProps">
                <a-badge
                    :text="slotProps.state?.text"
                    :status="statusMap.get(slotProps.state?.value)"
                />
            </template>
            <template #version="slotProps">
                <span>{{ slotProps.firmwareInfo?.version || '' }}</span>
            </template>
            <template #registerTime="slotProps">
                <span>{{
                    dayjs(slotProps.registerTime).format('YYYY-MM-DD HH:mm:ss')
                }}</span>
            </template>
        </j-pro-table>
    </a-modal>
</template>
<script lang="ts" setup name="SelectDevicesPage">
import {
    queryDetailListNoPaging,
    queryDetailList,
} from '../../../../../api/firmware';
import dayjs from 'dayjs';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
type T = any;
const emit = defineEmits(['update:modelValue', 'change']);

const props = defineProps({
    data: {
        type: Object,
        default: () => {},
    },
    productId: {
        type: String,
        default: '',
    },
});

const route = useRoute();
const params = ref<Record<string, any>>({});
const visible = ref(false);
const _selectedRowKeys = ref<string[]>([]);

const state = reactive({
    indeterminate: false,
    checkAll: false,
    checkedList: [],
});
let checkAllData: T[] = [];
const checkAllDataMap = new Map();
const checkLable = ref();

const defaultParams = {
    context: {
        includeTags: false,
        includeBind: false,
        includeRelations: false,
    },
    terms: [
        {
            terms: [
                {
                    column: 'productId',
                    value: props.productId,
                },
            ],
            type: 'and',
        },
    ],
    sorts: [{ name: 'createTime', order: 'desc' }],
};

const statusMap = new Map();
statusMap.set('online', 'processing');
statusMap.set('offline', 'error');
statusMap.set('notActive', 'warning');

const columns = [
    {
        title: 'ID',
        key: 'id',
        dataIndex: 'id',
        fixed: 'left',
        width: 200,
        ellipsis: true,
        search: {
            type: 'string',
        },
    },
    {
        title: $t('Save.SelectDevices.386303-5'),
        key: 'name',
        dataIndex: 'name',
        ellipsis: true,
        search: {
            type: 'string',
        },
    },
    {
        title: $t('Save.SelectDevices.386303-6'),
        dataIndex: 'version',
        key: 'version',
        ellipsis: true,
        search: {
            type: 'string',
        },
        scopedSlots: true,
    },
    {
        title: $t('Save.SelectDevices.386303-7'),
        key: 'registerTime',
        dataIndex: 'registerTime',
        search: {
            type: 'date',
            rename: 'registryTime',
        },
        width: 200,
        scopedSlots: true,
    },
    {
        title: $t('Save.SelectDevices.386303-8'),
        dataIndex: 'state',
        key: 'state',
        scopedSlots: true,
        search: {
            type: 'select',
            options: [
                { label: $t('Save.SelectDevices.386303-9'), value: 'online' },
                { label: $t('Save.SelectDevices.386303-10'), value: 'offline' },
                { label: $t('Save.SelectDevices.386303-11'), value: 'notActive' },
            ],
        },
        width: 150,
    },
];

const onCheckAllChange = (e: any) => {
    Object.assign(state, {
        checkedList: e.target.checked ? checkAllData : [],
        indeterminate: false,
    });
    _selectedRowKeys.value = state.checkedList;
};

const onSelectChange = (
    record: T[any],
    selected: boolean,
    selectedRows: T[any],
) => {
    _selectedRowKeys.value = selected
        ? [...getSetRowKey(selectedRows)]
        : _selectedRowKeys.value.filter((item: T) => item !== record?.id);
};
const onSelectAllChange = (
    selected: boolean,
    selectedRows: T[],
    changeRows: T[],
) => {
    const unRowsKeys = getSelectedRowsKey(changeRows);
    _selectedRowKeys.value = selected
        ? [...getSetRowKey(selectedRows)]
        : _selectedRowKeys.value
              .concat(unRowsKeys)
              .filter((item) => !unRowsKeys.includes(item));
};

const getSelectedRowsKey = (selectedRows: T[]) =>
    selectedRows.map((item) => item?.id).filter((i) => !!i);

const getSetRowKey = (selectedRows: T[]) =>
    new Set([..._selectedRowKeys.value, ...getSelectedRowsKey(selectedRows)]);

const onChange = (selectedRowKeys: T[]) => {
    if (selectedRowKeys.length === 0) {
        _selectedRowKeys.value = [];
    }
};

const handleOk = () => {
    checkLable.value = updateSelect(_selectedRowKeys.value);
    emit('update:modelValue', _selectedRowKeys.value);
    visible.value = false;
};

const updateSelect = (selectedRowKeys: T[]) => {
    let selectedRowLabel: any = selectedRowKeys
        .map((item) => checkAllDataMap.has(item) && checkAllDataMap.get(item))
        .toString();
    if (selectedRowLabel === 'false') {
        selectedRowLabel = selectedRowKeys;
    }
    return selectedRowLabel;
};

const onVisible = () => {
    !props.data.view && (visible.value = true);
};

const handleCancel = () => {
    visible.value = false;
    _selectedRowKeys.value = [];
};

onMounted(() => {
    queryDetailListNoPaging({ ...defaultParams, paging: false }).then(
        (resp: T) => {
            if (resp.status === 200) {
                checkAllData = resp.result.map((item: T) => {
                    checkAllDataMap.set(item.id, item.name);
                    return item.id;
                });
                if (props.data.id) {
                    checkLable.value = updateSelect(props.data.deviceId);
                    emit('update:modelValue', props.data.deviceId);
                    console.log(111, checkLable.value, props.data.deviceId);
                }
            }
        },
    );
});

watch(
    () => _selectedRowKeys.value,
    (val) => {
        Object.assign(state, {
            checkedList: val,
            indeterminate: !!val.length && val.length < checkAllData.length,
            checkAll:
                !!checkAllData.length && val.length === checkAllData.length,
        });
    },
    { deep: true },
);

/**
 * 搜索
 * @param params
 */
const handleSearch = (e: any) => {
    const newParams = (e?.terms as any[])?.map((item1) => {
        item1.terms = item1.terms.map((item2: any) => {
            if (item2.column === 'version') {
                return {
                    column: 'id$dev-firmware',
                    value: [item2],
                };
            }
            return item2;
        });
        return item1;
    });
    params.value = { terms: newParams || [] };
};
</script>

<style lang="less" scoped>
.disabled {
    pointer-events: auto !important;
    cursor: not-allowed !important;
}
</style>
