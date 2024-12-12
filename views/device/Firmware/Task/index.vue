<template>
    <a-drawer
        visible
        :title="$t('Task.index.219743-0')"
        placement="right"
        :width="700"
        :closable="false"
        @close="$emit('closeDrawer')"
    >
        <template #extra>
            <j-permission-button
                v-if=!props?.showPosition
                type="primary"
                hasPermission="device/Firmware:add"
                @click="handleAdd"
            >
                {{ $t('Task.index.219743-1') }}
            </j-permission-button>
        </template>
        <div v-for="item in taskList" class="task">
            <div class="taskTitle">
                <div class="taskTitleLeft">
                    <div class="upgradeMode">{{ item?.mode?.text }}</div>
                    <div class="title">
                        <j-ellipsis>{{ item?.name }}</j-ellipsis>
                    </div>
                </div>
                <div class="taskTitleRight">
                    <div>
                        {{ $t('Task.index.219743-2') }}<span
                            class="progress"
                            :style="{
                                color:
                                    item?.progress === 100
                                        ? '#52C41A'
                                        : '#FF4D4F',
                            }"
                        >
                            {{ (item?.progress || 0) + '%' }}
                        </span>
                    </div>
                    <j-permission-button
                        type="link"
                        hasPermission="device/Firmware:view"
                        @click="() => taskDetail(item)"
                        >{{ $t('Task.index.219743-3') }}</j-permission-button
                    >
                </div>
            </div>
            <a-descriptions bordered :column="2">
                <a-descriptions-item
                    v-if="item?.mode?.value === 'push'"
                    :label="$t('Task.index.219743-4')"
                    >{{
                        item?.responseTimeoutSeconds + 's'
                    }}</a-descriptions-item
                >
                <a-descriptions-item :label="$t('Task.index.219743-5')">{{
                    item?.timeoutSeconds + 's'
                }}</a-descriptions-item>
                <a-descriptions-item :label="$t('Task.index.219743-6')">{{
                    item?.deviceId?.length ? $t('Task.index.219743-7') : $t('Task.index.219743-8')
                }}</a-descriptions-item>
                <a-descriptions-item :label="$t('Task.index.219743-9')"
                    ><j-ellipsis style="max-width: 200px;">
                        {{ item?.description || '--' }}
                    </j-ellipsis></a-descriptions-item
                >
            </a-descriptions>
        </div>
        <JEmpty v-if="taskList.length === 0"></JEmpty>
    </a-drawer>
    <Save
        v-if="visible"
        :data="current"
        :productId="productId"
        :firmwareId="firmwareId"
        @change="saveChange"
    ></Save>
    <TaskDetail
        v-if="detailVisible"
        @close-detail="closeDetail"
        @refresh="queryTaskList"
        :deviceId="props.deviceId"
        :data="currentTask"
    />
</template>

<script setup name="TaskDrawer">
import { queryTaskPaginateNot } from '../../../../api/firmware';
import Save from './Save/index.vue';
import TaskDetail from './Detail/index.vue';
import { onlyMessage } from '@/utils/comm';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const emit = defineEmits(['closeDrawer']);
const props = defineProps({
    firmwareId: {
        type: String,
        default: '',
    },
    productId: {
        type: String,
        default: '',
    },
    showPosition:{
        type:String
    },
    deviceId:{
        type:String
    }
});
const taskList = ref([]);
const visible = ref(false);
const detailVisible = ref(false);
const current = ref();
//任务详情传参
const currentTask = ref();
const queryTaskList = async () => {
    const param = {
        paging: false,
        sorts: [{ name: 'createTime', order: 'desc' }],
        terms: [
            {
                terms: [
                    {
                        column: 'firmwareId',
                        value: props.firmwareId,
                    },
                ],
            },
        ],
    };
    const res = await queryTaskPaginateNot(param);
    if (res.status === 200) {
        if(props?.deviceId){
            console.log(props.deviceId)
            taskList.value = res.result.filter((i)=>{
                return !i?.deviceId ||  i.deviceId.includes(props.deviceId)
            })
        }else{
            taskList.value = res.result;
        }
        if (currentTask.value?.id) {
            currentTask.value = taskList.value.find(
                (i) => i.id === currentTask.value.id,
            );
        }
    }
};
const handleAdd = () => {
    visible.value = true;
    current.value = {};
};
const saveChange = (value) => {
    visible.value = false;
    current.value = {};
    if (value) {
        onlyMessage($t('Task.index.219743-10'), 'success');
        queryTaskList();
    }
};
const taskDetail = (data) => {
    detailVisible.value = true;
    currentTask.value = data;
};
const closeDetail = () => {
    detailVisible.value = false;
    queryTaskList();
};
onMounted(() => {
    queryTaskList();
});
</script>
<style lang="less" scoped>
.task {
    margin-bottom: 20px;
}
.taskTitle {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    .taskTitleLeft,
    .taskTitleRight {
        display: flex;
        line-height: 32px;
    }
    .progress {
        margin-left: 10px;
    }
    .upgradeMode {
        background: #e6f4ff;
        border-radius: 4px;
        border: 1px solid #91caff;
        height: 22px;
        padding: 0 8px;
        color: #1677ff;
        margin-top: 4px;
        line-height: 22px;
    }
    .title {
        font-size: 16px;
        font-weight: 500;
        margin-left: 12px;
        color: #1a1a1a;
        max-width: 300px;
    }
}
</style>
