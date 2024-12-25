<template>
    <PopoverModal
        v-model:visible="visible"
        :placement="placement"
        @ok="onOk"
        @cancel="onCancel"
    >
        <template #content>
            <div style="width: 750px">
                <EditTable
                    ref="tableRef"
                    :validateRowKey="true"
                    :columns="myColumns"
                    :dataSource="dataSource"
                    :pagination="false"
                    :height="200"
                >
                    <!--          <template v-for="(_, key) in slots" :key="key" #[key]="slotData">-->
                    <!--            <slot :name="key" v-bind="slotData"/>-->
                    <!--          </template>-->
                    <template #id="{ record, index }">
                        <EditTableFormItem :name="[index, 'id']">
                            <a-input
                                v-model:value="record.id"
                                :placeholder="$t('Object.index.371533-0')"
                            />
                        </EditTableFormItem>
                    </template>
                    <template #name="{ record, index }">
                        <EditTableFormItem :name="[index, 'name']">
                            <a-input
                                v-model:value="record.name"
                                :placeholder="$t('Object.index.371533-1')"
                            />
                        </EditTableFormItem>
                    </template>
                    <template #expands="{ record }">
                        <BooleanSelect
                            v-model:value="record.expands.required"
                        />
                    </template>
                    <template #valueType="{ record, index }">
                        <EditTableFormItem :name="[index, 'valueType']">
                            <div
                                style="
                                    display: flex;
                                    gap: 12px;
                                    align-items: center;
                                "
                            >
                                <TypeSelect
                                    v-model:value="record.valueType"
                                    style="flex: 1 1 0; min-width: 0"
                                />
                                <DoubleParams
                                    v-if="
                                        ['float', 'double'].includes(
                                            record.valueType.type,
                                        )
                                    "
                                    v-model:value="record.valueType"
                                    placement="topRight"
                                />
                                <StringParams
                                    v-else-if="
                                        record.valueType.type === 'string'
                                    "
                                    v-model:value="record.valueType"
                                    placement="topRight"
                                />
                                <DateParams
                                    v-else-if="record.valueType.type === 'date'"
                                    v-model:value="record.valueType.format"
                                    placement="topRight"
                                />
                                <FileParams
                                    v-else-if="record.valueType.type === 'file'"
                                    v-model:value="record.valueType.bodyType"
                                    placement="topRight"
                                />
                                <EnumParams
                                    v-else-if="record.valueType.type === 'enum'"
                                    v-model:value="record.valueType.elements"
                                    placement="topRight"
                                />
                                <BooleanParams
                                    v-else-if="
                                        record.valueType.type === 'boolean'
                                    "
                                    v-model:falseText="
                                        record.valueType.falseText
                                    "
                                    v-model:falseValue="
                                        record.valueType.falseValue
                                    "
                                    v-model:trueText="record.valueType.trueText"
                                    v-model:trueValue="
                                        record.valueType.trueValue
                                    "
                                    placement="topRight"
                                />
                                <ArrayParams
                                    v-else-if="
                                        record.valueType.type === 'array'
                                    "
                                    v-model:value="record.valueType.elementType"
                                    placement="topRight"
                                />
                            </div>
                        </EditTableFormItem>
                    </template>
                    <template #action="{ index }">
                        <a-button
                            danger
                            type="link"
                            style="padding: 0 5px"
                            @click="() => deleteItem(index)"
                        >
                            <template #icon>
                                <AIcon type="DeleteOutlined" />
                            </template>
                        </a-button>
                    </template>
                </EditTable>
                <a-button style="width: 100%; margin-top: 4px" @click="addItem">
                    <template #icon><AIcon type="PlusOutlined" /></template>
                    {{ $t('Object.index.371533-2') }}
                </a-button>
            </div>
        </template>
        <slot>
            <a-button type="link" :disabled="disabled" style="padding: 0">
                <template #icon>
                    <AIcon
                        type="EditOutlined"
                        :class="{ 'table-form-required-aicon': !value.length }"
                    />
                </template>
            </a-button>
        </slot>
    </PopoverModal>
</template>

<script setup name="MetadataObject">
import { PopoverModal } from '../index';
import BooleanSelect from '../BooleanSelect/index.vue';
import {
    EditTable,
    TypeSelect,
    EditTableFormItem,
    StringParams,
    DateParams,
    FileParams,
    EnumParams,
    BooleanParams,
    ArrayParams,
    DoubleParams,
} from '../../index';
import { Form } from 'ant-design-vue';
import { isObject } from 'lodash-es';
import { useI18n } from 'vue-i18n';

const { t: $t, locale } = useI18n();

const props = defineProps({
    value: {
        type: Array,
        default: () => [],
    },
    placement: {
        type: String,
        default: 'top',
    },
    type: {
        type: String,
        default: 'properties',
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});

const validatorConfig = (value, _isObject = false) => {
    if (!value) {
        return Promise.resolve();
    }

    if (value.type === 'enum' && !value.elements?.length) {
        return Promise.reject($t('Object.index.371533-3'));
    }
    if (value.type === 'array' && !value.elementType?.type) {
        return Promise.reject($t('Object.index.371533-4'));
    }

    // if (_isObject && value.type === 'object' && !value.properties?.length) {
    //     return Promise.reject('请添加参数');
    // }

    if (value.type === 'date' && !value.format) {
        return Promise.reject($t('Object.index.371533-5'));
    }

    if (
        value.type === 'file' &&
        (!value.bodyType ||
            (isObject(value.bodyType) && !Object.keys(value.bodyType).length))
    ) {
        return Promise.reject($t('Object.index.371533-6'));
    }

    return Promise.resolve();
};

const emit = defineEmits(['update:value', 'confirm', 'cancel']);
const formItemContext = Form.useInjectFormItemContext();

const slots = useSlots();

const tableRef = ref();
const dataSource = ref([]);
const visible = ref(false);

const defaultColumns = [
    {
        title: $t('Object.index.371533-7'),
        dataIndex: 'id',
        form: {
            required: true,
            rules: [
                {
                    asyncValidator(_, value, ...setting) {
                        if (value) {
                            const option = setting[2];

                            const isSome = dataSource.value.some((item) => {
                                return (
                                    item.__dataIndex !== option.index &&
                                    item.id === value
                                );
                            });

                            if (isSome) {
                                return Promise.reject($t('Object.index.371533-8'));
                            }
                            return Promise.resolve();
                        }
                        return Promise.reject($t('Object.index.371533-0'));
                    },
                },
                { max: 64, message: $t('Object.index.371533-9') },
                {
                    pattern: /^[a-zA-Z0-9_]+$/,
                    message: $t('Object.index.371533-10'),
                },
            ],
        },
    },
    {
        title: $t('Object.index.371533-11'),
        dataIndex: 'name',
        form: {
            required: true,
            rules: [
                {
                    required: true,
                    message: $t('Object.index.371533-1'),
                },
                { max: 64, message: $t('Object.index.371533-9') },
            ],
        },
    },
    props.type === 'functions'
        ? {
              title: $t('Object.index.371533-12'),
              dataIndex: 'expands',
              width: 120,
          }
        : null,
    {
        title: $t('Object.index.371533-13'),
        dataIndex: 'valueType',
        width: 240,
        form: {
            required: true,
            rules: [
                {
                    validator(_, value) {
                        if (!value?.type) {
                            return Promise.reject($t('Object.index.371533-14'));
                        }
                        return validatorConfig(value, true);
                    },
                },
            ],
        },
    },
];

const myColumns = computed(() => {
    return [
        ...defaultColumns.filter((item) => !!item),
        {
            dataIndex: 'action',
            title: $t('Object.index.371533-15'),
            width: locale.value === 'zh' ? 60 : 100,
        },
    ];
});

const onOk = async () => {
    const data = await tableRef.value.validate();
    if (data) {
        visible.value = false;
        emit('update:value', data);
        emit('confirm', data);
        formItemContext.onFieldChange();
    }
};

const onCancel = () => {
    emit('cancel');
};

const deleteItem = (index) => {
    dataSource.value.splice(index, 1);
};

const addItem = () => {
    dataSource.value.push({
        id: undefined,
        name: undefined,
        expands: {
            required: false,
        },
        valueType: {
            expands: {},
        },
    });
};

watch(
    () => [JSON.stringify(props.value), visible.value],
    (val) => {
        if (visible.value) {
            dataSource.value = JSON.parse(val[0] || '[]').map(item => {
                item = {
                    expands: {
                        required: false,
                    },
                    ...item,
                }
                return item
            });
        }
    },
    { immediate: true },
);
</script>

<style scoped></style>
