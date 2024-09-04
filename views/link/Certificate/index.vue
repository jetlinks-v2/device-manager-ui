<template>
    <j-page-container>
        <div>
            <pro-search
                :columns="columns"
                target="search-certificate"
                @search="handleSearch"
            />
            <FullPage>
                <j-pro-table
                    ref="tableRef"
                    mode="TABLE"
                    :columns="columns"
                    :request="query"
                    :defaultParams="{
                        sorts: [{ name: 'createTime', order: 'desc' }],
                    }"
                    :params="params"
                >
                    <template #headerLeftRender>
                        <j-permission-button
                            type="primary"
                            @click="handleAdd"
                            hasPermission="link/Certificate:add"
                        >
                            <template #icon
                                ><AIcon type="PlusOutlined"
                            /></template>
                            新增
                        </j-permission-button>
                    </template>
                    <template #type="slotProps">
                        <span>{{ slotProps.type.text }}</span>
                    </template>
                    <template #action="slotProps">
                        <a-space :size="16">
                            <template
                                v-for="i in getActions(slotProps)"
                                :key="i.key"
                            >
                                <j-permission-button
                                    :disabled="i.disabled"
                                    :popConfirm="i.popConfirm"
                                    :tooltip="{
                                        ...i.tooltip,
                                    }"
                                    style="padding: 0px"
                                    @click="i.onClick"
                                    type="link"
                                    :danger="i.key === 'delete'"
                                    :hasPermission="'link/Certificate:' + i.key"
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
        </div>
    </j-page-container>
</template>
<script lang="ts" setup name="CertificatePage">
import { query, remove } from '../../../api/link/certificate';
import { onlyMessage } from '@jetlinks-web/utils';
import { useMenuStore } from '@/store';

const menuStory = useMenuStore();
const tableRef = ref<Record<string, any>>({});
const params = ref<Record<string, any>>({});

const columns = [
    {
        title: '证书标准',
        dataIndex: 'type',
        key: 'type',
        fixed: 'left',
        width: 200,
        ellipsis: true,
        search: {
            type: 'select',
            options: [
                {
                    label: '国际标准',
                    value: 'common',
                },
            ],
        },
        scopedSlots: true,
    },
    {
        title: '证书名称',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        search: {
            type: 'string',
            first: true,
        },
    },
    {
        title: '说明',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        search: {
            type: 'string',
        },
    },
    {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 100,
        scopedSlots: true,
    },
];

const getActions = (data: Partial<Record<string, any>>): any[] => {
    if (!data) {
        return [];
    }
    return [
        // {
        //     key: 'view',
        //     text: '查看',
        //     tooltip: {
        //         title: '查看',
        //     },
        //     icon: 'EyeOutlined',
        //     onClick: async () => {
        //         handleEye(data.id);
        //     },
        // },
        {
            key: 'update',
            text: '编辑',
            tooltip: {
                title: '编辑',
            },
            icon: 'EditOutlined',
            onClick: async () => {
                handleEdit(data.id);
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
                onConfirm: async () => {
                    return handleDelete(data.id);
                },
            },
            icon: 'DeleteOutlined',
        },
    ];
};

const handleAdd = () => {
    menuStory.jumpPage(
        `link/Certificate/Detail`,
      {
        params: { id: ':id' },
        query: { view: false },
      }
    );
};

const handleEye = (id: string) => {
    menuStory.jumpPage(`link/Certificate/Detail`, {
      params: { id },
      query: { view: true },
    });
};

const handleEdit = (id: string) => {
    menuStory.jumpPage(`link/Certificate/Detail`, {
      params: { id },
      query: { view: false },
    });
};

const handleDelete = (id: string) => {
    const response = remove(id);
    response.then((res) => {
        if (res.success) {
            onlyMessage('操作成功', 'success');
            tableRef.value.reload();
        }
    });
    return response
};

/**
 * 搜索
 * @param params
 */
const handleSearch = (e: any) => {
    params.value = e;
};
</script>

<style lang="less" scoped></style>
