<template>
    <a-modal
        :maskClosable="false"
        width="650px"
        :visible="true"
        :title="!!data?.id ? $t('Save.index.902471-0') : $t('Save.index.902471-1')"
        @ok="handleSave"
        @cancel="handleCancel"
        :confirmLoading="loading"
    >
        <div style="margin-top: 10px">
            <a-form :layout="'vertical'" ref="formRef" :model="modelRef">
                <a-row type="flex">
                    <a-col flex="180px">
                        <a-form-item name="photoUrl">
                            <ProUpload accept="image/jpeg,image/png" v-model="modelRef.photoUrl" />
                        </a-form-item>
                    </a-col>
                    <a-col flex="auto">
                        <a-form-item
                            name="id"
                            :rules="[
                                {
                                    pattern: /^[a-zA-Z0-9_\-]+$/,
                                    message: $t('Save.index.902471-2'),
                                },
                                {
                                    max: 64,
                                    message: $t('Save.index.902471-3'),
                                },
                                {
                                    validator: vailId,
                                    trigger: 'blur',
                                },
                            ]"
                        >
                            <template #label>
                                <span>
                                    ID
                                    <a-tooltip
                                        :title="$t('Save.index.902471-4')"
                                    >
                                        <AIcon
                                            type="QuestionCircleOutlined"
                                            style="margin-left: 2px"
                                        />
                                    </a-tooltip>
                                </span>
                            </template>
                            <a-input
                                v-model:value="modelRef.id"
                                :placeholder="$t('Save.index.902471-5')"
                                :disabled="!!data?.id"
                            />
                        </a-form-item>
                        <a-form-item
                            :label="$t('Save.index.902471-6')"
                            name="name"
                            :rules="[
                                {
                                    required: true,
                                    message: $t('Save.index.902471-7'),
                                },
                                {
                                    max: 64,
                                    message: $t('Save.index.902471-3'),
                                },
                            ]"
                        >
                            <a-input
                                v-model:value="modelRef.name"
                                :placeholder="$t('Save.index.902471-7')"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>
                <a-form-item
                    name="productId"
                    :rules="[
                        {
                            required: true,
                            message: $t('Save.index.902471-8'),
                        },
                    ]"
                >
                    <template #label>
                        <span
                            >{{ $t('Save.index.902471-9') }}
                            <a-tooltip :title="$t('Save.index.902471-10')">
                                <AIcon
                                    type="QuestionCircleOutlined"
                                    style="margin-left: 2px"
                                />
                            </a-tooltip>
                        </span>
                    </template>
                    <a-select
                        showSearch
                        v-model:value="modelRef.productId"
                        :disabled="!!data?.id"
                        :placeholder="$t('Save.index.902471-11')"
                        option-filter-prop="label"
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
                <a-form-item
                    :label="$t('Save.index.902471-12')"
                    name="describe"
                    :rules="[
                        {
                            max: 200,
                            message: $t('Save.index.902471-13')
                        },
                    ]"
                >
                    <a-textarea
                        v-model:value="modelRef.describe"
                        :placeholder="$t('Save.index.902471-14')"
                        showCount
                        :maxlength="200"
                    />
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
</template>

<script lang="ts" setup>
import { queryNoPagingPost } from '../../../../api/product';
import { isExists, update } from '../../../../api/instance';
import { onlyMessage } from '@jetlinks-web/utils';
import { device} from "../../../../assets";
import { useI18n } from 'vue-i18n';
import { isInput } from '@device/utils/utils';

const { t: $t } = useI18n();

const emit = defineEmits(['close', 'save']);
const props = defineProps({
    data: {
        type: Object,
        default: undefined,
    },
});
const productList = ref<Record<string, any>[]>([]);
const loading = ref<boolean>(false);

const formRef = ref();

const modelRef = reactive({
    productId: undefined,
    id: undefined,
    name: '',
    describe: '',
    photoUrl: props.data.devicePhotoUrl || device.deviceCard,
});

const vailId = async (_: Record<string, any>, value: string) => {
    if (!props?.data?.id && value) {
        if (!isInput(value)) {
          return Promise.reject($t('Save.index.912481-17'));
        }

        const resp = await isExists(value);
        if (resp.success && resp.result) {
            return Promise.reject($t('Save.index.902471-15'));
        } else {
            return Promise.resolve();
        }
    } else {
        return Promise.resolve();
    }
};

watch(
    () => props.data,
    (newValue) => {
        queryNoPagingPost({
            paging: false,
            sorts: [{ name: 'createTime', order: 'desc' }],
            terms: [
                {
                    terms: [
                        {
                            termType: 'eq',
                            column: 'state',
                            value: 1,
                        },
                    ],
                },
            ],
        }).then((resp) => {
            if (resp.status === 200) {
                productList.value = resp.result as Record<string, any>[];
            }
        });
        Object.assign(modelRef, newValue);
        // description 和 describe 处理
        modelRef.describe = newValue?.describe || newValue?.description
    },
    { immediate: true, deep: true },
);

const handleCancel = () => {
    emit('close');
    formRef.value.resetFields();
};

const handleSave = () => {
    formRef.value
        .validate()
        .then(async (_data: any) => {
            loading.value = true;
            const obj = { ..._data };
            if (!obj.id) {
                delete obj.id;
            }
            const resp = await update(obj).finally(() => {
                loading.value = false;
            });
            if (resp.status === 200) {
                onlyMessage($t('Save.index.902471-16'));
                emit('save');
                formRef.value.resetFields();
            }
        })
        .catch((err: any) => {
            console.log('error', err);
        });
};
</script>
