<template>
    <a-modal
        :title="data.id ? $t('Save.index.646914-0') : $t('Save.index.646914-1') + $t('Save.index.646914-2')"
        :ok-text="$t('Save.index.646914-3')"
        :cancel-text="$t('Save.index.646914-4')"
        :visible="true"
        width="700px"
        :confirm-loading="loading"
        :maskClosable="false"
        @cancel="handleCancel"
        @ok="handleOk"
    >
        <a-form
            class="form"
            layout="vertical"
            :model="formData"
            name="basic"
            autocomplete="off"
            ref="formRef"
            :rules="rules"
        >
            <a-row :gutter="[24, 0]">
                <a-col :span="24">
                    <a-form-item :label="$t('Save.index.646914-5')" name="name">
                        <a-input
                            :placeholder="$t('Save.index.646914-6')"
                            v-model:value="formData.name"
                            :disabled="view"
                    /></a-form-item>
                </a-col>
                <a-col :span="24"
                    ><a-form-item :label="$t('Save.index.646914-7')" name="mode">
                        <a-select
                            v-model:value="formData.mode"
                            :options="[
                                { label: $t('Save.index.646914-8'), value: 'push' },
                                { label: $t('Save.index.646914-9'), value: 'pull' },
                            ]"
                            :placeholder="$t('Save.index.646914-10')"
                            allowClear
                            show-search
                            :filter-option="filterOption"
                            @change="changeMode"
                            :disabled="view"
                        /> </a-form-item
                ></a-col>
                <a-col :span="12" v-if="formData.mode === 'push'"
                    ><a-form-item
                        :label="$t('Save.index.646914-11')"
                        name="responseTimeoutSeconds"
                    >
                        <a-input-number
                            :placeholder="`${$t('Save.index.646914-12')}(${$t('Save.index.646914-13')})`"
                            style="width: 100%"
                            :min="1"
                            :max="99999"
                            :disabled="view"
                            v-model:value="
                                formData.responseTimeoutSeconds
                            " /></a-form-item
                ></a-col>
                <a-col
                    :span="formData.mode === 'push' ? 12 : 24"
                    v-if="formData.mode === 'push' || formData.mode === 'pull'"
                    ><a-form-item :label="$t('Save.index.646914-14')" name="timeoutSeconds">
                        <a-input-number
                            :placeholder="`${$t('Save.index.646914-15')}(${$t('Save.index.646914-13')})`"
                            style="width: 100%"
                            :min="1"
                            :max="99999"
                            :disabled="view"
                            v-model:value="
                                formData.timeoutSeconds
                            " /></a-form-item
                ></a-col>
                <a-col :span="12" v-if="!!formData.mode"
                    ><a-form-item :label="$t('Save.index.646914-16')" name="releaseType">
                        <a-radio-group
                            v-model:value="formData.releaseType"
                            button-style="solid"
                            @change="changeShareCluster"
                            :disabled="view"
                        >
                            <a-radio value="all">{{ $t('Save.index.646914-17') }}</a-radio>
                            <a-radio value="part">{{ $t('Save.index.646914-18') }}</a-radio>
                        </a-radio-group>
                    </a-form-item>
                </a-col>
                <a-col :span="12" v-if="formData.releaseType === 'part'">
                    <a-form-item :label="$t('Save.index.646914-18')" name="deviceId">
                        <SelectDevices
                            v-model:modelValue="formData.deviceId"
                            :data="data"
                            :productId="productId"
                        ></SelectDevices> </a-form-item
                ></a-col>
                <a-col :span="24">
                    <a-form-item :label="$t('Save.index.646914-19')" name="description">
                        <a-textarea
                            :placeholder="$t('Save.index.646914-20')"
                            v-model:value="formData.description"
                            :maxlength="200"
                            :rows="3"
                            showCount
                            :disabled="view"
                        /> </a-form-item
                ></a-col>
            </a-row>
        </a-form>
    </a-modal>
</template>
<script lang="ts" setup name="TaskPage">
import { queryProduct, saveTask } from '../../../../../api/firmware';
import type { FormInstance } from 'ant-design-vue';
import SelectDevices from './SelectDevices.vue';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
    data: {
        type: Object,
        default: () => {},
    },
    firmwareId: {
        type: String,
        default: '',
    },
    productId: {
        type: String,
        default: '',
    },
});

const formRef = ref<FormInstance>();

const route = useRoute();
const loading = ref(false);
const productOptions = ref([]);
const emit = defineEmits(['change']);

const firmwareId = props.firmwareId;
const productId = props.productId;
const view = props.data.view;

const formData: any = ref({
    name: '',
    mode: undefined,
    responseTimeoutSeconds: '',
    timeoutSeconds: '',
    releaseType: 'all',
    deviceId: undefined,
    description: '',
});

const rules = {
    name: [
        { required: true, message: $t('Save.index.646914-6') },
        { max: 64, message: $t('Save.index.646914-21') },
    ],
    mode: [{ required: true, message: $t('Save.index.646914-10') }],
    responseTimeoutSeconds: [{ required: true, message: $t('Save.index.646914-12') }],
    timeoutSeconds: [{ required: true, message: $t('Save.index.646914-15') }],
    releaseType: [{ required: true }],
    deviceId: [{ required: true, message: $t('Save.index.646914-22') }],
    description: [{ max: 200, message: $t('Save.index.646914-23') }],
};

const filterOption = (input: string, option: any) => {
    return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

const onSubmit = async () => {
    const params = await formRef.value?.validate();
    loading.value = true;
    const resp = await saveTask({
        ...params,
        firmwareId,
        productId,
    }).finally(() => {
        loading.value = false;
    });
    resp.success && emit('change', true);
};

const handleOk = () => {
    return view ? emit('change', false) : onSubmit();
};
const handleCancel = () => {
    emit('change', false);
};

const changeShareCluster = () => {
    formData.value.deviceId = undefined;
};

onMounted(() => {
    queryProduct({
        paging: false,
        terms: [{ column: 'state', value: 1 }],
        sorts: [{ name: 'createTime', order: 'desc' }],
    }).then((resp: any) => {
        productOptions.value = resp.result.map((item: any) => ({
            value: item.id,
            label: item.name,
        }));
    });
});
watch(
    () => props.data,
    (value) => {
        if (value.id) {
            formData.value = {
                ...value,
                mode: value.mode.value,
                releaseType: value?.deviceId ? 'part' : 'all',
            };
        }
    },
    { immediate: true, deep: true },
);
</script>

<style lang="less" scoped></style>
