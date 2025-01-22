<template>
    <pro-search
        :columns="columns"
        target="device-instance"
        type="simple"
        @search="handleSearch"
    />
    <JProTable
        ref="deviceAlarm"
        :columns="columns"
        mode="TABLE"
        :request="queryAlarmRecord"
        :defaultParams="defaultParams"
        :params="params"
    >
        <template #alarmTime="slotProps">
            {{ dayjs(slotProps.alarmTime).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
        <template #duration="slotProps">
            <Duration :data="slotProps" />
        </template>
        <template #handleTime="slotProps">
            {{
                slotProps.handleTime
                    ? dayjs(slotProps.handleTime).format('YYYY-MM-DD HH:mm:ss')
                    : '--'
            }}
        </template>
        <template #sourceName="slotProps">
            <j-ellipsis>
                {{ $t('Alarm.index.101383-0') }}
                <span class="deviceId"  @click="() => gotoDevice(slotProps.sourceId)">{{ slotProps.sourceName }}</span></j-ellipsis
            >
        </template>
        <template #handleType="slotProps">
            {{ slotProps?.handleType?.text || '--' }}
        </template>
        <template #state="slotProps">
            {{ slotProps?.state?.value === 'normal' ? $t('Alarm.index.101383-1') : $t('Alarm.index.101383-2') }}
        </template>
        <template #actions="slotProps">
            <a-space>
                <template v-for="i in getActions(slotProps)" :key="i.key">
                    <j-permission-button
                        :popConfirm="i.popConfirm"
                        :tooltip="{
                            ...i.tooltip,
                        }"
                        @click="i.onClick"
                        type="link"
                        style="padding: 0 5px"
                        :hasPermission="
                            i.key == 'solve'
                                ? 'rule-engine/Alarm/Log:action'
                                : 'rule-engine/Alarm/Log:view'
                        "
                    >
                        {{ i.text }}
                    </j-permission-button>
                </template>
            </a-space>
        </template>
    </JProTable>
    <Solve
        v-if="solveVisible"
        :data="currentAlarm"
        :solveType="solveType"
        :goal="goal"
        :handleDes="handleDescription"
        @closeSolve="closeSolve"
        @refresh="solveRefresh"
    />
    <AlarmLog
        v-if="visibleDrawer"
        :data="currentAlarm"
        :goal="goal"
        @closeDrawer="visibleDrawer = false"
        @refreshTable="refresh"
    />
</template>

<script setup>
import {
    queryByDevice as queryAlarmRecord,
    queryPreHandleHistory,
} from '@device/api/rule-engine/log';
import { useInstanceStore } from '@device/store/instance';
import { useProductStore } from '@device/store/product';
import dayjs from 'dayjs';
import AlarmLog from './components/AlarmLog.vue';
import { useMenuStore } from '@/store';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
    goal: {
        type: String,
        default: 'device',
    },
});
const menuStory = useMenuStore();
const { current } =
    props.goal === 'device' ? useInstanceStore() : useProductStore();
const columns =
    props.goal === 'device'
        ? [
              {
                  title: $t('Alarm.index.101383-3'),
                  dataIndex: 'alarmTime',
                  key: 'alarmTime',
                  search: {
                      type: 'date',
                  },
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-4'),
                  dataIndex: 'duration',
                  key: 'duration',
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-5'),
                  dataIndex: 'triggerDesc',
                  key: 'triggerDesc',
              },
              {
                  title: $t('Alarm.index.101383-6'),
                  dataIndex: 'actualDesc',
                  key: 'actualDesc',
              },
              {
                  title: $t('Alarm.index.101383-7'),
                  dataIndex: 'handleTime',
                  key: 'handleTime',
                  search: {
                      type: 'date',
                  },
                  scopedSlots: true,
              },

              {
                  title: $t('Alarm.index.101383-8'),
                  dataIndex: 'handleType',
                  key: 'handleType',
                  search: {
                      type: 'select',
                      options: [
                          {
                              label: $t('Alarm.index.101383-9'),
                              value: 'user',
                          },
                          {
                              label: $t('Alarm.index.101383-10'),
                              value: 'system',
                          },
                      ],
                  },
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-11'),
                  dataIndex: 'state',
                  key: 'state',
                  search: {
                      type: 'select',
                      options: [
                          {
                              label: $t('Alarm.index.101383-1'),
                              value: 'normal',
                          },
                          {
                              label: $t('Alarm.index.101383-2'),
                              value: 'warning',
                          },
                      ],
                  },
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-12'),
                  dataIndex: 'actions',
                  key: 'actions',
                  scopedSlots: true,
              },
          ]
        : [
              {
                  title: $t('Alarm.index.101383-3'),
                  dataIndex: 'alarmTime',
                  key: 'alarmTime',
                  search: {
                      type: 'date',
                  },
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-4'),
                  dataIndex: 'duration',
                  key: 'duration',
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-5'),
                  dataIndex: 'triggerDesc',
                  key: 'triggerDesc',
              },
              {
                  title: $t('Alarm.index.101383-13'),
                  dataIndex: 'sourceName',
                  key: 'sourceName',
                  scopedSlots: true,
                  search: {
                      type: 'string',
                  },
              },
              {
                  title: $t('Alarm.index.101383-6'),
                  dataIndex: 'actualDesc',
                  key: 'actualDesc',
              },
              {
                  title: $t('Alarm.index.101383-7'),
                  dataIndex: 'handleTime',
                  key: 'handleTime',
                  search: {
                      type: 'date',
                  },
                  scopedSlots: true,
              },

              {
                  title: $t('Alarm.index.101383-8'),
                  dataIndex: 'handleType',
                  key: 'handleType',
                  search: {
                      type: 'select',
                      options: [
                          {
                              label: $t('Alarm.index.101383-9'),
                              value: 'user',
                          },
                          {
                              label: $t('Alarm.index.101383-10'),
                              value: 'system',
                          },
                      ],
                  },
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-11'),
                  dataIndex: 'state',
                  key: 'state',
                  search: {
                      type: 'select',
                      options: [
                          {
                              label: $t('Alarm.index.101383-1'),
                              value: 'normal',
                          },
                          {
                              label: $t('Alarm.index.101383-2'),
                              value: 'warning',
                          },
                      ],
                  },
                  scopedSlots: true,
              },
              {
                  title: $t('Alarm.index.101383-12'),
                  dataIndex: 'actions',
                  key: 'actions',
                  scopedSlots: true,
              },
          ];
const params = ref();
const handleDescription = ref();
const deviceAlarm = ref();
const solveVisible = ref(false);
const solveType = ref('handle');
const currentAlarm = ref();
const visibleDrawer = ref(false);
const defaultParams =
    props.goal === 'device'
        ? {
              sorts: [{ name: 'alarmTime', order: 'desc' }],
              terms: [
                  {
                      terms: [
                          {
                              column: 'targetId',
                              value: current.id,
                              termType: 'eq',
                          },
                          {
                              column: 'alarmConfigSource',
                              value: 'device-property-preprocessor',
                              termType: 'eq',
                          },
                      ],
                      type: 'and',
                  },
              ],
          }
        : {
              sorts: [{ name: 'alarmTime', order: 'desc' }],
              terms: [
                  {
                      terms: [
                          {
                              column: 'targetId$dev-instance',
                              value: [
                                  {
                                      column: 'product_id',
                                      value: current.id,
                                      termType: 'eq',
                                  },
                              ],
                          },
                          {
                              column: 'alarmConfigSource',
                              value: 'device-property-preprocessor',
                              termType: 'eq',
                          },
                      ],
                      type: 'and',
                  },
              ],
          };
const handleSearch = (e) => {
    params.value = e;
};
const queryHandle = async (id) => {
    const res = await queryPreHandleHistory(id,{
        sorts: [{ name: 'handleTime', order: 'desc' }],
    });
    if (res.status === 200 && res.result?.data.length) {
        handleDescription.value = res.result.data?.[0]?.description;
    }
};
const getActions = (data) => {
    if (!data) return [];
    const actions =
        data.state.value === 'normal'
            ? [
                  {
                      key: 'view',
                      text: $t('Alarm.index.101383-14'),
                      tooltip: {
                          title: $t('Alarm.index.101383-14'),
                      },
                      onClick: async () => {
                          solveType.value = 'view';
                          await queryHandle(data.id);
                          solveVisible.value = true;
                      },
                  },
                  {
                      key: 'log',
                      text: $t('Alarm.index.101383-15'),
                      tooltip: {
                          title: $t('Alarm.index.101383-15'),
                      },
                      onClick: () => {
                          visibleDrawer.value = true;
                          currentAlarm.value = data;
                      },
                  },
              ]
            : [
                  {
                      key: 'solve',
                      text: $t('Alarm.index.101383-16'),
                      tooltip: {
                          title: $t('Alarm.index.101383-16'),
                      },
                      onClick: () => {
                          solveVisible.value = true;
                          solveType.value = 'handle';
                          currentAlarm.value = data;
                      },
                  },
                  {
                      key: 'log',
                      text: $t('Alarm.index.101383-15'),
                      tooltip: {
                          title: $t('Alarm.index.101383-15'),
                      },
                      onClick: () => {
                          visibleDrawer.value = true;
                          currentAlarm.value = data;
                      },
                  },
              ];
    return actions;
};
const closeSolve = () => {
    solveVisible.value = false;
};

const refreshCurrent = async () => {
    const res = await queryAlarmRecord({
        terms: [
            {
                column: 'id',
                termType: 'eq',
                value: currentAlarm.value.id,
            },
            {
                column: 'alarmConfigSource',
                value: 'device-property-preprocessor',
                termType: 'eq',
            },
        ],
    });
    if (res.success && res.result?.data?.length) {
        currentAlarm.value = res.result.data[0];
    }
};

const gotoDevice = (id) => {
    menuStory.jumpPage('device/Instance/Detail', { params: { id, tab: 'Running' }});
};
const refresh = () => {
    deviceAlarm.value?.reload();
    refreshCurrent();
};
const solveRefresh = () => {
    solveVisible.value = false;
    refresh();
};
</script>
<style lang="less" scoped>
.deviceId {
    cursor: pointer;
    color: #4096ff;
}
</style>
