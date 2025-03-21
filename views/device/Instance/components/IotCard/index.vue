<template>
  <div v-if="cardId">
    <Save
      v-if="visible"
      :type="saveType"
      :data="current"
      @change="saveChange"
    />
    <a-row :gutter="[24, 24]">
      <a-col :span="24">
        <a-card>
          <a-descriptions size="small" :column="3" bordered>
            <template #title>
              <Guide>
                <template #title>
                  <span>{{ $t('IotCard.index.369962-0') }}</span>
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
                    <AIcon type="EditOutlined"></AIcon>
                    {{ $t('IotCard.index.369962-1') }}
                  </j-permission-button>
                </template>
              </Guide>
            </template>

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
            <a-descriptions-item :label="$t('IotCard.index.369962-7')">{{
                detail.cardType?.text
              }}</a-descriptions-item>
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
            <a-descriptions-item :label="$t('IotCard.index.369962-10')">{{
                detail.totalFlow
                  ? detail.totalFlow.toFixed(2) + ' M'
                  : '0 M'
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-11')">{{
                detail.usedFlow
                  ? detail.usedFlow.toFixed(2) + ' M'
                  : '0 M'
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-12')">{{
                detail.residualFlow
                  ? detail.residualFlow.toFixed(2) + ' M'
                  : '0 M'
              }}</a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-13')">
              {{ detail?.cardState?.text }}
              <span
                v-if="deactivateData.show"
                style="padding-left: 8px"
              >
                <a-tooltip :title="deactivateData.tip">
                  <AIcon
                    type="ExclamationCircleOutlined"
                    style="
                          color: var(--ant-error-color);
                      "
                  />
                </a-tooltip>
              </span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-14')">
              {{ detail?.cardStateType?.text }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('IotCard.index.369962-15')">{{
                detail?.describe
              }}</a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
      <a-col :span="24">
        <!-- {{ $t('IotCard.index.369962-16') }} -->
        <a-row :gutter="24">
          <a-col :span="16">
            <div class="card">
              <Guide :title="$t('IotCard.index.369962-16')">
                <template #extra>
                  <TimeSelect
                    :type="'week'"
                    :quickBtnList="quickBtnList"
                    @change="getEcharts"
                    :isShowTime="false"
                  />
                </template>
              </Guide>
              <LineChart
                :showX="true"
                :showY="true"
                style="min-height: 490px"
                :chartData="flowData"
              />
            </div>
          </a-col>
          <a-col :span="8">
            <div class="card">
              <Guide :title="$t('IotCard.index.369962-17')" />
              <div
                class="static-info"
                style="min-height: 490px"
              >
                <div class="data-statistics-item">
                  <div
                    class="flow-info"
                    style="width: 100%"
                  >
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
                  <div
                    class="flow-info"
                    style="width: 100%"
                  >
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
                  <div
                    class="flow-info"
                    style="width: 100%"
                  >
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
            </div>
          </a-col>
        </a-row>
      </a-col>
    </a-row>
  </div>
  <JEmpty v-else></JEmpty>
</template>

<script setup lang="ts" name="CardDetail">
import dayjs from 'dayjs';
import type { CardManagement } from './typing';
import {
  queryDeactivate,
  queryDetail,
  query,
} from '../../../../../api/iot-card/cardManagement';
import { queryFlow } from '../../../../../api/iot-card/home';
import TimeSelect from './TimeSelect.vue';
import LineChart from './LineChart.vue';
import Guide from './Guide.vue';
import Save from './Save.vue';
import { OperatorList, platformTypeList } from './data';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
  type: {
    type: String,
    default: 'card',
  },
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

const deactivateData = reactive({
  show: false,
  tip: '',
});

const quickBtnList = [
  { label: $t('IotCard.index.369962-21'), value: 'yesterday' },
  { label: $t('IotCard.index.369962-22'), value: 'week' },
  { label: $t('IotCard.index.369962-23'), value: 'month' },
  { label: $t('IotCard.index.369962-24'), value: 'year' },
];

const getDetail = () => {
  queryDetail(cardId.value).then((resp: any) => {
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

const getData = (start: number, end: number): Promise<{ sortArray: any[] }> => {
  return new Promise((resolve) => {
    queryFlow(start, end, {
      orderBy: 'date',
      terms: [
        {
          column: 'cardId',
          termType: 'eq',
          value: cardId.value,
        },
      ],
    }).then((resp: any) => {
      if (resp.status === 200) {
        const sortArray = resp.result.sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        resolve({
          sortArray,
        });
      }
    });
  });
};

/**
 * 查询左日、当月、本年数据
 */
const getDataTotal = () => {
  const dTime = [
    dayjs(new Date()).subtract(1, 'day').startOf('day').valueOf(),
    dayjs(new Date()).subtract(1, 'day').endOf('day').valueOf(),
  ];
  const mTime = [
    dayjs().startOf('month').valueOf(),
    dayjs().endOf('month').valueOf(),
  ];
  const yTime = [
    dayjs().startOf('year').valueOf(),
    dayjs().endOf('year').valueOf(),
  ];
  getData(dTime[0], dTime[1]).then((resp) => {
    dayTotal.value = resp.sortArray
      .reduce((r, n) => r + Number(n.value), 0)
      .toFixed(2);
    dayOptions.value = resp.sortArray;
  });
  getData(mTime[0], mTime[1]).then((resp) => {
    monthTotal.value = resp.sortArray
      .reduce((r, n) => r + Number(n.value), 0)
      .toFixed(2);
    monthOptions.value = resp.sortArray;
  });
  getData(yTime[0], yTime[1]).then((resp) => {
    yearTotal.value = resp.sortArray
      .reduce((r, n) => r + Number(n.value), 0)
      .toFixed(2);
    yearOptions.value = resp.sortArray;
  });
};

/**
 * 流量统计
 * @param data
 */
const getEcharts = (data: any) => {
  let startTime = data.start;
  let endTime = data.end;
  if (data.type === 'week' || data.type === 'month') {
    startTime = dayjs(data.start).startOf('days').valueOf();
    endTime = dayjs(data.end).startOf('days').valueOf();
  }
  getData(startTime, endTime).then((resp) => {
    flowData.value = resp.sortArray;
  });
};

/**
 * 获取绑定设备的物联卡的信息
 */
const queryCard = async () => {
  const res: any = await query({
    terms: [
      {
        column: 'deviceId',
        termType: 'eq',
        value: route.params.id,
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
.card {
  padding: 24px;
  background-color: #fff;
}

.static-info {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  .data-statistics-item {
    height: 140px;
    background: #fcfcfc;
    border: 1px solid #e0e4e8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;

    .flow-info {
      // width: 180px;
      width: 28%;
      .label {
        font-size: 14px;
        color: rgba(0, 0, 0, 0.64);
      }
      .value {
        font-size: 32px;
        font-weight: bold;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        .unit {
          font-size: 20px;
          font-weight: normal;
        }
      }
    }
  }
}
</style>
