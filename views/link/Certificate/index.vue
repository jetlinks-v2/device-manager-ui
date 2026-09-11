<template>
    <j-page-container>
        <div>
            <FullPage>
                <j-pro-table
                    ref="tableRef"
                    modeValue="TABLE"
                    :columns="columns"
                    :request="query"
                    :defaultParams="{
                        sorts: [{ name: 'createTime', order: 'desc' }],
                    }"
                    :params="params"
                >
                    <template #headerLeftRender>
                        <div class="access-component-list-toolbar">
                            <h2 class="access-component-list-title">
                                {{ $t('AccessComponent.listTitle.certificate') }}
                            </h2>
                            <ConditionFilter
                                class="access-component-list-search"
                                :columns="columns"
                                target="search-certificate"
                                @search="handleSearch"
                            />
                        </div>
                    </template>
                    <template #headerRightRender>
                        <j-permission-button
                            type="primary"
                            @click="handleAdd"
                            hasPermission="link/Certificate:add"
                        >
                            <template #icon
                                ><AIcon type="PlusOutlined"
                            /></template>
                            {{ $t('Certificate.index.646549-0') }}
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
import { useMenuStore } from '@jetlinks-web-core/store';
import { useI18n } from 'vue-i18n';
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter';

const { t: $t } = useI18n();
const menuStory = useMenuStore();
const tableRef = ref<Record<string, any>>({});
const params = ref<Record<string, any>>({});

const columns = [
    {
        title: $t('Certificate.index.646549-1'),
        dataIndex: 'type',
        key: 'type',
        fixed: 'left',
        width: 200,
        ellipsis: true,
        search: {
            type: 'select',
            options: [
                {
                    label: $t('Certificate.index.646549-2'),
                    value: 'common',
                },
            ],
        },
        scopedSlots: true,
    },
    {
        title: $t('Certificate.index.646549-3'),
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        search: {
            type: 'string',
            first: true,
        },
    },
    {
        title: $t('Certificate.index.646549-4'),
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        search: {
            type: 'string',
        },
    },
    {
        title: $t('Certificate.index.646549-5'),
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
            text: $t('Certificate.index.646549-6'),
            tooltip: {
                title: $t('Certificate.index.646549-6'),
            },
            icon: 'EditOutlined',
            onClick: async () => {
                handleEdit(data.id);
            },
        },
        {
            key: 'delete',
            text: $t('Certificate.index.646549-7'),
            tooltip: {
                title: $t('Certificate.index.646549-7'),
            },
            popConfirm: {
                title: $t('Certificate.index.646549-8'),
                okText: ' 确定',
                cancelText: $t('Certificate.index.646549-10'),
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
            onlyMessage($t('Certificate.index.646549-11'), 'success');
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

<style lang="less" scoped>
.access-component-list-toolbar {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
}

.access-component-list-title {
    margin: 0;
    color: rgba(0, 0, 0, 0.85);
    font-size: 20px;
    font-weight: 600;
    line-height: 32px;
    white-space: nowrap;
}

.access-component-list-search {
    flex: 1 1 360px;
    min-width: 280px;
    max-width: 640px;
}
</style>
