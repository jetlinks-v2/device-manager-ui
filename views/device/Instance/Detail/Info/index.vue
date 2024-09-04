<template>
    <a-descriptions bordered>
        <template #title>
            设备信息
            <j-permission-button
                type="link"
                @click="visible = true"
                hasPermission="device/Instance:update"
            >
                <template #icon><AIcon type="EditOutlined" /></template>
                编辑
            </j-permission-button>
        </template>
        <a-descriptions-item label="设备ID">
            <div style="display: flex">
                <div style="flex: 1">
                    <j-ellipsis> {{ instanceStore.current?.id }} </j-ellipsis>
                </div>
                <div
                    v-if="
                        instanceStore.current?.accessProvider ===
                        'plugin_gateway'
                    "
                >
                    <a-tooltip>
                        <template #title>
                            <p>
                                通过调用SDK或HTTP请求的方式接入第三方系统设备数据时，第三方系统与平台当前设备对应的设备ID。
                            </p>
                            如双方ID值一致，则无需填写
                        </template>
                        <a
                            v-if="!inklingDeviceId"
                            type="link"
                            @click="giveAnInkling"
                        >
                            未映射
                        </a>
                        <a v-else type="link" @click="inkingVisible = true">
                            已映射
                        </a>
                    </a-tooltip>
                </div>
            </div>
        </a-descriptions-item>
        <a-descriptions-item label="产品名称">{{
            instanceStore.current?.productName
        }}</a-descriptions-item>
        <a-descriptions-item label="设备类型">{{
            instanceStore.current?.deviceType?.text
        }}</a-descriptions-item>
        <a-descriptions-item label="固件版本">{{
            instanceStore.current?.firmwareInfo?.version
        }}</a-descriptions-item>
        <a-descriptions-item label="连接协议">{{
            instanceStore.current?.transport
        }}</a-descriptions-item>
        <a-descriptions-item label="消息协议">{{
            instanceStore.current?.protocolName
        }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{
            instanceStore.current?.createTime
                ? dayjs(instanceStore.current?.createTime).format(
                      'YYYY-MM-DD HH:mm:ss',
                  )
                : ''
        }}</a-descriptions-item>
        <a-descriptions-item label="注册时间">{{
            instanceStore.current?.registerTime
                ? dayjs(instanceStore.current?.registerTime).format(
                      'YYYY-MM-DD HH:mm:ss',
                  )
                : ''
        }}</a-descriptions-item>
        <a-descriptions-item label="最后上线时间">{{
            instanceStore.current?.onlineTime
                ? dayjs(instanceStore.current?.onlineTime).format(
                      'YYYY-MM-DD HH:mm:ss',
                  )
                : ''
        }}</a-descriptions-item>
        <a-descriptions-item
            label="父设备"
            v-if="instanceStore.current?.deviceType?.value === 'childrenDevice'"
            >{{ instanceStore.current?.parentId }}</a-descriptions-item
        >
        <a-descriptions-item label="说明">{{
            instanceStore.current?.description
        }}</a-descriptions-item>
    </a-descriptions>
    <Config />
    <Tags
        v-if="
            instanceStore.current?.tags &&
            instanceStore.current?.tags.length > 0
        "
    />
    <Relation
        v-if="
            instanceStore.current?.relations &&
            instanceStore.current?.relations.length > 0
        "
    />
    <Save
        v-if="visible"
        :data="instanceStore.current"
        @close="visible = false"
        @save="saveBtn"
    />
    <InkingModal
        v-if="inkingVisible"
        :id="inklingDeviceId"
        :accessId="instanceStore.current.accessId"
        :pluginId="channelId"
        @cancel="inkingVisible = false"
        @submit="saveInkling"
    />
</template>

<script lang="ts" setup>
import { useInstanceStore } from '@/store/instance';
import Save from '../../Save/index.vue';
import Config from './components/Config/index.vue';
import Tags from './components/Tags/index.vue';
import Relation from './components/Relation/index.vue';
import InkingModal from './components/InklingModal';
import dayjs from 'dayjs';
import { detail as queryPluginAccessDetail } from '@/api/link/accessConfig';
import { getPluginData } from '@/api/link/plugin';

const visible = ref<boolean>(false);
const inkingVisible = ref<boolean>(false);
const instanceStore = useInstanceStore();
const inklingDeviceId = ref();
const channelId = ref();

const saveBtn = () => {
    if (instanceStore.current?.id) {
        instanceStore.refresh(instanceStore.current?.id);
    }
    visible.value = false;
};

const saveInkling = (id: string) => {
    if (instanceStore.current?.id) {
        instanceStore.refresh(instanceStore.current?.id);
    }
    channelId.value = id;
    queryInkling();
    inkingVisible.value = false;
};

const giveAnInkling = () => {
    inkingVisible.value = true;
};

const queryInkling = () => {
    if (instanceStore.current?.accessProvider === 'plugin_gateway') {
        queryPluginAccessDetail(instanceStore.current?.accessId).then(
            async (res) => {
                if (res.success) {
                    channelId.value = res.result.channelId;
                    const pluginRes = await getPluginData(
                        'device',
                        instanceStore.current?.accessId,
                        instanceStore.current?.id,
                    );
                    if (pluginRes.success) {
                        inklingDeviceId.value = pluginRes.result?.externalId;
                    }
                }
            },
        );
    }
};

onMounted(() => {
    // 设备编辑标签后，返回实力信息页面，标签栏没有更新
    if (instanceStore?.current?.id) {
        instanceStore.refresh(instanceStore.current.id);
    }
});
watch(
    () => instanceStore.current?.id,
    () => {
        if (instanceStore.current?.id) {
            queryInkling();
        }
    },
    { immediate: true },
);
</script>
