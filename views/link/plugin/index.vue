<template>
    <j-page-container>
        <pro-search
            :columns="columns"
            target="link-plugin"
            @search="handleSearch"
        />
        <FullPage>
            <JProTable
                ref="instanceRef"
                :columns="columns"
                :request="queryPage"
                :defaultParams="{
                    sorts: [{ name: 'createTime', order: 'desc' }],
                }"
                :params="params"
            >
                <template #headerLeftRender>
                    <j-permission-button
                        type="primary"
                        @click="handleAdd"
                        hasPermission="link/plugin:add"
                    >
                        <template #icon><AIcon type="PlusOutlined" /></template>
                        新增
                    </j-permission-button>
                </template>

                <template #card="slotProps">
                    <CardBox
                        :value="slotProps"
                        :showStatus="false"
                        :actions="getActions(slotProps)"
                        :statusNames="{
                            processing: 'processing',
                        }"
                        status="processing"
                    >
                        <template #img>
                            <img
                                :width="80"
                                :height="80"
                                :src="link.plug"
                            />
                        </template>
                        <template #content>
                            <div>
                                <div>
                                    <a-tag class="plugin-version">{{
                                        slotProps.version
                                    }}</a-tag>
                                </div>
                                <j-ellipsis
                                    style="
                                        width: calc(100% - 100px);
                                        margin-bottom: 18px;
                                    "
                                >
                                    <span
                                        style="
                                            font-size: 16px;
                                            font-weight: 600;
                                        "
                                    >
                                        {{ slotProps.name }}
                                    </span>
                                </j-ellipsis>
                            </div>
                            <a-row>
                                <a-col :span="12">
                                    <div class="card-item-content-text">
                                        插件ID
                                    </div>
                                    <j-ellipsis style="width: 100%">
                                        {{ slotProps.id }}
                                    </j-ellipsis>
                                </a-col>
                                <a-col :span="12">
                                    <div class="card-item-content-text">
                                        插件类型
                                    </div>
                                    <j-ellipsis style="width: 100%">
                                        {{ TypeMap[slotProps.type] }}
                                    </j-ellipsis>
                                </a-col>
                            </a-row>
                        </template>

                        <template #actions="item">
                            <j-permission-button
                                :disabled="item.disabled"
                                :popConfirm="item.popConfirm"
                                :tooltip="{
                                    ...item.tooltip,
                                }"
                                @click="item.onClick"
                                :hasPermission="'link/plugin:' + item.key"
                            >
                                <AIcon
                                    type="DeleteOutlined"
                                    v-if="item.key === 'delete'"
                                />
                                <template v-else>
                                    <AIcon :type="item.icon" />
                                    <span>{{ item?.text }}</span>
                                </template>
                            </j-permission-button>
                        </template>
                    </CardBox>
                </template>
                <template #type="slotProps">
                    <span>{{ TypeMap[slotProps.type] }}</span>
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
                                @click="i.onClick"
                                type="link"
                                :danger="i.key === 'delete'"
                                style="padding: 0 5px"
                                :hasPermission="'link/plugin:' + i.key"
                            >
                                <template #icon
                                    ><AIcon :type="i.icon"
                                /></template>
                            </j-permission-button>
                        </template>
                    </a-space>
                </template>
            </JProTable>
        </FullPage>
    </j-page-container>
    <SaveModal v-if="visible" :data="editData" @cancel="cancel" @ok="save" />
</template>

<script setup lang="ts" name="PluginIndex">
import SaveModal from './Save.vue';
import { onlyMessage } from '@jetlinks-web/utils';
import { queryPage, removeFn, getTypes } from '../../../api/link/plugin';
import { TypeMap } from './util';
import { link } from '../../../assets'

const route = useRoute();
const visible = ref(false);
const params = ref<any>();
const editData = ref();
const instanceRef = ref();

const columns = [
    {
        title: '插件ID',
        dataIndex: 'id',
        key: 'type',
        fixed: 'left',
        width: 200,
        ellipsis: true,
        search: {
            type: 'input',
        },
    },
    {
        title: '插件名称',
        dataIndex: 'name',
        key: 'type',
        fixed: 'left',
        width: 200,
        ellipsis: true,
        search: {
            type: 'input',
        },
    },
    {
        title: '版本',
        dataIndex: 'version',
        key: 'version',
        ellipsis: true,
    },
    {
        title: '插件类型',
        dataIndex: 'type',
        key: 'type',
        ellipsis: true,
        scopedSlots: true,
        search: {
            type: 'select',
            options: () => {
                return new Promise((resolve) => {
                    getTypes().then((res) => {
                        resolve(
                            res.result?.map((item) => ({
                                ...item,
                                label: item.text,
                            })),
                        );
                    });
                });
            },
        },
    },
    {
        title: '文件',
        dataIndex: 'filename',
        key: 'filename',
        ellipsis: true,
    },
    {
        title: '描述',
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
        width: 120,
        scopedSlots: true,
    },
];

const handleAdd = () => {
    editData.value = {};
    visible.value = true;
};

const handleSearch = (p: any) => {
    params.value = p;
};

const save = () => {
    if (instanceRef.value) {
        instanceRef.value?.reload();
    }
    visible.value = false;
};

const cancel = () => {
    visible.value = false;
    editData.value = undefined;
};

const getActions = (data: any) => {
    return [
        {
            key: 'update',
            text: '编辑',
            tooltip: {
                title: '编辑',
            },
            icon: 'EditOutlined',
            onClick: () => {
                visible.value = true;
                editData.value = data;
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
                onConfirm: () => {
                    const response = removeFn(data.id);
                    response.then((resp) => {
                        if (resp.status === 200) {
                            onlyMessage('操作成功！');
                            instanceRef.value?.reload();
                        } else {
                            onlyMessage(resp?.message || '操作失败！', 'error');
                        }
                    });
                    return response;
                },
            },
            icon: 'DeleteOutlined',
        },
    ];
};

onMounted(() => {
    if (route.query.save) {
        visible.value = true;
    }
});
</script>

<style scoped lang="less">
.plugin-version {
    border-radius: 4px;
}
</style>
