<template>
    <j-page-container>
        <div>
            <pro-search
                :columns="columns"
                target="search-type"
                @search="handleSearch"
            />
            <FullPage>
                <j-pro-table
                    ref="tableRef"
                    :columns="columns"
                    :gridColumn="3"
                    :request="query"
                    :defaultParams="{
                        sorts: [{ name: 'createTime', order: 'desc' }],
                    }"
                    :params="params"
                    modeValue="CARD"
                >
                    <template #headerLeftRender>
                        <j-permission-button
                            type="primary"
                            @click="handleAdd"
                            hasPermission="link/Type:add"
                        >
                            <template #icon
                                ><AIcon type="PlusOutlined"
                            /></template>
                            新增
                        </j-permission-button>
                    </template>
                    <template #card="slotProps">
                        <CardBox
                            :showStatus="true"
                            :value="slotProps"
                            :actions="getActions(slotProps, 'card')"
                            v-bind="slotProps"
                            :status="slotProps.state.value"
                            :statusText="slotProps.state.text"
                            :statusNames="{
                                enabled: 'processing',
                                disabled: 'error',
                            }"
                            @click="handleEye(slotProps.id)"
                        >
                            <template #img>
                                <slot name="img">
                                    <img :src="network.icon" />
                                </slot>
                            </template>
                            <template #content>
                                <div class="card-item-content">
                                    <j-ellipsis
                                        style="
                                            width: calc(100% - 100px);
                                            margin-bottom: 20px;
                                        "
                                    >
                                        <span
                                            style="
                                                font-size: 18px;
                                                font-weight: 800;
                                                line-height: 22px;
                                            "
                                        >
                                            {{ slotProps.name }}
                                        </span>
                                    </j-ellipsis>
                                    <a-row class="card-item-content-box">
                                        <a-col :span="8">
                                            <div
                                                class="card-item-content-text-title"
                                            >
                                                类型
                                            </div>
                                            <div class="card-item-content-text">
                                                <a-tooltip>
                                                    <template #title>{{
                                                        slotProps.type
                                                    }}</template>
                                                    {{ slotProps.type }}
                                                </a-tooltip>
                                            </div>
                                        </a-col>

                                        <a-col :span="16">
                                            <div
                                                class="card-item-content-text-title"
                                            >
                                                详情
                                            </div>
                                            <div class="card-item-content-text">
                                                <a-tooltip>
                                                    <template #title>{{
                                                        getDetails(slotProps)
                                                    }}</template>
                                                    {{ getDetails(slotProps) }}
                                                </a-tooltip>
                                            </div>
                                        </a-col>
                                    </a-row>
                                </div>
                            </template>
                            <template #actions="item">
                                <j-permission-button
                                    :disabled="item.disabled"
                                    :popConfirm="item.popConfirm"
                                    :tooltip="{
                                        ...item.tooltip,
                                    }"
                                    @click="item.onClick"
                                    :hasPermission="'link/Type:' + item.key"
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
                    <template #action="slotProps">
                        <a-space :size="16">
                            <template
                                v-for="i in getActions(slotProps, 'table')"
                                :key="i.key"
                            >
                                <j-permission-button
                                    :disabled="i.disabled"
                                    :popConfirm="i.popConfirm"
                                    :tooltip="{
                                        ...i.tooltip,
                                    }"
                                    style="padding: 0px"
                                    type="link"
                                    :danger="i.key === 'delete'"
                                    :hasPermission="'link/Type:' + i.key"
                                    @click="i.onClick"
                                >
                                    <template #icon
                                        ><AIcon :type="i.icon"
                                    /></template>
                                </j-permission-button>
                            </template>
                        </a-space>
                    </template>
                    <template #state="slotProps">
                        <a-badge-status
                            :text="slotProps.state.text"
                            :status="slotProps.state.value"
                            :statusNames="{
                                enabled: 'processing',
                                disabled: 'error',
                            }"
                        ></a-badge-status>
                    </template>
                    <template #shareCluster="slotProps">
                        {{
                            slotProps.shareCluster === true
                                ? '共享配置'
                                : '独立配置'
                        }}
                    </template>
                    <template #type="slotProps">
                        {{ slotProps.typeObject.name }}
                    </template>
                    <template #details="slotProps">
                        {{ getDetails(slotProps) }}
                    </template>
                </j-pro-table>
            </FullPage>
        </div>
    </j-page-container>
</template>
<script lang="ts" setup name="TypePage">
import { supports, query, remove, start, shutdown } from '../../../api/link/type';
import { onlyMessage } from '@/utils/comm';
import { useMenuStore } from '@/store';
import {network} from "../../../assets";

const menuStory = useMenuStore();
const tableRef = ref<Record<string, any>>({});
const params = ref<Record<string, any>>({});
const options = ref([]);

const columns = [
    {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        width: 250,
        fixed: 'left',
        search: {
            type: 'string',
        },
    },
    {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        ellipsis: true,
        width: 150,
        search: {
            type: 'select',
            options: async () => {
                const res: any = await supports();
                return (options.value = res.result.map((item: any) => ({
                    value: item.id,
                    label: item.name,
                })));
            },
        },
        scopedSlots: true,
    },
    {
        title: '集群',
        dataIndex: 'shareCluster',
        key: 'shareCluster',
        width: 120,
        ellipsis: true,
        scopedSlots: true,
        search: {
            type: 'select',
            options: [
                { label: '共享配置', value: 'true' },
                { label: '独立配置', value: 'false' },
            ],
        },
    },
    {
        title: '详情',
        dataIndex: 'details',
        key: 'details',
        ellipsis: true,
        scopedSlots: true,
    },
    {
        title: '状态',
        dataIndex: 'state',
        key: 'state',
        width: 100,
        ellipsis: true,
        scopedSlots: true,
        search: {
            type: 'select',
            options: [
                { label: '正常', value: 'enabled' },
                { label: '禁用', value: 'disabled' },
            ],
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
        width: 200,
        scopedSlots: true,
    },
];

const getActions = (
    data: Partial<Record<string, any>>,
    type: 'card' | 'table',
): any[] => {
    if (!data) return [];
    const state = data.state.value;
    const stateText = state === 'enabled' ? '禁用' : '启用';
    const actions = [
        {
            key: 'view',
            text: '查看',
            tooltip: {
                title: '查看',
            },
            icon: 'EyeOutlined',
            onClick: async () => {
                handleEye(data.id);
            },
        },
        {
            key: 'update',
            text: '编辑',
            tooltip: {
                title: '编辑',
            },
            icon: 'EditOutlined',
            onClick: () => {
                handleEdit(data.id);
            },
        },
        {
            key: 'action',
            text: stateText,
            tooltip: {
                title: stateText,
                placement: 'topRight',
            },
            icon: state === 'enabled' ? 'StopOutlined' : 'CheckCircleOutlined',
            popConfirm: {
                title: `确认${stateText}?`,
                onConfirm: () => {
                    let response =
                        state === 'enabled'
                            ? shutdown(data.id)
                            : start(data.id);
                    response.then((res) => {
                        if (res.success) {
                            onlyMessage('操作成功', 'success');
                            tableRef.value?.reload();
                        }
                    });
                    return response;
                },
            },
        },
        {
            key: 'delete',
            text: '删除',
            disabled: state === 'enabled',
            tooltip: {
                title:
                    state === 'enabled' ? '请先禁用该组件，再删除。' : '删除',
            },
            popConfirm: {
                title: '确认删除?',
                onConfirm: () => {
                    const response: any = remove(data.id);
                    response.then((res:any) => {
                        if (res.status === 200) {
                            onlyMessage('操作成功', 'success');
                            tableRef.value.reload();
                        } else {
                            onlyMessage(res?.message, 'error');
                        }
                    });
                    return response
                },
            },
            icon: 'DeleteOutlined',
        },
    ];
    return type === 'table'
        ? actions
        : actions.filter((item) => item.key !== 'view');
};

const handleAdd = () => {
    menuStory.jumpPage(`link/Type/Detail`, {
      params: { id: ':id' },
      query: { view: false }
});
};

const handleEye = (id: string) => {
    menuStory.jumpPage(`link/Type/Detail`, {
      params: { id },
      query: { view: true }
    });
};

const handleEdit = (id: string) => {
    menuStory.jumpPage(`link/Type/Detail`, {
      params: { id },
      query: { view: false }
    });
};

const getDetails = (slotProps: Partial<Record<string, any>>) => {
    const { typeObject, shareCluster, configuration, cluster } = slotProps;
    const headers =
        typeObject.name.replace(/[^j-zA-Z]/g, '').toLowerCase() + '://';
    const content = !!shareCluster
        ? (configuration.publicHost || configuration.remoteHost) +
          ':' +
          (configuration.publicPort || configuration.remotePort)
        : (cluster[0].configuration.publicHost ||
              cluster[0].configuration.remoteHost) +
          ':' +
          (cluster[0].configuration.publicPort ||
              cluster[0].configuration.remotePort);
    let head = '远程:';
    if (!!shareCluster) {
        !!configuration.publicHost && (head = '公网:');
    } else {
        !!cluster[0].configuration.publicHos && (head = '公网:');
    }
    if (!shareCluster && cluster.length > 1) {
        const contentItem2 =
            (cluster[0].configuration.publicHost ||
                cluster[0].configuration.remoteHost) +
            ':' +
            (cluster[0].configuration.publicPort ||
                cluster[0].configuration.remotePort);
        let headItme2 = '远程';
        !!cluster[0].configuration.publicHos && (headItme2 = '公网:');
        if (cluster.length > 2) {
            return (
                head +
                headers +
                content +
                ' ' +
                headItme2 +
                headers +
                contentItem2 +
                '。。。'
            );
        }
        return (
            head + headers + content + ' ' + headItme2 + headers + contentItem2
        );
    }
    return head + headers + content;
};

// const getSupports = async () => {
//     const res: any = await supports();
//     options.value = res.result.map((item: any) => ({
//         value: item.id,
//         label: item.name,
//     }));
// };
// getSupports();

/**
 * 搜索
 * @param params
 */
const handleSearch = (e: any) => {
    params.value = e;
};
</script>
<style lang="less" scoped>
.card-item-content {
    min-height: 100px;
    .card-item-content-box {
        min-height: 50px;
    }
    .card-item-content-text {
        font-style: normal;
        font-weight: 400;
        font-size: 14px;
        line-height: 170%;
        color: rgba(0, 0, 0, 0.85);
        opacity: 0.75;
        overflow: hidden; //超出的文本隐藏
        text-overflow: ellipsis; //溢出用省略号显示
        white-space: nowrap; //溢出不换行
    }
    .card-item-content-text-title {
        font-style: normal;
        font-weight: 400;
        font-size: 12px;
        line-height: 170%;
        color: rgba(0, 0, 0, 0.75);
        opacity: 0.75;
    }
}
</style>
