<template>
    <a-modal
        visible
        :title="$t('Detail.index.805835-0')"
        :width="1200"
        :closable="false"
        :maskClosable="false"
    >
        <div class="generalInfo">
            <div class="allOperation">
                <j-permission-button
                    @click="stopAll"
                    hasPermission="device/Firmware:update"
                    ><template #icon><AIcon type="PauseOutlined" /> </template
                    >{{ $t('Detail.index.805835-1') }}
                </j-permission-button>
                <j-permission-button
                    style="margin-left: 20px"
                    hasPermission="device/Firmware:update"
                    @click="startAll"
                    ><template #icon
                        ><AIcon type="CaretRightOutlined" /> </template
                    >{{ $t('Detail.index.805835-2') }}</j-permission-button
                >
                <j-permission-button
                    v-if="data?.mode?.value === 'push'"
                    style="margin-left: 20px"
                    hasPermission="device/Firmware:update"
                    @click="batchRetry"
                    ><template #icon><AIcon type="RedoOutlined" /> </template>
                    {{ $t('Detail.index.805835-3') }}
                </j-permission-button>
                <j-permission-button
                    type="text"
                    hasPermission="device/Firmware:update"
                    style="float: right"
                    @click="refreshState"
                    ><template #icon><AIcon type="RedoOutlined" /> </template>
                    {{ $t('Detail.index.805835-4') }}
                </j-permission-button>
            </div>
            <div class="progress">
                <div style="width: 90%">
                    <span>{{ $t('Detail.index.805835-5') }}</span>
                    <a-progress
                        style="width: 90%; margin-left: 20px"
                        :strokeWidth="10"
                        :percent="Number(general.percent.toFixed(2))"
                        :format="(percent) => `${percent}%`"
                    ></a-progress>
                </div>
                <span class="total">{{ $t('Detail.index.805835-6') }}{{ general.total }}{{ $t('Detail.index.805835-7') }}</span>
            </div>
        </div>
        <a-table
            :columns="columns"
            :data-source="historyList"
            :pagination="false"
            :rowClassName="rowClassName"
            :scroll="{
                y: 400,
            }"
        >
            <template #bodyCell="{ column, text, record }">
                <template
                    v-if="
                        column.dataIndex === 'deviceName' ||
                        column.dataIndex === 'productName'
                    "
                >
                    <j-ellipsis style="width: 100%">{{ text }}</j-ellipsis>
                </template>
                <template v-if="column.dataIndex === 'createTime'">
                    <j-ellipsis style="width: 100%">{{
                        dayjs(text).format('YYYY-MM-DD HH:mm:ss')
                    }}</j-ellipsis></template
                >
                <template v-if="column.dataIndex === 'completeTime'"
                    ><j-ellipsis style="width: 100%">{{
                        text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '--'
                    }}</j-ellipsis></template
                >
                <template v-if="column.dataIndex === 'state'">
                    <div class="state">
                        <a-progress
                            type="circle"
                            style="margin-right: 10px"
                            :width="20"
                            :showInfo="false"
                            trailColor="#f0f0f0"
                            :percent="
                                text?.value === 'failed'
                                    ? '100'
                                    : record?.progress
                            "
                            :status="
                                text?.value === 'failed' ? 'exception' : ''
                            "
                        />
                        <div v-if="text?.value === 'processing' || text?.value === 'success'">
                            {{ record?.progress + '%' }}
                        </div>
                        <div v-if="text?.value === 'failed'">
                            {{ text?.text + '：' + record?.errorReason }}
                        </div>
                        <div
                            v-if="
                                text?.value === 'waiting' ||
                                text?.value === 'canceled'
                            "
                        >
                            {{ text?.text }}
                        </div>
                    </div>
                </template>
                <template v-if="column.dataIndex === 'version'">
                    <j-ellipsis>
                        {{ text || '--' }}
                    </j-ellipsis>
                </template>
            </template>
        </a-table>
        <template #footer>
            <span class="tip">{{ $t('Detail.index.805835-8') }}</span>
            <a-button value="large" type="primary" @click="$emit('closeDetail')"
                >{{ $t('Detail.index.805835-9') }}</a-button
            >
        </template>
    </a-modal>
</template>

<script setup name="TaskDetail">
import {
    historyPaginateNot,
    stopTask,
    startTask,
    startOneTask,
    stopOneTask,
} from '../../../../../api/firmware';
import dayjs from 'dayjs';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
    data: {
        type: Object,
        default: {},
    },
    deviceId: {
        type: String,
    },
});
const emit = defineEmits(['closeDetail', 'refresh']);
const columns = [
    {
        title: $t('Detail.index.805835-10'),
        dataIndex: 'deviceName',
        key: 'deviceName',
    },
    {
        title: $t('Detail.index.805835-11'),
        dataIndex: 'productName',
        key: 'productName',
    },
    {
        title: $t('Detail.index.805835-12'),
        key: 'createTime',
        dataIndex: 'createTime',
        width: 200,
    },
    {
        title: $t('Detail.index.805835-13'),
        key: 'completeTime',
        dataIndex: 'completeTime',
    },
    {
        title: $t('Detail.index.805835-14'),
        key: 'version',
        dataIndex: 'version',
        width: 100,
    },
    {
        title: $t('Detail.index.805835-15'),
        dataIndex: 'state',
        width: 300,
        key: 'state',
    },
];
//列表数据
const historyList = ref();
//总进度
const general = reactive({
    total: 0,
    percent: 0,
});
const rowClassName = (record, index) => {
    return record.deviceId === props.deviceId ? 'heightLightRow' : '';
};
//查询任务升级记录列表
const queryHistoryList = async () => {
    const params = {
        paging: false,
        sorts: [
            { name: 'createTime', order: 'desc' },
            { name: 'upgradeTime', order: 'desc' },
        ],
        terms: [
            {
                terms: [
                    {
                        column: 'taskId',
                        value: props?.data?.id,
                    },
                ],
            },
            {
                terms: [
                    {
                        column: 'deviceId',
                        value: props?.deviceId,
                    },
                ],
            },
        ],
    };
    const res = await historyPaginateNot(params);
    if (res.status === 200) {
        historyList.value = res.result;
        general.total = res.result.length;
        let progress = 0;
        res.result.forEach((item) => {
            item?.state?.value === 'success' ? (progress += 1) : '';
        });
        general.percent = (progress / general.total).toFixed(2) * 100;
    }
};
const refreshState = async () => {
    emit('refresh');
    await queryHistoryList();
    onlyMessage($t('Detail.index.805835-16'));
};
//全部开始
const startAll = async () => {
    // const state =
    //     props.data?.mode?.value === 'push'
    //         ? ['canceled', 'failed']
    //         : ['canceled'];
    const res = await startTask(props.data.id,  ['canceled', 'failed']);
    if (res.success) {
        onlyMessage($t('Detail.index.805835-16'), 'success');
        queryHistoryList();
        emit('refresh');
    }
};
//全部重试
const batchRetry = async () => {
    const res = await startTask(props.data.id, ['failed']);
    if (res.success) {
        onlyMessage($t('Detail.index.805835-16'), 'success');
        queryHistoryList();
        emit('refresh');
    }
};
//全部停止
const stopAll = async () => {
    const res = await stopTask(props.data.id);
    if (res.success) {
        onlyMessage($t('Detail.index.805835-16'), 'success');
        queryHistoryList();
        emit('refresh');
    }
};
//升级某个记录
const startUpgrades = async (id) => {
    const res = await startOneTask([id]);
    if (res.success) {
        onlyMessage($t('Detail.index.805835-16'), 'success');
        queryHistoryList();
        emit('refresh');
    }
};
//停止某个记录
const stopUpgrades = async (id) => {
    const res = await stopOneTask([id]);
    if (res.success) {
        onlyMessage($t('Detail.index.805835-16'), 'success');
        queryHistoryList();
        emit('refresh');
    }
};

onMounted(() => {
    queryHistoryList();
});
</script>
<style lang="less" scoped>
.generalInfo {
    margin-bottom: 30px;
    .progress {
        width: 100%;
        line-height: 32px;
        display: flex;
    }
    .allOperation {
        margin-bottom: 20px;
    }
}
.tip {
    color: rgb(170, 170, 170);
    margin-right: 10px;
}
.state {
    display: flex;
}
</style>
<style>
.heightLightRow {
    background-color: #e6f4ff;
}
</style>
