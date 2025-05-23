<template>
    <PopoverModal
        v-model:visible="visible"
        :placement="placement"
        @ok="onOk"
        @cancel="onCancel"
    >
        <template #content>
            <div style="width: 560px">
                <a-form ref="formRef" layout="vertical" :model="formData">
                    <a-form-item
                        :label="$t('Array.index.399995-0')"
                        required
                        name="type"
                        :rules="rules"
                        :validate-first="true"
                    >
                        <ArrayTypeSelect
                            v-model:value="formData.type"
                            :data="formData"
                            :filter="level <= 2 ? [] : ['object', 'array']"
                            @changeFormData="TypeChange"
                        />
                    </a-form-item>
                    <ScaleItem
                        v-if="showDouble"
                        v-model:value="formData.scale"
                    />
                    <StringItem
                        v-else-if="showString"
                        v-model:value="formData.expands.maxLength"
                    />
                    <BooleanItem
                        v-else-if="showBoolean"
                        v-model:value="formData.boolean"
                        name="boolean"
                    />
                    <DateItem
                        v-else-if="showDate"
                        v-model:value="formData.format"
                    />
                    <EnumItem
                        ref="enumTableRef"
                        v-else-if="showEnum"
                        v-model:value="formData.enum.elements"
                    />
                    <ObjectItem
                      ref="tableRef"
                      v-else-if="showObject && level <= 2"
                      v-model:value="formData.properties"
                      :level="level + 1"
                    />
                    <a-form-item
                        v-else-if="showArray"
                        :label="$t('Array.index.399995-1')"
                        required
                        :name="['elementType', 'type']"
                        :rules="[
                            { required: true, message: $t('Array.index.399995-2') },
                        ]"
                    >
                        <TypeSelect
                            v-model:value="formData.elementType"
                            :filter="['array', 'object']"
                        />
                    </a-form-item>
                </a-form>
            </div>
        </template>
        <slot>
            <a-button type="link" :disabled="disabled" style="padding: 0">
                <template #icon>
                    <AIcon
                        type="EditOutlined"
                        :class="{ 'table-form-required-aicon': !value.type }"
                    />
                </template>
            </a-button>
        </slot>
    </PopoverModal>
</template>

<script setup name="MetadataArray">
import { PopoverModal, TypeSelect } from '../index';
import ArrayTypeSelect from './ArrayTypeSelect.vue';
import ScaleItem from '../Double/ScaleItem.vue';
import StringItem from '../String/Item.vue';
import BooleanItem from '../Boolean/Item.vue';
import DateItem from '../Date/Item.vue';
import EnumItem from '../Enum/Item.vue';
import ObjectItem from '../Object/Item.vue';
import { cloneDeep, pick } from 'lodash-es';
import { Form } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const emit = defineEmits(['update:value', 'cancel', 'confirm']);

const props = defineProps({
    value: {
        type: Object,
        default: () => ({}),
    },
    unitOptions: {
        type: [Array, Function],
        default: () => [],
    },
    placement: {
        type: String,
        default: 'top',
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    level: {
      type: Number,
      default: 1
    }
});

const formItemContext = Form.useInjectFormItemContext();

const formRef = ref();
const enumTableRef = ref();
const tableRef = ref();
const visible = ref(false);
const formData = ref({
    type: props.value?.type,
    scale: props.value?.scale,
    expands: {
        maxLength: props.value?.maxLength || props.value?.expands?.maxLength,
    },
    boolean: {
        trueText: props.value?.trueText || $t('Array.index.399995-3'),
        trueValue: props.value?.trueValue || 'true',
        falseText: props.value?.falseText || $t('Array.index.399995-4'),
        falseValue: props.value?.falseValue || 'false',
    },
    format: props.value?.format,
    enum: {
        multiple: props.value?.multiple,
        elements: cloneDeep(props.value?.elements) || [],
    },
    elementType:
        props.value?.type === 'array'
            ? props.value.elementType
            : {
                type: undefined,
            },
    properties: props.value?.properties || [],
});

const showDouble = computed(() => {
    return ['float', 'double'].includes(formData.value.type);
});

const showString = computed(() => {
    return ['string', 'password'].includes(formData.value.type);
});

const showBoolean = computed(() => {
    return formData.value.type === 'boolean';
});

const showDate = computed(() => {
    return formData.value.type === 'date';
});

const showEnum = computed(() => {
    return formData.value.type === 'enum';
});

const showArray = computed(() => {
    return formData.value.type === 'array';
});

const showObject = computed(() => {
    return formData.value.type === 'object';
});

const rules = [
    {
        validator(_, value) {
            if (!value) {
                return Promise.reject($t('Array.index.399995-5'));
            }
            return Promise.resolve();
        },
        trigger: 'change',
    },
];

const typeChange = (e) => {
    if (['float', 'double'].includes(e)) {
        formData.value.scale = 2;
    }
};

const initValue = () => {
    formData.value.type = props.value?.type;
    formData.value.scale = props.value?.scale;
    formData.value.expands.maxLength =
        props.value?.maxLength || props.value?.expands?.maxLength;
    formData.value.boolean = {
        trueText: props.value?.trueText || $t('Array.index.399995-3'),
        trueValue: props.value?.trueValue || 'true',
        falseText: props.value?.falseText || $t('Array.index.399995-4'),
        falseValue: props.value?.falseValue || 'false',
    };
    formData.value.format = props.value?.format;
    formData.value.enum = {
        multiple: props.value?.multiple,
        elements: cloneDeep(props.value?.elements || []),
    };

    formData.value.elementType =
        props.value?.type === 'array'
            ? props.value.elementType
            : {
                type: undefined,
            };
    formData.value.properties = props.value.properties || []
};

const handleValue = (type, data) => {
    let newObject = {};
    switch (type) {
        case 'float':
        case 'double':
            newObject = pick(data, 'scale');
            break;
        case 'boolean':
            newObject = { ...data.boolean };
            break;
        case 'enum':
            newObject.elements = data.enum.elements;
            break;
        case 'string':
        case 'password':
            newObject = pick(data, 'expands');
            break;
        case 'date':
            newObject = pick(data, 'format');
            break;
        case 'object':
            newObject = pick(data, 'properties');
          break;
        case 'array':
            newObject = pick(data, 'elementType');
    }

    return {
        type: type,
        ...newObject,
    };
};

const onOk = async () => {
    const data = await formRef.value.validate();
    let enumTable = true;
    let tableData = true;
    if (enumTableRef.value) {
        enumTable = !!(await enumTableRef.value.validate());
    }

    if (tableRef.value) {
        tableData = await tableRef.value.validate();
        formData.value.properties = tableData
    }
    if (data && (enumTable || tableData)) {
        visible.value = false;
        const _value = handleValue(formData.value.type, formData.value);
        emit('update:value', _value);
        emit('confirm', _value);
        formItemContext.onFieldChange();
    }
};

const onCancel = () => {
    formRef.value?.resetFields();
    initValue();
    emit('cancel');
};

const TypeChange = (extra) => {
    if (JSON.stringify(extra) !== '{}') {
        formData.value.boolean = {
            ...extra,
        };
    }
};

watch(
    () => JSON.stringify(props.value),
    () => {
        initValue();
    },
);
</script>

<style scoped></style>
