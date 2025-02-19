<template>
    <j-page-container
        :tabList="list"
        :showBack="true"
        :tabActiveKey="instanceStore.tabActiveKey"
        @tabChange="onTabChange"
    >
        <template #title>
            <div style="display: flex; align-items: center">
                <a-tooltip :title="instanceStore.current?.name">
                    <div class="deviceDetailHead">
                        {{ instanceStore.current?.name }}
                    </div>
                </a-tooltip>
                <a-divider type="vertical" />
                <a-space>
                    <span style="font-size: 14px; color: rgba(0, 0, 0, 0.85)">
                        {{ $t('Detail.index.957187-0') }}
                        <a-badge
                            :status="
                                statusMap.get(
                                    instanceStore.current?.state?.value,
                                )
                            "
                        />
                        {{ instanceStore.current?.state?.text }}
                    </span>
                    <j-permission-button
                        v-if="
                            instanceStore.current?.state?.value === 'notActive'
                        "
                        type="link"
                        style="margin-top: -5px; padding: 0 20px"
                        :popConfirm="{
                            title: $t('Detail.index.957187-1'),
                            onConfirm: handleAction,
                        }"
                        hasPermission="device/Instance:action"
                    >
                        {{ $t('Detail.index.957187-2') }}
                    </j-permission-button>
                    <j-permission-button
                        v-if="instanceStore.current?.state?.value === 'online'"
                        type="link"
                        style="margin-top: -5px; padding: 0 20px"
                        :popConfirm="{
                            title: $t('Detail.index.957187-3'),
                            onConfirm: handleDisconnect,
                        }"
                        hasPermission="device/Instance:action"
                    >
                        {{ $t('Detail.index.957187-4') }}
                    </j-permission-button>
                    <a-tooltip
                        v-if="
                            instanceStore.current?.accessProvider ===
                                'child-device' &&
                            instanceStore.current?.state?.value === 'offline'
                        "
                        :title="
                            instanceStore.current?.features?.find(
                                (item) => item?.id === 'selfManageState',
                            )
                                ? $t('Detail.index.957187-7')
                                : $t('Detail.index.957187-8')
                        "
                    >
                        <AIcon
                            type="QuestionCircleOutlined"
                            style="font-size: 14px"
                        />
                    </a-tooltip>
                </a-space>
            </div>
        </template>
        <template #content>
            <a-descriptions size="small" :column="4">
                <a-descriptions-item label="ID">{{
                    instanceStore.current?.id
                }}</a-descriptions-item>
                <a-descriptions-item :label="$t('Detail.index.957187-9')">
                    <j-permission-button
                        type="link"
                        style="margin-top: -5px; padding: 0"
                        @click="jumpProduct"
                        hasPermission="device/Product:view"
                    >
                        {{ instanceStore.current?.productName }}
                    </j-permission-button>
                </a-descriptions-item>
            </a-descriptions>
        </template>
        <template #extra>
            <a-space>
                <a-button
                    @click="onClick"
                    v-if="_arr.includes(instanceStore.current?.accessProvider || '')"
                    type="primary" :disabled="instanceStore.current?.state?.value !== 'online'">{{ $t('Detail.index.957187-10') }}
                </a-button>
                <img
                    @click="handleRefresh"
                    :src="device.button"
                    style="margin-right: 20px; cursor: pointer"
                    alt=""
                />
            </a-space>
        </template>
        <full-page>
          <div style="height: 100%; padding: 24px;overflow-y: auto">
            <component
              :is="tabs[instanceStore.tabActiveKey]"
              v-bind="{ type: 'device',isRefresh:isRefresh }"
              @onJump="onTabChange"
            />
          </div>
        </full-page>
    </j-page-container>
</template>

<script lang="ts" setup>
import { useInstanceStore } from '../../../../store/instance';
import Info from './Info/index.vue';
import Running from './Running/index.vue';
import Metadata from '../../components/Metadata/index.vue';
import MetadataMap from './MetadataMap/index.vue';
import ChildDevice from './ChildDevice/index.vue';
import Child from './Child/index.vue';
import Diagnose from './Diagnose/index.vue';
import Function from './Function/index.vue';
import Modbus from './Modbus/index.vue';
import OPCUA from './OPCUA/index.vue';
import EdgeMap from './EdgeMap/index.vue';
import Parsing from './Parsing/index.vue';
import GateWay from './GateWay/index.vue';
import Log from './Log/index.vue';
import AlarmRecord from './AlarmRecord/index.vue';
import Invalid from './Invalid/index.vue'
import Firmware from './Firmware/index.vue';
import Shadow from './Shadow/index.vue';
import Terminal from './Terminal/index.vue';
import CardManagement from '../components/IotCard/index.vue';
import { _deploy, _disconnect } from '../../../../api/instance';
import { onlyMessage } from '@jetlinks-web/utils';
import { openEdgeUrl } from '../../../../utils/utils';
import { getWebSocket } from '@/utils/websocket';
import { useRouterParams } from '@jetlinks-web/hooks';
import { EventEmitter } from '@jetlinks-web/utils';
import { useSystemStore, useMenuStore, useAuthStore} from '@/store';
import { isNoCommunity } from '@/utils/utils';
import { device } from "../../../../assets";
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const menuStory = useMenuStore();
const { showThreshold } = useSystemStore();
const route = useRoute();
const routerParams = useRouterParams();
const instanceStore = useInstanceStore();

const statusMap = new Map();

statusMap.set('online', 'success');
statusMap.set('offline', 'error');
statusMap.set('notActive', 'warning');

const statusRef = ref();

const initList = [
    {
        key: 'Info',
        tab: $t('Detail.index.957187-11'),
    },
    {
        key: 'Running',
        tab: $t('Detail.index.957187-12'),
    },
    {
        key: 'Metadata',
        tab: $t('Detail.index.957187-13'),
    },
    {
        key: 'Function',
        tab: $t('Detail.index.957187-14'),
    },
    {
        key: 'Log',
        tab: $t('Detail.index.957187-15'),
    },
];

const list = ref([...initList]);

const tabs = {
    Info,
    Metadata,
    Running,
    ChildDevice,
    Child,
    Diagnose,
    Function,
    Modbus,
    OPCUA,
    EdgeMap,
    Parsing,
    Log,
    MetadataMap,
    GateWay,
    AlarmRecord,
    CardManagement,
    Firmware,
    Shadow,
    Terminal,
    Invalid
};

const permissionStore = useAuthStore();
const _arr = ['agent-device-gateway', 'agent-media-device-gateway']
const getStatus = (id: string) => {
    statusRef.value = getWebSocket(
        `instance-editor-info-status-${id}`,
        `/dashboard/device/status/change/realTime`,
        {
            deviceId: id,
        },
    ).subscribe((message: any) => {
        if (
            message.payload?.value?.type !== instanceStore.current?.state.value
        ) {
            instanceStore.refresh(id);
        }
    });
};

const getDetail = () => {
    const keys = list.value.map((i) => i.key);
    if (permissionStore.hasPermission('rule-engine/Alarm/Log:view') && isNoCommunity && showThreshold) {
        list.value.push(...[{
            key: 'AlarmRecord',
            tab: $t('Detail.index.957187-16'),
        },{
            key: 'Invalid',
            tab: $t('Detail.index.957187-29')
        }]);
    }
    if (permissionStore.hasPermission('iot-card/CardManagement:view') && isNoCommunity) {
        list.value.push({
            key: 'CardManagement',
            tab: $t('Detail.index.957187-17'),
        });
    }

    if (instanceStore.current?.features?.some(item => item.id === 'deviceShadow-manager') && isNoCommunity) {
        list.value.push({
            key: 'Shadow',
            tab: $t('Detail.index.957187-18')
        })
    }
    if (
        permissionStore.hasPermission('device/Firmware:view') &&
        instanceStore.current?.features?.find(
            (item: any) => item?.id === 'supportFirmware',
        ) && isNoCommunity
    ) {
        list.value.push({
            key: 'Firmware',
            tab: $t('Detail.index.957187-19'),
        });
    }
    if (
        instanceStore.current?.protocol &&
        !['modbus-tcp', 'opc-ua'].includes(instanceStore.current?.protocol) &&
        !keys.includes('Diagnose')
    ) {
        list.value.push({
            key: 'Diagnose',
            tab: $t('Detail.index.957187-20'),
        });
    }
    if (
        instanceStore.current?.features?.find(
            (item: any) => item?.id === 'transparentCodec',
        ) &&
        !keys.includes('Parsing')
    ) {
        list.value.push({
            key: 'Parsing',
            tab: $t('Detail.index.957187-21'),
        });
    }
    if (
        instanceStore.current?.protocol === 'modbus-tcp' &&
        !keys.includes('Modbus')
    ) {
        list.value.push({
            key: 'Modbus',
            tab: $t('Detail.index.957187-22'),
        });
    }
    if (
        instanceStore.current?.protocol === 'opc-ua' &&
        !keys.includes('OPCUA')
    ) {
        list.value.push({
            key: 'OPCUA',
            tab: $t('Detail.index.957187-22'),
        });
    }
    if (
        instanceStore.current?.protocol === 'collector-gateway' &&
        !keys.includes('GateWay')
    ) {
        list.value.push({
            key: 'GateWay',
            tab: $t('Detail.index.957187-22'),
        });
    }
    if (
        instanceStore.current?.deviceType?.value === 'gateway' &&
        !keys.includes('ChildDevice')&&
        !keys.includes('Child')
    ) {
        const providers = ['agent-device-gateway', 'agent-media-device-gateway'];
        if(providers.includes(instanceStore.current?.accessProvider!)){
            list.value.push({
                key: 'Child',
                tab: $t('Detail.index.957187-23'),
            });
        }else{
            // 产品类型为网关的情况下才显示此模块
            list.value.push({
                key: 'ChildDevice',
                tab: $t('Detail.index.957187-23'),
            });
        }
    }
    if (
        instanceStore.current?.accessProvider === 'edge-child-device' &&
        instanceStore.current?.parentId &&
        !keys.includes('EdgeMap')
    ) {
        list.value.push({
            key: 'EdgeMap',
            tab: $t('Detail.index.957187-24'),
        });
    }

    if (
        instanceStore.current?.features?.find(
            (item: any) => item?.id === 'diffMetadataSameProduct',
        ) &&
        !keys.includes('MetadataMap')
    ) {
        list.value.push({key: 'MetadataMap', tab: $t('Detail.index.957187-25')});
    }

    if (
        _arr.includes(instanceStore.current?.accessProvider) &&
        !keys.includes('Terminal')
    ) {
        list.value.push({key: 'Terminal', tab: $t('Detail.index.957187-26')});
    }
};

const initPage = async (newId: any) => {
    await instanceStore.refresh(String(newId));
    getStatus(String(newId));
    list.value = [...initList];
    getDetail();
    instanceStore.tabActiveKey = 'Info';
};

onBeforeRouteUpdate((to: any) => {
    if (
        to.params?.id !== instanceStore.current.id &&
        to.name === 'device/Instance/Detail'
    ) {
        initPage(to.params?.id);
    }
});

const getDetailFn = async () => {
    const _id = route.params?.id;
    if (_id) {
        await instanceStore.refresh(String(_id));
        getStatus(String(_id));
        list.value = [...initList];
        getDetail();
        instanceStore.tabActiveKey = routerParams.params.value.tab || 'Info';
    } else {
        instanceStore.tabActiveKey = routerParams.params.value.tab || 'Info';
    }
};

const onTabChange = (e: string) => {
    if (instanceStore.tabActiveKey === 'Metadata') {
        EventEmitter.emit('MetadataTabs', () => {
            instanceStore.tabActiveKey = e;
        });
    } else {
        instanceStore.tabActiveKey = e;
    }
};

const handleAction = () => {
    if (instanceStore.current?.id) {
        const response = _deploy(instanceStore.current?.id);
        response.then((resp) => {
            if (resp.status === 200) {
                onlyMessage($t('Detail.index.957187-27'));
                instanceStore.refresh(instanceStore.current?.id);
            }
        });
        return response;
    }
};

const handleDisconnect = () => {
    if (instanceStore.current?.id) {
        const response = _disconnect(instanceStore.current?.id);
        response.then((resp) => {
            if (resp.status === 200) {
                onlyMessage($t('Detail.index.957187-27'));
                instanceStore.refresh(instanceStore.current?.id);
            }
        });
        return response;
    }
};

const handleRefresh = async () => {
    if (instanceStore.current?.id) {
        await instanceStore.refresh(instanceStore.current?.id);
        onlyMessage($t('Detail.index.957187-28'));
    }
};

const jumpProduct = () => {
    menuStory.jumpPage('device/Product/Detail', {
      params: {
        id: instanceStore.current?.productId
      }
    });
};

const onClick = async () => {
  await openEdgeUrl(instanceStore.current.id)
}

onMounted(() => {
    getDetailFn();
});

onUnmounted(() => {
    instanceStore.current = {} as any;
    statusRef.value && statusRef.value.unsubscribe();
});
</script>

<style lang="less" scoped>
.deviceDetailHead {
    max-width: 400px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
</style>
