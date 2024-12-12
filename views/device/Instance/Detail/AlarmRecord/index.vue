<template>
    <div>
        <a-tabs
            tab-position="left"
            v-model:activeKey="activeKey"
            :tabBarStyle="{ width: '200px' }"
        >
            <a-tab-pane key="alarm" :tab="$t('AlarmRecord.index.489801-0')">
                <Alarm :goal="type" />
            </a-tab-pane>
            <a-tab-pane key="invalid" :tab="$t('AlarmRecord.index.489801-1')">
                <Invalid :goal="type" />
            </a-tab-pane>
        </a-tabs>
    </div>
</template>

<script setup>
import Alarm from './Alarm/index.vue';
import Invalid from './Invalid/index.vue';
const props = defineProps({
    type: {
        type: String,
        default: 'device',
    },
});
const activeKey = ref('alarm');
</script>
<style lang="less" scoped>
:deep(.ant-tabs-tab-active){
    background-color: #F1F7FF;
}
</style>
