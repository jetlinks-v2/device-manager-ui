<template>
    <a-button @click="visible = true" style="width: 100%" type="dashed">
        {{ $t('FRuleEditor.index.911643-0') }}
    </a-button>
    <FRuleEditor v-if="visible" :id="id" :aggList="aggList" :propertiesOptions="propertiesOptions" :value="value" :virtualRule="virtualRule" @close="onClose" @save="onChange" />
</template>

<script setup lang="ts" name="Rule">
import FRuleEditor from '../../../../../../../components/FRuleEditor/index.vue';
import {Form} from "ant-design-vue";

const formItemContext = Form.useInjectFormItemContext();

interface Emits {
    (e: 'update:value', data: string | undefined): void;
    (e: 'change', data: string | undefined): void;
}
const emit = defineEmits<Emits>();

const props = defineProps({
    value: String,
    id: String,
    virtualRule: Object,
    aggList: Array,
    propertiesOptions: Array
});

const visible = ref<boolean>(false);

const onChange = (val: string | undefined) => {
    emit('change', val)
    emit('update:value', val)
    formItemContext.onFieldChange()
    onClose()
}

const onClose = () => {
    visible.value = false
}
</script>
