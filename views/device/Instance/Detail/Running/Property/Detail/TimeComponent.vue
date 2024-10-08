<template>
    <a-space>
        <a-radio-group
            :value="radioValue"
            button-style="solid"
            @change="onRadioChange"
        >
            <a-radio-button value="today">今日</a-radio-button>
            <a-radio-button value="week">近一周</a-radio-button>
            <a-radio-button value="month">近一月</a-radio-button>
        </a-radio-group>
        <a-range-picker
            show-time
            v-model:value="dateValue"
            :placeholder="['开始时间', '结束时间']"
            @change="onRangeChange"
            :allowClear="false"
        />
    </a-space>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { PropType } from 'vue';

type Props = [Dayjs, Dayjs] | undefined;

const props = defineProps({
    modelValue: {
        type: Object as PropType<Props>,
        default: undefined,
    },
});

type Emits = {
    (e: 'update:modelValue', data: Props): void;
};

const emit = defineEmits<Emits>();
const radioValue = ref<string>('today');
const dateValue = ref<Props>();
const onRangeChange = (value: Props) => {
    emit('update:modelValue', value);
    radioValue.value = '';
};

const getTime = (type: string): Props => {
    let st: number = 0;
    const et = new Date().getTime();
    if (type === 'today') {
        st = dayjs().startOf('day').valueOf();
    } else if (type === 'week') {
        st = dayjs().subtract(6, 'days').valueOf();
    } else if (type === 'month') {
        st = dayjs().subtract(30, 'days').valueOf();
    }
    return [dayjs(st), dayjs(et)];
};

const onRadioChange = (e: any) => {
    const value: string = e.target.value;
    radioValue.value = value;
    emit('update:modelValue', getTime(value));
};

onMounted(() => {
    radioValue.value = 'today';
    emit('update:modelValue', getTime('today'));
});

watch(
    () => props.modelValue,
    (newVal: Props) => {
        dateValue.value = newVal;
    },
    { immediate: true, deep: true },
);
</script>
