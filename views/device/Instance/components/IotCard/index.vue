<template>
  <div v-if="cardId" class="iot-card-detail">
    <Save
      v-if="visible"
      :type="saveType"
      :data="current"
      @change="saveChange"
    />
    <a-row :gutter="[16, 16]">
      <a-col :span="24">
        <SectionCard
          class="iot-card-detail__section"
          icon="CreditCardOutlined"
          :title="$t('IotCard.index.369962-0')"
        >
          <template #actions>
            <j-permission-button
              type="link"
              hasPermission="iot-card/CardManagement:update"
              @click="
                () => {
                  visible = true;
                  current = detail;
                  saveType = 'edit';
                }
              "
            >
              <AIcon type="EditOutlined" />
              {{ $t('IotCard.index.369962-1') }}
            </j-permission-button>
          </template>
          <a-descriptions class="iot-card-detail__descriptions" size="small" :column="3" bordered>

            <a-descriptions-item :label="$t('IotCard.index.369962-2')">{{
                detail.id
              }}</a-descriptions-item>
            <a-descriptions-item label="ICCID">{{
                detail.iccId
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-3')">{{
                detail.deviceName
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-4')">{{
                platformTypeList.find(
                  (item) =>
                    item.value ===
                    detail.operatorName,
                )?.label || detail.operatorName
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-5')">{{
                detail.platformConfigName
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-6')">{{
                OperatorList.find(
                  (item) =>
                    item.value === detail.operatorName,
                )?.label || detail.operatorName
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('Detail.index.427958-7')">{{
                detail.comboType?.text || "--"
              }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-8')">{{
                detail.activationDate
                  ? dayjs(detail.activationDate).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )
                  : ''
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-9')">{{
                detail.updateTime
                  ? dayjs(detail.updateTime).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )
                  : ''
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-10')">
              <template v-if="detail.comboType?.value === 'pool'">
                {{
                  detail.poolTotalFlow ? detail.poolTotalFlow.toFixed(2) + " M" : "0 M"
                }}
              </template>
              <template v-else>
                {{
                  detail.totalFlow ? detail.totalFlow.toFixed(2) + " M" : "0 M"
                }}
              </template>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-11')">{{
                detail.usedFlow
                  ? detail.usedFlow.toFixed(2) + ' M'
                  : '0 M'
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-12')">
              <template v-if="detail.comboType?.value === 'pool'">
                {{
                  detail.poolResidualFlow
                      ? detail.poolResidualFlow.toFixed(2) + " M"
                      : "0 M"
                }}
              </template>
              <template v-else>
                {{
                  detail.residualFlow
                      ? detail.residualFlow.toFixed(2) + " M"
                      : "0 M"
                }}
              </template>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('Detail.index.427958-13')">
              {{ detail?.cardState?.text }}
              <span v-if="deactivateData.show" class="iot-card-detail__status-tip">
                  <a-tooltip :title="deactivateData.tip">
                    <AIcon class="iot-card-detail__status-tip-icon" type="ExclamationCircleOutlined" />
                  </a-tooltip>
                </span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('Detail.index.427958-14')">
              <div class="iot-card-detail__status">
                <div class="iot-card-detail__status-value">
                  {{ detail?.cardStateType?.text }}
                </div>
                <div
                    class="iot-card-detail__status-error"
                    v-if="detail?.syncCardStatus?.value === 'failed'"
                >
                  <AIcon type="ExclamationCircleFilled"/>
                  <j-ellipsis>{{ detail?.errorMessage }}</j-ellipsis>
                </div>
              </div>
            </a-descriptions-item>
            <a-descriptions-item>
              <template #label>
                <div>
                  {{ $t("Detail.index.427958-25") }}
                  <a-tooltip>
                    <template #title>{{
                        $t("Detail.index.427958-26")
                      }}
                    </template>
                    <AIcon type="QuestionCircleOutlined"></AIcon>
                  </a-tooltip>
                </div>
              </template>
              {{ detail?.syncCardStatus?.text }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('Detail.index.427958-27')">
              <div class="iot-card-detail__status">
                <div class="iot-card-detail__status-value">
                  <template v-if="detail.flowError === true">
                    {{ $t('CardManagement.index.427944-19') }}
                  </template>
                  <template v-else-if="detail.flowError === false">
                    {{ $t('CardManagement.index.427944-50') }}
                  </template>
                  <template v-else>
                    {{$t('CardManagement.index.427944-18')}}
                  </template>
                </div>
                <div
                    class="iot-card-detail__status-error"
                    v-if="detail?.flowError"
                >
                  <AIcon type="ExclamationCircleFilled"/>
                  <j-ellipsis>{{ detail?.flowErrorMessage }}</j-ellipsis>
                </div>
              </div>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('Detail.index.427958-32')">
              <a @click="onClick">{{ detail.poolAlias || detail.poolName }}</a>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('Detail.index.427958-28')">
              <j-ellipsis>
                {{
                  marks[0]?.longitude &&marks[0]?.latitude ? `${marks[0]?.location}` : '--'
                }}
              </j-ellipsis>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-15')">{{
                detail?.describe
              }}</a-descriptions-item>
          </a-descriptions>
        </SectionCard>
      </a-col>
      <a-col :span="24">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :lg="16">
            <SectionCard
              class="iot-card-detail__section iot-card-detail__section--traffic"
              icon="LineChartOutlined"
              :title="$t('IotCard.index.369962-16')"
            >
              <template #actions>
                <TimeSelect
                  :type="'week'"
                  :quickBtnList="quickBtnList"
                  @change="getEcharts"
                  :isShowTime="false"
                />
              </template>
              <LineChart
                :showX="true"
                :showY="true"
                class="iot-card-detail__traffic-chart"
                :chartData="flowData"
              />
            </SectionCard>
          </a-col>
          <a-col :xs="24" :lg="8">
            <SectionCard
              class="iot-card-detail__section iot-card-detail__section--statistics"
              icon="BarChartOutlined"
              :title="$t('IotCard.index.369962-17')"
            >
              <template #actions>
                <a-button type="link" @click="onSyncRecord">{{ $t('Detail.index.427958-29') }}</a-button>
              </template>
              <div class="static-info">
                <div class="data-statistics-item">
                  <div class="flow-info">
                    <div class="label">
                      {{ $t('IotCard.index.369962-18') }}
                    </div>
                    <a-tooltip placement="bottomLeft">
                      <template #title>
                        <span>
                          {{ dayTotal }} M
                        </span>
                      </template>
                      <div class="value">
                        {{ dayTotal }}
                        <span class="unit">M</span>
                      </div>
                    </a-tooltip>
                  </div>
                  <LineChart
                    color="#FBA500"
                    :chartData="dayOptions"
                  />
                </div>
                <div class="data-statistics-item">
                  <div class="flow-info">
                    <div class="label">
                      {{ $t('IotCard.index.369962-19') }}
                    </div>
                    <a-tooltip placement="bottomLeft">
                      <template #title>
                        <span>
                          {{ monthTotal }}M
                        </span>
                      </template>
                      <div class="value">
                        {{ monthTotal }}
                        <span class="unit">M</span>
                      </div>
                    </a-tooltip>
                  </div>
                  <LineChart :chartData="monthOptions" />
                </div>
                <div class="data-statistics-item">
                  <div class="flow-info">
                    <div class="label">
                      {{ $t('IotCard.index.369962-20') }}
                    </div>
                    <a-tooltip placement="bottomLeft">
                      <template #title>
                        <span>
                          {{ yearTotal }} M
                        </span>
                      </template>
                      <div class="value">
                        {{ yearTotal }}
                        <span class="unit">M</span>
                      </div>
                    </a-tooltip>
                  </div>
                  <LineChart
                    color="#58E1D3"
                    :chartData="yearOptions"
                  />
                </div>
              </div>
            </SectionCard>
          </a-col>
        </a-row>
      </a-col>
      <a-col :span="24" v-if="detail.platformType?.value !== 'unicom'">
        <SectionCard
          class="iot-card-detail__section iot-card-detail__section--location"
          icon="EnvironmentOutlined"
          :title="$t('Detail.index.427958-30')"
        >
          <a-spin :spinning="loading">
            <div class="iot-card-detail__location-map">
              <RealTimeMap :marks="marks" :isShow="true"/>
              <div class="actions">
                <a-tooltip :title="$t('Detail.index.427958-31')">
                  <a-button type="primary" ghost @click="getPositions(cardId)">
                    <AIcon type="WifiOutlined"/>
                    {{ $t('Detail.index.427958-28') }}
                  </a-button>
                </a-tooltip>
              </div>
            </div>
          </a-spin>
        </SectionCard>
      </a-col>
    </a-row>
  </div>
  <JEmpty v-else></JEmpty>
  <SyncRecord
      v-if="sync.visible"
      @close="sync.visible = false"
      :data="sync.data"
  />
</template>

<script setup lang="ts" name="CardDetail">
import dayjs from 'dayjs';
import type { CardManagement } from './typing';
import {
  queryDeactivate,
  queryDetailById,
  query,
} from '../../../../../api/iot-card/cardManagement';
import TimeSelect from './TimeSelect.vue';
import LineChart from './LineChart.vue';
import Save from './Save.vue';
import { OperatorList, platformTypeList } from './data';
import { useI18n } from 'vue-i18n';
import {dashboard} from "@device-manager-ui/api/dashboard";
import {map} from "lodash-es";
import RealTimeMap from "./RealTimeMap.vue";
import {getPositionById, queryLocationById} from "@device-manager-ui/api/iot-card/realtimePositioning";
import SyncRecord from "./SyncRecord/index.vue";
import {useMenuStore} from "@jetlinks-web-core/store";
import {onlyMessage} from "@jetlinks-web/utils";

const { t: $t } = useI18n();

const props = defineProps({
  type: {
    type: String,
    default: 'card',
  },
  deviceId: String,
});

const route = useRoute();
const cardId = ref();

const visible = ref<boolean>(false);
const current = ref<Partial<CardManagement>>({});
const saveType = ref<string>('');
const detail = ref<any>({});

const flowData = ref<any[]>([]);
const dayTotal = ref(0);
const monthTotal = ref(0);
const yearTotal = ref(0);
const dayOptions = ref<any[]>([]);
const monthOptions = ref<any[]>([]);
const yearOptions = ref<any[]>([]);
const menuStore = useMenuStore()
const deactivateData = reactive({
  show: false,
  tip: '',
});
const marks = ref<any[]>([])
const loading = ref(false)
const sync = reactive({
  visible: false,
  data: {},
});

const quickBtnList = [
  { label: $t('IotCard.index.369962-21'), value: 'yesterday' },
  { label: $t('IotCard.index.369962-22'), value: 'week' },
  { label: $t('IotCard.index.369962-23'), value: 'month' },
  { label: $t('IotCard.index.369962-24'), value: 'year' },
];

const onSyncRecord = () => {
  sync.visible = true;
  sync.data = detail.value
}

const onClick = () => {
  menuStore.jumpPage('iot-card/TrafficPoolManagement/Detail', {
    params: {id: detail.value.poolId}
  })
}

const getDetail = () => {
  queryDetailById(cardId.value).then((resp: any) => {
    if (resp.success) {
      detail.value = resp.result;

      if (resp.result.cardStateType?.value === 'deactivate' && detail.value.operatorName === 'onelink') {
        deactivateData.show = true;
        //   获取停机原因
        queryDeactivate(cardId.value).then((deacResp: any) => {
          if (deacResp.success && deacResp.result?.message) {
            deactivateData.tip = deacResp.result.message.toString();
          }
        });
      }

      if(detail.value.platformType?.value !== 'unicom'){
        getPositionsHistory(cardId.value)
      }
    }
  });
};

/**
 * 新增、编辑关闭弹窗
 * @param val 加载表格
 */
const saveChange = (val: any) => {
  visible.value = false;
  current.value = {};
  if (val) {
    getDetail();
  }
};

// const getData = (start: number, end: number): Promise<{ sortArray: any[] }> => {
//   return new Promise((resolve) => {
//     queryFlow(start, end, {
//       orderBy: 'date',
//       terms: [
//         {
//           column: 'cardId',
//           termType: 'eq',
//           value: cardId.value,
//         },
//       ],
//     }).then((resp: any) => {
//       if (resp.status === 200) {
//         const sortArray = resp.result.sort(
//           (a: any, b: any) =>
//             new Date(a.date).getTime() - new Date(b.date).getTime(),
//         );
//         resolve({
//           sortArray,
//         });
//       }
//     });
//   });
// };
const getData = (list = [], key: string) => {
  return list.filter(i => {
    return i.group === key
  }).map(i => i.data).reverse()
}

/**
 * 查询左日、当月、本年数据
 */
// const getDataTotal = () => {
//   const dTime = [
//     dayjs(new Date()).subtract(1, 'day').startOf('day').valueOf(),
//     dayjs(new Date()).subtract(1, 'day').endOf('day').valueOf(),
//   ];
//   const mTime = [
//     dayjs().startOf('month').valueOf(),
//     dayjs().endOf('month').valueOf(),
//   ];
//   const yTime = [
//     dayjs().startOf('year').valueOf(),
//     dayjs().endOf('year').valueOf(),
//   ];
//   getData(dTime[0], dTime[1]).then((resp) => {
//     dayTotal.value = resp.sortArray
//       .reduce((r, n) => r + Number(n.value), 0)
//       .toFixed(2);
//     dayOptions.value = resp.sortArray;
//   });
//   getData(mTime[0], mTime[1]).then((resp) => {
//     monthTotal.value = resp.sortArray
//       .reduce((r, n) => r + Number(n.value), 0)
//       .toFixed(2);
//     monthOptions.value = resp.sortArray;
//   });
//   getData(yTime[0], yTime[1]).then((resp) => {
//     yearTotal.value = resp.sortArray
//       .reduce((r, n) => r + Number(n.value), 0)
//       .toFixed(2);
//     yearOptions.value = resp.sortArray;
//   });
// };
const getDataTotal = async () => {
  const dTime = [
    dayjs(new Date()).subtract(1, "day").startOf("day").valueOf(),
    dayjs(new Date()).subtract(1, "day").endOf("day").valueOf(),
  ];
  // const dParams = isTimer.value
  //     ? {
  //       context: {
  //         format: "M月dd日 HH:mm:ss",
  //         time: "1h",
  //         from: dTime?.[0],
  //         to: dTime?.[1],
  //         cardId: cardId.value,
  //         limit: 24,
  //       },
  //     }
  //     : {
  //       orderBy: "date",
  //       terms: [
  //         {
  //           column: "cardId",
  //           termType: "eq",
  //           value: cardId.value,
  //         },
  //       ],
  //     };
  const mTime = [
    dayjs().startOf("month").valueOf(),
    dayjs().endOf("month").valueOf(),
  ];
  // const mParams = isTimer.value
  //     ? {
  //       context: {
  //         format: "Y年M月d日",
  //         time: "1d",
  //         from: mTime?.[0],
  //         to: mTime?.[1],
  //         cardId: cardId.value,
  //         limit: 31,
  //       },
  //     }
  //     : {
  //       orderBy: "date",
  //       terms: [
  //         {
  //           column: "cardId",
  //           termType: "eq",
  //           value: cardId.value,
  //         },
  //       ],
  //     };
  const yTime = [
    dayjs().startOf("year").valueOf(),
    dayjs().endOf("year").valueOf(),
  ];
  // const yParams = isTimer.value
  //     ? {
  //       context: {
  //         format: "Y年M月",
  //         time: "1M",
  //         from: yTime?.[0],
  //         to: yTime?.[1],
  //         cardId: cardId.value,
  //         limit: 12,
  //       },
  //     }
  //     : {
  //       orderBy: "date",
  //       terms: [
  //         {
  //           column: "cardId",
  //           termType: "eq",
  //           value: cardId.value,
  //         },
  //       ],
  //     };
  // getData(dTime[0], dTime[1], dParams).then((resp) => {
  //   dayTotal.value = resp.sortArray
  //       .reduce((r, n) => r + Number(n.value), 0)
  //       .toFixed(2);
  //   dayOptions.value = resp.sortArray;
  // });
  // getData(mTime[0], mTime[1], mParams).then((resp) => {
  //   monthTotal.value = resp.sortArray
  //       .reduce((r, n) => r + Number(n.value), 0)
  //       .toFixed(2);
  //   monthOptions.value = resp.sortArray;
  // });
  // getData(yTime[0], yTime[1], yParams).then((resp) => {
  //   yearTotal.value = resp.sortArray
  //       .reduce((r, n) => r + Number(n.value), 0)
  //       .toFixed(2);
  //   yearOptions.value = resp.sortArray;
  // });
  const dParams = [
    {
      "dashboard": "flow",
      "object": "networkCardFlow",
      "measurement": "trend",
      "dimension": "agg",
      "group": "year",  //分组：本年year,当月month、昨日lastDay
      "params": {
        "format": $t('Dashboard.index.537937-12'),
        "time": "1M",
        from: yTime?.[0],
        to: yTime?.[1],
        "limit": 12,
        cardId: cardId.value
      }
    },
    {
      "dashboard": "flow",
      "object": "networkCardFlow",
      "measurement": "trend",
      "dimension": "agg",
      "group": "month",    //分组
      "params": {
        format: $t('Dashboard.index.537937-11'),
        time: "1d",
        from: mTime?.[0],
        to: mTime?.[1],
        limit: 31,
        cardId: cardId.value
      }
    },
    {
      "dashboard": "flow",
      "object": "networkCardFlow",
      "measurement": "trend",
      "dimension": "agg",
      "group": "lastDay",  //分组
      "params": {
        format: $t('Dashboard.index.537937-10'),
        time: "1h",
        from: dTime?.[0],
        to: dTime?.[1],
        limit: 24,
        cardId: cardId.value
      }
    }
  ]
  const resp: any = await dashboard(dParams)
  if(resp.success){
    dayOptions.value = getData(resp.result, 'lastDay')
    monthOptions.value = getData(resp.result, 'month')
    yearOptions.value = getData(resp.result, 'year')
    dayTotal.value = dayOptions.value.reduce((r, n) => r + Number(n.value), 0).toFixed(2)
    monthTotal.value = monthOptions.value.reduce((r, n) => r + Number(n.value), 0).toFixed(2);
    yearTotal.value = yearOptions.value.reduce((r, n) => r + Number(n.value), 0).toFixed(2);
  }
};
/**
 * 流量统计
 * @param data
 */
// const getEcharts = (data: any) => {
//   let startTime = data.start;
//   let endTime = data.end;
//   if (data.type === 'week' || data.type === 'month') {
//     startTime = dayjs(data.start).startOf('days').valueOf();
//     endTime = dayjs(data.end).startOf('days').valueOf();
//   }
//   getData(startTime, endTime).then((resp) => {
//     flowData.value = resp.sortArray;
//   });
// };
const getEcharts = async (data: any) => {
  let startTime = data.start;
  let endTime = data.end;
  if (data.type !== "day") {
    startTime = dayjs(data.start).startOf("days").valueOf();
    endTime = dayjs(data.end).startOf("days").valueOf();
  }
  let _time = "1m";
  let format = "M月dd日 HH:mm";
  let limit = 12;
  const dt = endTime - startTime;
  const hour = 60 * 60 * 1000;
  const days = hour * 24;
  const months = days * 30;
  const year = 365 * days;
  if (dt <= hour + 10) {
    _time = "1h";
    limit = 24;
    // Keep the date-bearing default so a short range crossing midnight remains unambiguous.
  } else if (dt > hour && dt <= days) {
    _time = "1h";
    limit = 24;
  } else if (dt > days && dt < year) {
    limit = Math.abs(Math.ceil(dt / days)) + 1;
    _time = "1d";
    format = "M月dd日";
  } else if (dt >= year) {
    limit = Math.abs(Math.floor(dt / months));
    _time = "1M";
    format = "yyyy年-M月";
  }
  // const params = isTimer.value
  //     ? {
  //       context: {
  //         time: _time,
  //         format: format,
  //         limit: limit,
  //         cardId: cardId.value,
  //         from: data.start,
  //         to: data.end,
  //       },
  //     }
  //     : {
  //       orderBy: "date",
  //       terms: [
  //         {
  //           column: "cardId",
  //           termType: "eq",
  //           value: cardId.value,
  //         },
  //       ],
  //     };
  // getData(startTime, endTime, params).then((resp) => {
  //   flowData.value = resp.sortArray;
  // });
  const params = {
    "dashboard": "flow",
    "object": "networkCardFlow",
    "measurement": "trend",
    "dimension": "agg",
    "params": {
      time: _time,
      format: format,
      limit: limit,
      from: data.start,
      to: data.end,
      cardId: cardId.value
    }
  }
  const resp: any = await dashboard(params)
  if(resp.success){
    flowData.value = map(resp.result, 'data').reverse()
  }
};

const getPositions = async (id: string) => {
  loading.value = true
  const res: any = await getPositionById(id).finally(() => {
    loading.value = false
  })
  if (res.success) {
    marks.value = res.result.error === false ? [res.result] : []
    if(!res.result || res.result.error){
      onlyMessage($t('RealtimePositioning.index.390590-14'), 'error')
    }
  }
}

/**
 * 加载运营商已同步的最后定位记录。
 *
 * 无历史记录时接口仍会返回成功响应但不包含 result，应按无定位数据处理。
 */
const getPositionsHistory = async (id: string) => {
  loading.value = true
  marks.value = []
  const res: any = await queryLocationById(id).finally(() => {
    loading.value = false
  })
  if (res.success && res.result?.error === false) {
    marks.value = [res.result]
  }
}

/**
 * 获取绑定设备的物联卡的信息
 */
const queryCard = async () => {
  // 新版设备详情通过页签 Provider 显式传入设备 ID；保留路由参数以兼容旧详情页。
  const deviceId = props.deviceId || route.params.id;
  const res: any = await query({
    terms: [
      {
        column: 'deviceId',
        termType: 'eq',
        value: deviceId,
      },
    ],
  });
  if (res.success && res.result?.data) {
    cardId.value = res.result?.data?.[0]?.id;
  }
};

onMounted(async () => {
  if (props.type === 'device') {
    await queryCard();
  } else {
    cardId.value = route.params.id;
  }
  if (cardId.value) {
    getDetail();
    getDataTotal();
  }
});
</script>
<style scoped lang="less">
.iot-card-detail {
  min-width: 0;
}

.iot-card-detail__section {
  height: 100%;
  margin-bottom: 0;
}

.iot-card-detail__descriptions {
  :deep(.ant-descriptions-view) {
    overflow: hidden;
    border-color: var(--jet-theme-border-secondary);
    border-radius: var(--r-3);
  }

  :deep(.ant-descriptions-item-label) {
    color: var(--jet-theme-text-secondary);
    background: var(--jet-theme-bg-layout);
  }

  :deep(.ant-descriptions-item-content) {
    color: var(--jet-theme-text);
    background: var(--jet-theme-bg-container);
  }
}

.static-info {
  display: flex;
  flex-direction: column;
  min-height: 30.625rem;
  gap: var(--space-3);

  .data-statistics-item {
    flex: 1 1 0;
    min-height: 0;
    padding: var(--space-3);
    border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-secondary);
    border-radius: var(--r-3);
    background: var(--jet-theme-bg-layout);
    display: flex;
    justify-content: space-between;
    align-items: center;

    .flow-info {
      flex: 1 1 auto;
      min-width: 0;

      .label {
        color: var(--jet-theme-text-secondary);
        font-size: var(--fs-14);
      }

      .value {
        overflow: hidden;
        color: var(--jet-theme-text-title);
        font-size: var(--fs-h1);
        font-weight: bold;
        white-space: nowrap;
        text-overflow: ellipsis;

        .unit {
          margin-left: var(--space-1);
          color: var(--jet-theme-text-secondary);
          font-size: var(--fs-18);
          font-weight: normal;
        }
      }
    }

    :deep(.chart) {
      flex: 0 0 7.5rem;
      height: 5.5rem;
    }
  }
}
.actions {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
}

.iot-card-detail__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.iot-card-detail__status-value {
  flex: 0 0 auto;
  min-width: 3.75rem;
}

.iot-card-detail__status-error {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--space-1);
  color: var(--jet-theme-error);
}

.iot-card-detail__status-tip {
  padding-left: var(--space-2);
}

.iot-card-detail__status-tip-icon {
  color: var(--jet-theme-error);
}

.iot-card-detail__traffic-chart {
  display: block;
  min-height: 30.625rem;
}

.iot-card-detail__location-map {
  position: relative;
  width: 100%;
  height: 31.25rem;
}

@media (max-width: 62rem) {
  .static-info,
  .iot-card-detail__traffic-chart {
    min-height: 24rem;
  }

  .iot-card-detail__location-map {
    height: 24rem;
  }
}

@media (max-width: 36rem) {
  .static-info {
    min-height: 0;
  }

  .static-info .data-statistics-item {
    min-height: 8.75rem;
  }

  .iot-card-detail__status {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-1);
  }
}
</style>
