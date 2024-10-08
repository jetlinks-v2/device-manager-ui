<!--产品分类 -->
<template>
    <j-page-container>
        <pro-search
            :columns="query.columns"
            target="category"
            @search="handleSearch"
        />
        <FullPage :fixed="false">
            <j-pro-table
                ref="tableRef"
                :columns="table.columns"
                :request="queryTree"
                mode="TABLE"
                type="TREE"
                v-model:expandedRowKeys="expandedRowKeys"
                :scroll="{ y: 550 }"
                :defaultParams="{
                    paging: false,
                    sorts: [
                        { name: 'sortIndex', order: 'asc' },
                        {
                            name: 'createTime',
                            order: 'desc',
                        },
                    ],
                }"
                :params="params"
                :loading="tableLoading"
            >
                <template #headerLeftRender>
                    <j-permission-button
                        type="primary"
                        @click="add"
                        hasPermission="device/Category:add"
                    >
                        <template #icon><AIcon type="PlusOutlined" /></template>
                        新增
                    </j-permission-button>
                </template>
                <template #action="slotProps">
                    <a-space :size="16">
                        <template
                            v-for="i in getActions(slotProps, 'table')"
                            :key="i.key"
                        >
                            <j-permission-button
                                :disabled="i.disabled"
                                :popConfirm="i.popConfirm"
                                :hasPermission="'device/Category:' + i.key"
                                :tooltip="{
                                    ...i.tooltip,
                                }"
                                @click="i.onClick"
                                type="link"
                                style="padding: 0px"
                                :danger="i.key === 'delete'"
                            >
                                <template #icon
                                    ><AIcon :type="i.icon"
                                /></template>
                            </j-permission-button>
                        </template>
                    </a-space>
                </template>
            </j-pro-table>
        </FullPage>
        <!-- 新增和编辑弹窗 -->
        <ModifyModal
            ref="modifyRef"
            :formData="currentForm"
            :title="title"
            :isAdd="isAdd"
            :isChild="isChild"
            @refresh="refresh"
        />
    </j-page-container>
</template>
<script lang="ts" name="Category" setup>
import { queryTree, deleteTree } from '../../../api/category';
import ModifyModal from './components/modifyModal/index.vue';

import { onlyMessage } from '@/utils/comm';
const expandedRowKeys = ref<any>([]);
const tableRef = ref<Record<string, any>>({});
const modifyRef = ref();
const dataSource = ref<any>([]);
const currentForm = ref({});
const title = ref('');
const isAdd = ref(0);
const isChild = ref(0);
const tableLoading = ref(false);
const addSortId = ref();
// 筛选
const query = reactive({
    columns: [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            search: {
                type: 'string',
            },
        },
        {
            title: '排序',
            dataIndex: 'sortIndex',
            key: 'sortIndex',
            search: {
                type: 'number',
                componentProps: {
                    precision: 0,
                    min: 1,
                },
            },
            scopedSlots: true,
        },
        {
            title: '说明',
            key: 'description',
            dataIndex: 'description',
            search: {
                type: 'string',
            },
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 250,
            scopedSlots: true,
        },
    ],
});
let params = ref();
/**
 * 搜索
 */
const handleSearch = (e: any) => {
    params.value = e;
    expandedRowKeys.value = [];
};
/**
 * 操作栏按钮
 */
const getActions = (
    data: Partial<Record<string, any>>,
    type: 'table',
): any[] => {
    if (!data) return [];
    const actions = [
        {
            key: 'update',
            text: '编辑',
            tooltip: {
                title: '编辑',
            },
            icon: 'EditOutlined',
            onClick: async () => {
                title.value = '编辑分类';
                isAdd.value = 2;
                currentForm.value = data;
                nextTick(() => {
                    modifyRef.value.show(data);
                });
            },
        },
        {
            key: 'add',
            text: '添加子分类',
            tooltip: {
                title: '添加子分类',
            },
            icon: 'PlusCircleOutlined',
            onClick: () => {
                title.value = '新增子分类';
                isAdd.value = 0;
                currentForm.value = {};
                if (data.children && data.children.length > 0) {
                    isChild.value = 1;
                } else {
                    isChild.value = 2;
                }
                nextTick(() => {
                    modifyRef.value.show(data);
                    addSortId.value = data.id;
                });
            },
        },
        {
            key: 'delete',
            text: '删除',
            tooltip: {
                title: '删除',
            },
            popConfirm: {
                title: '确认删除?',
                okText: ' 确定',
                cancelText: '取消',
                onConfirm: () => {
                    const response = deleteTree(data.id);
                    response.then((resp) => {
                        if (resp.status === 200) {
                            onlyMessage('操作成功！');
                            tableRef.value.reload();
                        } else {
                            onlyMessage('操作失败！', 'error');
                        }
                    });
                    return response
                },
            },
            icon: 'DeleteOutlined',
        },
    ];
    return actions;
};

const table = reactive({
    columns: [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            width: 500,
        },
        {
            title: '排序',
            dataIndex: 'sortIndex',
            key: 'sortIndex',
            scopedSlots: true,
            width: 100,
        },
        {
            title: '说明',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            ellipsis: true,
            scopedSlots: true,
            width: 120,
        },
    ],
    /**
     * 添加产品分类
     */
    add: async () => {
        title.value = '新增分类';
        isAdd.value = 0;
        isChild.value = 3;
        nextTick(() => {
            modifyRef.value.show(currentForm.value);
        });
    },
    /**
     * 刷新表格数据
     */
    refresh: () => {
        if (isAdd.value === 0 && isChild.value !== 3) {
            expandedRowKeys.value.push(addSortId.value);
        }
        console.log(expandedRowKeys.value);
        tableRef.value.reload();
    },
});
const { add, columns, refresh } = toRefs(table);
/**
 * 初始化
 */
</script>
<style scoped lang="less">
:deep(._jtable-body_1eyxz_1 ._jtable-pagination_1eyxz_43) {
    margin-top: 20px;
    display: none;
    justify-content: flex-end;
}
</style>
