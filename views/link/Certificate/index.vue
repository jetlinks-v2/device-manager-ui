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
            <SaveModal v-model:open="dialog.visible" :id="dialog.id" @success="tableRef.reload()" />
        </div>
    </j-page-container>
</template>
<script lang="ts" setup name="CertificatePage">
import SaveModal from './SaveModal.vue';
import {query, remove } from '../../../api/link/certificate'
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const tableRef = ref<Record<string, any>>({});
const params = ref<Record<string, any>>({});
const dialog = reactive({
  visible: false,
  id: ':id',
});

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
                okText: '确定',
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
  dialog.id = ':id';
  dialog.visible = true;
};

const handleEdit = (id: string) => {
  dialog.id = id;
  dialog.visible = true;
};

const handleDelete = (id: string) => {
    const response = remove(id);
    response.then((res) => {
        if (res.success) {
            onlyMessage($t('Certificate.index.646549-11'), 'success');
            tableRef.value.reload();
        }
    });
    return response;
};

const handleSearch = (e: any) => {
    params.value = e;
};
</script>

<style lang="less" scoped></style>
