<template>
    <j-page-container>
        <div class="DashBoardBox">
            <a-row :gutter="24">
                <a-col :span="6">
                    <TopCard
                        :title="$t('DashBoard.index.954313-0')"
                        :img="device.deviceProduct"
                        :footer="productFooter"
                        :value="productTotal"
                    ></TopCard>
                </a-col>
                <a-col :span="6">
                    <TopCard
                        :title="$t('DashBoard.index.954313-1')"
                        :img="device.deviceNumber"
                        :footer="deviceFooter"
                        :value="deviceTotal"
                    ></TopCard
                ></a-col>
                <a-col :span="6"
                    ><TopCard
                        :title="$t('DashBoard.index.954313-2')"
                        :footer="onlineFooter"
                        :value="deviceOnline"
                    >
                        <Charts :options="onlineOptions"></Charts> </TopCard
                ></a-col>
                <a-col :span="6"
                    ><TopCard
                        :title="$t('DashBoard.index.954313-3')"
                        :footer="messageFooter"
                        :value="dayMessage"
                    >
                        <Charts :options="TodayDevOptions"></Charts> </TopCard
                ></a-col>
            </a-row>
            <a-row :gutter="24">
                <a-col :span="24">
                    <div class="message-card">
                        <Guide :title="$t('DashBoard.index.954313-4')">
                            <template #extra>
                                <TimeSelect
                                    key="flow-static"
                                    :quickBtnList="[
                                        { label: $t('DashBoard.index.954313-5'), value: 'hour' },
                                        { label: $t('DashBoard.index.954313-6'), value: 'day' },
                                        { label: $t('DashBoard.index.954313-7'), value: 'week' },
                                    ]"
                                    :type="'week'"
                                    @change="getEcharts"
                                />
                            </template>
                        </Guide>
                        <div class="message-chart">
                            <Charts :options="devMegOptions"></Charts>
                        </div>
                    </div>
                </a-col>
            </a-row>
            <a-row :span="24" v-if="AmapKey && isNoCommunity">
                <a-col :span="24">
                    <div class="device-position">
                        <Guide :title="$t('DashBoard.index.954313-8')"></Guide>
                        <div class="device-map">
                            <Amap></Amap>
                        </div>
                    </div>
                </a-col>
            </a-row>
        </div>
    </j-page-container>
</template>
<script lang="ts" setup>
import TimeSelect from './components/TimeSelect.vue';
import Charts from './components/Charts.vue';
import Guide from './components/Guide.vue';
import {
    productCount,
    deviceCount,
    dashboard,
} from '../../../api/dashboard';
import {encodeQuery} from '@/utils';
import type { Footer } from './typings';
import TopCard from './components/TopCard.vue';
import { useMenuStore } from '@/store/menu';
import Amap from './components/Amap.vue';
import { useSystemStore } from '@/store/system';
import dayjs from 'dayjs'
import { isNoCommunity } from '@/utils/utils'
import { device } from "../../../assets";
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const system = useSystemStore();
const AmapKey = system.systemInfo.amap?.apiKey;
let productTotal = ref(0);
let productFooter = ref<Footer[]>([
    {
        title: $t('DashBoard.index.954313-9'),
        value: 0,
        status: 'success',
    },
    {
        title: $t('DashBoard.index.954313-10'),
        value: 0,
        status: 'error',
    },
]);
let deviceTotal = ref(0);
let deviceFooter = ref<Footer[]>([
    {
        title: $t('DashBoard.index.954313-11'),
        value: 0,
        status: 'success',
    },
    {
        title: $t('DashBoard.index.954313-12'),
        value: 0,
        status: 'error',
    },
]);
let deviceOnline = ref(0);
let onlineFooter = ref<Footer[]>([
    {
        title: $t('DashBoard.index.954313-13'),
        value: 0,
    },
]);
let dayMessage = ref(0);
let messageFooter = ref<Footer[]>([
    {
        title: $t('DashBoard.index.954313-14'),
        value: 0,
    },
]);
let messageChartXData = ref<any[]>([]);
let messageChartYData = ref<any[]>([]);
let messageMaxChartYData = ref<number>();
let onlineOptions = ref<any>({});
let TodayDevOptions = ref<any>({});
let devMegOptions = ref<any>({});
const menuStore = useMenuStore();
// const quickBtnList = [
//     { label: '昨日', value: 'yesterday' },
//     { label: $t('DashBoard.index.954313-7'), value: 'week' },
//     { label: '近一月', value: 'month' },
//     { label: '近一年', value: 'year' },
// ];
/**
 * 获取产品数量
 */
const getProductData = () => {
    // if (menuStore.hasMenu('device/Product')) {
        productCount({}).then((res) => {
            if (res.status == 200) {
                productTotal.value = res.result;
            }
        });
        productCount({
            terms: [
                {
                    column: 'state',
                    value: '1',
                },
            ],
        }).then((res) => {
            if (res.status == 200) {
                productFooter.value[0].value = res.result;
            }
        });
        productCount({
            terms: [
                {
                    column: 'state',
                    value: '0',
                },
            ],
        }).then((res) => {
            if (res.status == 200) {
                productFooter.value[1].value = res.result;
            }
        });
    // }
};
getProductData();
/**
 * 获取设备数量
 */
const getDeviceData = () => {
    // if (menuStore.hasMenu('device/Instance')) {
        deviceCount().then((res) => {
            if (res.status == 200) {
                deviceTotal.value = res.result;
            }
        });
        deviceCount(encodeQuery({ terms: { state: 'online' } })).then((res) => {
            if (res.status == 200) {
                deviceFooter.value[0].value = res.result;
                deviceOnline.value = res.result;
            }
        });
        deviceCount(encodeQuery({ terms: { state: 'offline' } })).then(
            (res) => {
                if (res.status == 200) {
                    deviceFooter.value[1].value = res.result;
                }
            },
        );
    // }
};
getDeviceData();
/**
 * 获取在线数量
 */
const getOnline = () => {
    const startTime = dayjs().subtract(0, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const endTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

    dashboard([
        {
            dashboard: 'device',
            object: 'session',
            measurement: 'online',
            dimension: 'agg',
            group: 'aggOnline',
            params: {
                state: 'online',
                limit: 24,
                from: startTime,
                to: endTime,
                time: '1h',
                format: 'yyyy-MM-dd HH:mm:ss',
            },
        },
    ]).then((res) => {
        if (res.status == 200) {
            // const x = res.result
            //     .map((item: any) => item.data.timeString)
            //     .reverse();
            // const y = res.result.map((item: any) => item.data.value);
            const x: string[] = [];
            const y: number[] = [];
            (res.result as any)?.forEach((item: any) => {
              x.push(item.data.timeString)
              y.push(item.data.value)
            })
            x.reverse()
            const onlineYdata = y;
            onlineYdata.reverse();
            setOnlineChartOption(x, onlineYdata);
        }
    });
};

/**
 * 昨日在线
 */
const getYesterdayOnline = () => {
  const startTime = dayjs().subtract(1, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const endTime = dayjs().subtract(1, 'days').endOf('day').format('YYYY-MM-DD HH:mm:ss');

  dashboard([
    {
      dashboard: 'device',
      object: 'session',
      measurement: 'online',
      dimension: 'agg',
      group: 'aggOnline',
      params: {
        state: 'online',
        limit: 24,
        from: startTime,
        to: endTime,
        time: '1d',
        format: 'yyyy-MM-dd HH:mm:ss',
      },
    },
  ]).then((res) => {
    if (res.status == 200) {
      onlineFooter.value[0].value = res.result?.[0]?.data.value || 0
    }
  });
}

const setOnlineChartOption = (x: Array<any>, y: Array<number>): void => {
    onlineOptions.value = {
        xAxis: {
            type: 'category',
            data: x,
            show: false,
        },
        yAxis: {
            type: 'value',
            show: false,
        },
        grid: {
            top: '5%',
            bottom: 0,
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow',
            },
        },
        series: [
            {
                name: $t('DashBoard.index.954313-15'),
                data: y,
                type: 'line',
                smooth: true, // 是否平滑曲线
                symbolSize: 0, // 拐点大小
                showBackground: true,
                color: '#D3ADF7',
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            {
                                offset: 0,
                                color: '#D3ADF7', // 100% 处的颜色
                            },
                            {
                                offset: 1,
                                color: '#FFFFFF', //   0% 处的颜色
                            },
                        ],
                        global: false, // 缺省为 false
                    },
                },
            },
        ],
    };
};
const setTodayDevChartOption = (x: Array<any>, y: Array<number>): void => {
    TodayDevOptions = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow',
            },
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            show: false,
            data: x,
        },
        yAxis: {
            type: 'value',
            show: false,
        },
        grid: {
            top: '2%',
            bottom: 0,
        },
        series: [
            {
                name: $t('DashBoard.index.954313-16'),
                data: y,
                type: 'line',
                smooth: true, // 是否平滑曲线
                symbolSize: 0, // 拐点大小
                color: '#F29B55',
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            {
                                offset: 0,
                                color: '#FBBB87', // 100% 处的颜色
                            },
                            {
                                offset: 1,
                                color: '#FFFFFF', //   0% 处的颜色
                            },
                        ],
                        global: false, // 缺省为 false
                    },
                },
            },
        ],
    };
};
const setDevMesChartOption = (
    x: Array<any>,
    y: Array<number>,
    maxY: number,
): void => {
  const yLen = String(Math.ceil(maxY)).length
    devMegOptions.value = {
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: x,
        },
        yAxis: {
            type: 'value',
        },
        tooltip: {
            trigger: 'axis',
            formatter: '{b0}<br />{a0}: {c0}',
            // formatter: '{b0}<br />{a0}: {c0}<br />{a1}: {c1}%'
        },
        grid: {
            top: '2%',
            bottom: '5%',
            left: maxY < 900000 ? '60px' : (yLen * 7.5 +  Math.floor(yLen/3) * 1.2 + 10) + 'px',
            right: '50px',
        },
        series: [
            // {
            //     name: $t('DashBoard.index.954313-16'),
            //     data: y,
            //     type: 'bar',
            //     // type: 'line',
            //     // smooth: true,
            //     color: '#597EF7',
            //     barWidth: '30%',
            //     // areaStyle: {
            //     //   color: {
            //     //     type: 'linear',
            //     //     x: 0,
            //     //     y: 0,
            //     //     x2: 0,
            //     //     y2: 1,
            //     //     colorStops: [
            //     //       {
            //     //         offset: 0,
            //     //         color: '#685DEB', // 100% 处的颜色
            //     //       },
            //     //       {
            //     //         offset: 1,
            //     //         color: '#FFFFFF', //   0% 处的颜色
            //     //       },
            //     //     ],
            //     //     global: false, // 缺省为 false
            //     //   },
            //     // },
            // },
            {
                name: $t('DashBoard.index.954313-16'),
                data: y,
                // data: percentageY,
                type: 'line',
                smooth: true,
                symbolSize: 0, // 拐点大小
                color: '#ADC6FF',
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            {
                                offset: 0,
                                color: '#ADC6FF', // 100% 处的颜色
                            },
                            {
                                offset: 1,
                                color: '#FFFFFF', //   0% 处的颜色
                            },
                        ],
                        global: false, // 缺省为 false
                    },
                },
            },
        ],
    };
};

//今日设备消息量
const getDevice = () => {
  const startTime = dayjs().subtract(0, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const endTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

    dashboard([
        {
            dashboard: 'device',
            object: 'message',
            measurement: 'quantity',
            dimension: 'agg',
            group: 'today',
            params: {
                time: '1h',
                format: 'yyyy-MM-dd HH:mm:ss',
                limit: 24,
                from: startTime,
                to: endTime
            },
        },
        {
            dashboard: 'device',
            object: 'message',
            measurement: 'quantity',
            dimension: 'agg',
            group: 'oneday',
            params: {
                time: '1d',
                format: 'yyyy-MM-dd',
                from: 'now-1d',
            },
        },
        {
            dashboard: 'device',
            object: 'message',
            measurement: 'quantity',
            dimension: 'agg',
            group: 'thisMonth',
            params: {
                time: '1M',
                format: 'yyyy-MM',
                limit: 1,
                from: 'now-1M',
            },
        },
    ]).then((res) => {
        if (res.status == 200) {
            const thisMonth = res.result.find(
                (item: any) => item.group === 'thisMonth',
            )?.data.value;
            const oneDay = res.result.find(
                (item: any) => item.group === 'oneday',
            )?.data.value;
            dayMessage.value = oneDay;
            messageFooter.value[0].value = thisMonth;
            const today = res.result.filter(
                (item: any) => item.group === 'today',
            );
            const x = today.map((item: any) => item.data.timeString).reverse();
            const y = today.map((item: any) => item.data.value).reverse();
            setTodayDevChartOption(x, y);
        }
    });
};

const getEcharts = (data: any) => {
    let _time = '1m';
    let format = $t('DashBoard.index.954313-17');
    let limit = 12;
    const dt = data.end - data.start;
    const hour = 60 * 60 * 1000;
    const days = hour * 24;
    const months = days * 30;
    const year = 365 * days;
    if (dt <= (hour + 10)) {
        limit = 60
        format = 'HH:mm';
    } else if (dt > hour && dt <= days) {
        _time = '1h'
        limit = 24;

    } else if (dt > days && dt < year) {
        limit = Math.abs(Math.ceil(dt / days)) + 1;
        _time = '1d';
        format = $t('DashBoard.index.954313-18');
    } else if (dt >= year) {
        limit = Math.abs(Math.floor(dt / months));
        _time = '1M';
        format = $t('DashBoard.index.954313-19');
    }

    dashboard([
        {
            dashboard: 'device',
            object: 'message',
            measurement: 'quantity',
            dimension: 'agg',
            group: 'device_msg',
            params: {
                time: _time,
                format: format,
                limit: limit,
                from: data.start,
                to: data.end,
            },
        },
    ]).then((res: any) => {
        if (res.status === 200) {
            const x = res.result
                .map((item: any) =>
                    _time === '1h'
                        ? $t('DashBoard.index.954313-20', [item.data.timeString])
                        : item.data.timeString,
                )
                .reverse();
            const y = res.result.map((item: any) => item.data.value).reverse();
            const maxY = Math.max.apply(
                null,
                y.length ? y : [0],
            );

            setDevMesChartOption(x, y, maxY);
        }
    });
};

getOnline();
getYesterdayOnline()
getDevice();

</script>
<style lang="less" scoped>
.message-card,
.device-position {
    margin-top: 24px;
    padding: 24px;
    background-color: white;
}
.message-chart {
    width: 100%;
    height: 470px;
}
.amap-box {
    height: 500px;
    width: 100%;
}
</style>
