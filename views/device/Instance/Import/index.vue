<template>
    <a-modal
        :maskClosable="false"
        width="800px"
        :visible="true"
        title="导入"
        @cancel="handleCancel"
    >
        <div style="margin-top: 10px">
            <a-form :layout="'vertical'">
                <a-row>
                    <a-col span="24">
                        <a-form-item label="产品" required>
                            <a-select
                                showSearch
                                v-model:value="modelRef.product"
                                placeholder="请选择产品"
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
                    </a-col>
                    <a-col span="24">
                        <a-form-item label="文件格式" v-if="modelRef.product">
                            <FileFormat v-model="modelRef.file" />
                        </a-form-item>
                    </a-col>
                    <a-col span="12">
                        <a-form-item label="文件上传" v-if="modelRef.product">
                            <NormalUpload
                                :product="modelRef.product"
                                v-model="modelRef.upload"
                                :file="modelRef.file"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>
            </a-form>
        </div>
        <template #footer>
            <a-button type="primary" @click="handleSave">关闭</a-button>
        </template>
    </a-modal>
</template>

<script lang="ts" setup>
import { queryNoPagingPost } from '../../../../api/product';

const emit = defineEmits(['close', 'save']);
const props = defineProps({
    data: {
        type: Object,
        default: undefined,
    },
    type: String,
});
const productList = ref<Record<string, any>[]>([]);

const modelRef = reactive({
    product: undefined,
    upload: [],
    file: {
        fileType: 'xlsx',
        autoDeploy: false,
    },
});

watch(
    () => props.data,
    () => {
        queryNoPagingPost({
            paging: false,
            terms: [
                {
                    column: 'state',
                    value: '1',
                    type: 'and'
                },
                {
                    column: 'accessProvider',
                    value: props?.type
                }
            ],
            sorts: [{ name: 'createTime', order: 'desc' }]
        }).then((resp) => {
            if (resp.status === 200) {
                productList.value = resp.result as Record<string, any>[];
            }
        });
    },
    { immediate: true, deep: true },
);

const handleCancel = () => {
    emit('close');
};

const handleSave = () => {
    emit('close');
    emit('save');
};
</script>
