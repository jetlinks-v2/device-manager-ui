<template>
    <a-modal
        :maskClosable="false"
        width="800px"
        :visible="true"
        title="导出"
        @ok="handleOk"
        @cancel="handleCancel"
    >
        <div style="background-color: rgb(236, 237, 238)">
            <p style="padding: 10px">
                <AIcon type="ExclamationCircleOutlined" />
                选择单个产品时可导出其下属设备的详细数据,不选择产品时导出所有设备的基础数据。
            </p>
        </div>
        <div style="margin-top: 20px">
            <a-form :layout="'vertical'">
                <a-form-item label="产品">
                    <a-select
                        show-search
                        :filter-option="filterOption"
                        v-model:value="modelRef.product"
                        placeholder="请选择产品"
                        allowClear
                    >
                        <a-select-option
                            :value="item.id"
                            v-for="item in productList"
                            :key="item.id"
                            :label="item.name"
                            >{{ item.name }}</a-select-option
                        >
                    </a-select>
                </a-form-item>
                <a-form-item label="文件格式">
                    <a-radio-group
                        button-style="solid"
                        v-model:value="modelRef.fileType"
                        placeholder="请选择文件格式"
                    >
                        <a-radio-button value="xlsx">xlsx</a-radio-button>
                        <a-radio-button value="csv">csv</a-radio-button>
                    </a-radio-group>
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
</template>

<script lang="ts" setup>
import { queryNoPagingPost } from '../../../../api/product';
import { paramsEncodeQuery } from '@/utils/encodeQuery';
import { LocalStore } from '@jetlinks-web/utils';
import { TOKEN_KEY } from '@jetlinks-web/constants';

const emit = defineEmits(['close']);
const props = defineProps({
    data: {
        type: Object,
        default: undefined,
    },
});
const modelRef = reactive({
    product: undefined,
    fileType: 'xlsx',
});

const filterOption = (input: string, option: any) => {
    return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

const productList = ref<Record<string, any>[]>([]);

watch(
    () => props.data,
    () => {
        queryNoPagingPost({ paging: false }).then((resp) => {
            if (resp.status === 200) {
                productList.value = resp.result as Record<string, any>[];
            }
        });
    },
    { immediate: true, deep: true },


);

const productName = computed(() => {
    console.log(modelRef.product);
    return productList.value.find(item => item.id === modelRef.product)?.name || ''
    // console.log(item.id);



})

const handleOk = async () => {
    const _params = paramsEncodeQuery(props.data);
    // downloadFile(
    //     deviceExport(modelRef.product || '', modelRef.fileType),
    //     params,
    // );
    // const res: any = await deviceExport(
    //     modelRef.product || '',
    //     modelRef.fileType,
    //     params
    //
    //
    // );
    // if (res) {
    //     // const blob = new Blob([res], { type: modelRef.fileType });
    //     // const url = URL.createObjectURL(blob);
    //     // downloadFileByUrl(url, `${productName.value ? (productName.value  + '下设备') : '设备实例'}`, modelRef.fileType);
    //
    // }
    const urlParams = new URLSearchParams()

    Object.keys(_params).forEach(key => {
      if (_params[key]) {
        urlParams.append(key, _params[key])
      }
    })
    const url =  modelRef.product ?  `${origin}/api/device-instance/${modelRef.product}/export.xlsx?:X_Access_Token=${LocalStore.get(TOKEN_KEY)}&${urlParams}` :  `${origin}/api/device-instance/export.xlsx?:X_Access_Token=${LocalStore.get(TOKEN_KEY)}&${urlParams}`
    window.open(url)
    emit('close');

};

const handleCancel = () => {
    emit('close');
};
</script>
