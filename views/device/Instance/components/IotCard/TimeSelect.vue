<template>
    <div>
        <a-radio-group
            v-if="quickBtn"
            default-value="today"
            button-style="solid"
            v-model:value="radioValue"
            @change="(e) => handleBtnChange(e.target.value)"
        >
            <j-radio-button
                v-for="item in quickBtnList"
                :key="item.value"
                :value="item.value"
            >
                {{ item.label }}
            </j-radio-button>
        </a-radio-group>
        <a-range-picker
            v-model:value="rangeVal"
            :show-time="{ format: 'HH:mm:ss' }"
            :allowClear="false"
            format="YYYY-MM-DD HH:mm:ss"
            valueFormat="YYYY-MM-DD HH:mm:ss"
            style="margin-left: 12px"
            @change="rangeChange"
        >
        </a-range-picker>
    </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import type { PropType } from 'vue';
import i18n from '@/locales';
interface BtnOptions {
    label: string;
    value: string;
}

interface EmitProps {
    (e: 'change', data: Record<string, any>): void;
}

const emit = defineEmits<EmitProps>();

const props = defineProps({
    // 显示快捷按钮
    quickBtn: {
        type: Boolean,
        default: true,
    },
    // 快捷按钮列表
    quickBtnList: {
        type: Array as PropType<BtnOptions[]>,
        default: [
            { label: i18n.global.t('IotCard.index.369962-21-1'), value: 'today' },
            { label: i18n.global.t('IotCard.index.369962-22'), value: 'week' },
            { label: i18n.global.t('IotCard.index.369962-23'), value: 'month' },
            { label: i18n.global.t('IotCard.index.369962-24'), value: 'year' },
        ],
    },
    type: {
        type: String,
        default: 'today',
    },
});

const radioValue = ref(props.type || 'week' || undefined);
const rangeVal = ref<[string, string]>();

const rangeChange = (val: any) => {
    radioValue.value = undefined;
    const differenceTime = dayjs(val[1]).valueOf() - dayjs(val[0]).valueOf()
    emit('change', {
        start: dayjs(val[0]).valueOf(),
        end: dayjs(val[1]).valueOf(),
        type: differenceTime > (24 * 60 * 60 * 1000) ? undefined : 'day',
    });
};

const getTimeByType = (type?: string) => {
    switch (type) {
        case 'hour':
            return dayjs().subtract(1, 'hours').valueOf();
        case 'week':
            return dayjs().subtract(6, 'days').valueOf();
        case 'month':
            return dayjs().subtract(29, 'days').valueOf();
        case 'year':
            return dayjs().subtract(365, 'days').valueOf();
        default:
            return dayjs().startOf('day').valueOf();
    }
};

const handleBtnChange = (val?: string) => {
    let endTime = dayjs(new Date()).valueOf();
    let startTime = getTimeByType(val);
    if (val === 'yesterday') {
        startTime = dayjs().subtract(1, 'days').startOf('day').valueOf();
        endTime = dayjs().subtract(1, 'days').endOf('day').valueOf();
    }
    rangeVal.value = [
      dayjs(startTime).format('YYYY-MM-DD HH:mm:ss'),
      dayjs(endTime).format('YYYY-MM-DD HH:mm:ss'),
    ];
    console.log(startTime, endTime)
    emit('change', {
        start: startTime,
        end: endTime,
        type: val,
    });
};

nextTick(() => {
  handleBtnChange(radioValue.value)
})

</script>
