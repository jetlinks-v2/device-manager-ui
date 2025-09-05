<template>
    <a-drawer placement="right" :closable="false" :visible="true">
        <template #title>
            <div
                style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                "
            >
                <span
                    ><AIcon
                        type="CloseOutlined"
                        style="margin-right: 5px"
                        @click="onClose"
                    />{{ $t('Config.Save.696838-0') }}</span
                >
                <a-button type="primary" @click="saveBtn">{{ $t('Config.Save.696838-1') }}</a-button>
            </div>
        </template>
        <a-form layout="vertical" ref="formRef" :model="modelRef">
            <a-collapse v-if="access.provider === 'composite-device-gateway'" v-model:activeKey="activeKey">
                <a-collapse-panel v-for="gateway in gatewaysDetail" :key="gateway.id" :header="gateway.name">
                    <template v-if="gateway.transportDetail?.allConfig?.length" v-for="(item, index) in gateway.transportDetail.allConfig || []" :key="index">
                        <a-form-item
                            v-for="i in item.properties"
                            :name="i.property"
                            :key="i.property"
                            :required="!!i.type.expands?.required"
                            :rules="
                                !!i.type.expands?.required
                                    ? [{ required: true, message: $t('Config.Save.696838-2', [i.name]) }]
                                    : []
                            "
                        >
                            <template #label>
                                <span style="margin-right: 5px">{{ i.name }}</span>
                                <a-tooltip v-if="i.description" :title="i.description"
                                    ><AIcon type="QuestionCircleOutlined"
                                /></a-tooltip>
                            </template>
                            <j-value-item
                                v-model:modelValue="modelRef[i.property]"
                                :itemType="i.type.type"
                                :options="getOptions(i)"
                                :extraProps="i.type.expands || {}"
                            />
                        </a-form-item>
                    </template>
                    <j-empty v-else :description="$t('Config.index.926765-11')"></j-empty>
                </a-collapse-panel>
            </a-collapse>
            <template v-else v-for="(item, index) in config || []" :key="index">
                <a-form-item
                    v-for="i in item.properties"
                    :name="i.property"
                    :key="i.property"
                    :required="!!i.type.expands?.required"
                    :rules="
                        !!i.type.expands?.required
                            ? [{ required: true, message: $t('Config.Save.696838-2', [i.name]) }]
                            : []
                    "
                >
                    <template #label>
                        <span style="margin-right: 5px">{{ i.name }}</span>
                        <a-tooltip v-if="i.description" :title="i.description"
                            ><AIcon type="QuestionCircleOutlined"
                        /></a-tooltip>
                    </template>
                    <j-value-item
                        v-model:modelValue="modelRef[i.property]"
                        :itemType="i.type.type"
                        :options="getOptions(i)"
                        :extraProps="i.type.expands || {}"
                    />
                </a-form-item>
            </template>
        </a-form>
    </a-drawer>
</template>

<script lang="ts" setup>
import { modify } from '@device/api/instance';
import { useInstanceStore } from '@device/store/instance';
import { onlyMessage } from '@/utils/comm';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const emit = defineEmits(['close', 'save']);

const formRef = ref();
const modelRef = reactive({});

const instanceStore = useInstanceStore();

const props = defineProps({
    config: {
        type: Array,
        default: [],
    },
    gatewaysDetail: {
        type: Array,
        default: () => [],
    },
    access: {
        type: Object,
        default: () => {},
    }
});

const activeKey = ref(props.gatewaysDetail?.map((item) => item.id));

const getOptions = (i: any) => {
    if (i.type.type === 'enum') {
        return (i.type?.elements || []).map((item) => {
            return {
                label: item?.text,
                value: item?.value,
            };
        });
    } else if (i.type.type === 'boolean') {
        return [
            {
                label: i.type?.falseText,
                value: i.type?.falseValue,
            },
            {
                label: i.type?.trueText,
                value: i.type?.trueValue,
            }
        ];
    }
    return undefined;
};

watchEffect(() => {
    const obj = instanceStore.current?.configuration;
    if (obj && Object.keys(obj).length) {
        (props?.config || []).map((item: any) => {
            if (Array.isArray(item.properties) && item?.properties.length) {
                item.properties.map((i: any) => {
                    modelRef[i.property] = obj[i.property];
                });
            }
        });
    }
});

const onClose = () => {
    emit('close');
    formRef.value.resetFields();
};

const saveBtn = () => {
    formRef.value.validate().then(async (res) => {
        if (res) {
            const values = toRaw(modelRef);
            const resp = await modify(instanceStore.current?.id || '', {
                id: instanceStore.current?.id,
                configuration: { ...values },
            });
            if (resp.status === 200) {
                onlyMessage($t('Config.Save.696838-3'));
                emit('save');
            }
        }
    });
};
</script>
