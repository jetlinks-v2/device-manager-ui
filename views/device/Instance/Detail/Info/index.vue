<template>
  <a-descriptions :labelStyle="{width: '150px'}" bordered>
    <template #title>
      {{ $t('Info.index.208636-0') }}
      <j-permission-button
          type="link"
          @click="visible = true"
          hasPermission="device/Instance:update"
      >
        <template #icon>
          <AIcon type="EditOutlined"/>
        </template>
        {{ $t('Info.index.208636-1') }}
      </j-permission-button>
    </template>
    <a-descriptions-item :label="$t('Info.index.208636-2')">
      <div style="display: flex; gap: 16px">
        <div style="flex: 1">
          <j-ellipsis> {{ instanceStore.current?.id }}</j-ellipsis>
        </div>
        <template v-if="instanceStore.current?.accessProvider === 'plugin_gateway'">
          <div>
            <a-tooltip>
              <template #title>
                <p>
                  {{ $t('Info.index.208636-3') }}
                </p>
                {{ $t('Info.index.208636-4') }}
              </template>
              <a-tag>{{ !inklingDevice?.externalId ? $t('Info.index.208636-5') : $t('Info.index.208636-6') }}</a-tag>
              <!--                                  <a-->
              <!--                                      v-if="!inklingDevice?.externalId"-->
              <!--                                      type="link"-->
              <!--                                      @click="giveAnInkling"-->
              <!--                                  >-->
              <!--                                      {{ $t('Info.index.208636-5') }}-->
              <!--                                  </a>-->
              <!--                                  <a v-else type="link" @click="inkingVisible = true">-->
              <!--                                      {{ $t('Info.index.208636-6') }}-->
              <!--                                  </a>-->
            </a-tooltip>
          </div>
          <div>
            <j-permission-button
                type="link"
                v-if="inklingDevice?.externalId"
                style="margin-top: -5px; padding: 0 20px"
                :popConfirm="{
                            title: $t('Info.index.208636-18'),
                            onConfirm: onUnMap,
                        }"
                :tooltip="{ title: $t('Info.index.208636-19')}"
            >
              <AIcon type="LinkOutlined"/>
            </j-permission-button>
            <a-tooltip v-else :title="$t('Info.index.208636-20')">
              <a @click="giveAnInkling">
                <AIcon type="DisconnectOutlined"/>
              </a>
            </a-tooltip>
          </div>
        </template>
      </div>
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-7')">
      <j-ellipsis>{{
          instanceStore.current?.productName
        }}
      </j-ellipsis>
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-8')">{{
        instanceStore.current?.deviceType?.text
      }}
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-9')">{{
        instanceStore.current?.firmwareInfo?.version || '--'
      }}
      <a-tooltip :title="$t('Info.index.208636-17')">
        <AIcon type="QuestionCircleOutlined"/>
      </a-tooltip>
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-10')">{{
        instanceStore.current?.transport
      }}
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-11')">{{
        instanceStore.current?.protocolName
      }}
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-12')">{{
        instanceStore.current?.createTime
            ? dayjs(instanceStore.current?.createTime).format(
                'YYYY-MM-DD HH:mm:ss',
            )
            : ''
      }}
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-13')">{{
        instanceStore.current?.registerTime
            ? dayjs(instanceStore.current?.registerTime).format(
                'YYYY-MM-DD HH:mm:ss',
            )
            : ''
      }}
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-14')">{{
        instanceStore.current?.onlineTime
            ? dayjs(instanceStore.current?.onlineTime).format(
                'YYYY-MM-DD HH:mm:ss',
            )
            : ''
      }}
    </a-descriptions-item>
    <a-descriptions-item
        :label="$t('Info.index.208636-15')"
        v-if="instanceStore.current?.deviceType?.value === 'childrenDevice'"
    >
      <a @click="onClick(instanceStore.current?.parentId)">{{ instanceStore.current?.parentName || instanceStore.current?.parentId || "--" }}</a>
    </a-descriptions-item>
    <a-descriptions-item :label="$t('Info.index.208636-16')">{{
        instanceStore.current?.description
      }}
    </a-descriptions-item>
  </a-descriptions>
  <Config/>
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
      :id="inklingDevice?.externalId"
      :accessId="instanceStore.current.accessId"
      :pluginId="channelId"
      @cancel="inkingVisible = false"
      @submit="saveInkling"
  />
</template>

<script lang="ts" setup>
import {useInstanceStore} from '../../../../../store/instance';
import Save from '../../Save/index.vue';
import Config from './components/Config/index.vue';
import Tags from './components/Tags/index.vue';
import Relation from './components/Relation/index.vue';
import InkingModal from './components/InklingModal';
import dayjs from 'dayjs';
import {detail as queryPluginAccessDetail} from '../../../../../api/link/accessConfig';
import {getPluginData} from '../../../../../api/link/plugin';
import {useI18n} from "vue-i18n";
import {useMenuStore} from "@/store";
import {detail, unbindInkingDevices} from "@device/api/instance";
import {onlyMessage} from "@jetlinks-web/utils";

const {t: $t} = useI18n();
const visible = ref<boolean>(false);
const inkingVisible = ref<boolean>(false);
const instanceStore = useInstanceStore();
const inklingDevice = ref();
const channelId = ref();

const menuStore = useMenuStore();

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

const onUnMap = () => {
  if(inklingDevice.value?.id) {
    const response = unbindInkingDevices(inklingDevice.value?.id);
    response.then((resp) => {
      if (resp.success) {
        onlyMessage($t('Detail.index.957187-27'));
        queryInkling()
      }
    });
    return response;
  }
}

const queryInkling = async () => {
  const pluginRes = await getPluginData(
      'device',
      instanceStore.current?.accessId,
      instanceStore.current?.id,
  );
  if (pluginRes.success) {
    console.log(pluginRes.result, 'pluginRes.result')
    inklingDevice.value = pluginRes.result;
  }
};

const getPluginAccessDetail = () => {
  if (instanceStore.current?.accessProvider === 'plugin_gateway') {
    queryPluginAccessDetail(instanceStore.current?.accessId).then(
        async (res) => {
          if (res.success) {
            channelId.value = res.result.channelId;
            queryInkling()
          }
        },
    );
  }
}

const onClick = async (id: string) => {
  // 查询父设备是否有权限
  const resp = await detail(id)
  if (resp.success) {
    menuStore.jumpPage('device/Instance/Detail', {params: {id}});
  }
}

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
        getPluginAccessDetail();
      }
    },
    {immediate: true},
);
</script>
