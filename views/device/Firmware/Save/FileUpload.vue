<template>
    <a-form-item-rest>
        <CoreFileUpload
            :value="fileList"
            :size="Infinity"
            :multiple="false"
            :max-count="1"
            :disabled="uploading"
            :custom-request="uploadByRequest"
            drag
            @upload-change="handleChange"
            @remove="handleRemove"
        />
    </a-form-item-rest>
</template>

<script setup lang="ts" name="FirmwareFileUpload">
import { toRef } from 'vue';
import { FileUpload as CoreFileUpload } from '@jetlinks-web-core/components';
import { uploadByRequest } from '@jetlinks-web-core/components/Upload/utils';
import { useFirmwareFileUpload } from './useFirmwareFileUpload';

defineOptions({ inheritAttrs: false });

const props = defineProps({
    modelValue: {
        type: String,
        default: '',
    },
});

const emit = defineEmits(['update:modelValue', 'update:extraValue', 'change', 'update:uploading']);
const { fileList, uploading, handleChange, handleRemove } =
    useFirmwareFileUpload(toRef(props, 'modelValue'), {
        onValueChange: (value) => emit('update:modelValue', value),
        onExtraValueChange: (value) => emit('update:extraValue', value),
        onUploadingChange: (value) => emit('update:uploading', value),
    });
</script>
