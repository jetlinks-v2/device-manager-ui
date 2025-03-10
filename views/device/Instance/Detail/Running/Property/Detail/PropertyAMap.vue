<template>
    <a-spin :spinning="loading">
        <div style="position: relative">
            <div style="position: absolute; right: 0; top: 5px; z-index: 999">
                <a-space>
                    <a-button type="primary" @click="onStart">{{ $t('Detail.PropertyAMap.525980-0') }}</a-button>
                    <a-button type="primary" v-if="!stop" @click="onStop">{{ $t('Detail.PropertyAMap.525980-1') }}</a-button>
                    <a-button type="primary" v-else @click="onResume">{{ $t('Detail.PropertyAMap.525980-2') }}</a-button>
                </a-space>
            </div>
        </div>
        <AMapComponent style="height: 500px">
            <PathSimplifier :pathData="geoList" ref="amapPath"></PathSimplifier>
        </AMapComponent>
    </a-spin>
</template>

<script lang="ts" setup>
import { getPropertyData } from '../../../../../../../api/instance';
import { useInstanceStore } from '../../../../../../../store/instance';

const instanceStore = useInstanceStore();

const prop = defineProps({
    data: {
        type: Object,
        default: () => {},
    },
    time: {
        type: Array,
        default: () => [],
    },
});

const stop = ref<boolean>(false);
const geoList = ref<any[]>([]);
const loading = ref<boolean>(false);
const amapPath = ref();

const onStart = () => {
    amapPath.value?.start();
    stop.value = false;
};

const onStop = () => {
    amapPath.value?.pause();
    stop.value = true;
};

const onResume = () => {
    amapPath.value?.resume();
    stop.value = false;
};

const query = async () => {
    loading.value = true;
    const resp = await getPropertyData(
        instanceStore.current.id,
        // encodeQuery({
        //     paging: false,
        //     terms: {
        //         property: prop.data.id,
        //         timestamp$BTW: prop.time[0] && prop.time[1] ? prop.time : [],
        //     },
        //     sorts: { timestamp: 'asc' },
        // }),
        prop.data.id,
        {
            paging: false,
            sorts: [
                {
                    name: 'timestamp',
                    value: 'asc',
                },
            ],
            terms: [
                {
                    terms: [
                        {
                            column: 'timestamp',
                            termType: 'btw',
                            value:
                                prop.time[0] && prop.time[1] ? prop.time : [],
                        },
                    ],
                },
            ],
        },
    ).finally(() => {
        loading.value = false;
    });
    if (resp.status === 200) {
        const list: any[] = [];
        ((resp.result as any)?.data || []).forEach((item: any) => {
            list.push([item.value.lon, item.value.lat]);
        });
        geoList.value = [
            {
                name: prop?.data?.name,
                path: list,
            },
        ];
    }
};

watch(
    () => [prop.data.id, prop.time],
    ([newVal]) => {
        if (newVal) {
            query();
        }
    },
    {
        deep: true,
        immediate: true,
    },
);

</script>

<style lang="less" scoped>
</style>
