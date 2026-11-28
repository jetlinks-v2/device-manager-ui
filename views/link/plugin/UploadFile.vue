<template>
    <CoreFileUpload
        :value="fileList"
        accept=".jar,.zip"
        :size="Infinity"
        :multiple="false"
        :max-count="1"
        :disabled="props.disabled || props.uploading || uploading"
        :before-upload="beforeUpload"
        :custom-request="uploadRequest"
        drag
        @upload-change="handleChange"
        @remove="removeFile"
    />
    <div v-if="latestProgress || error" class="plugin-check-progress" aria-live="polite">
        <div v-if="latestProgress" class="plugin-check-progress__summary">
            <span>{{ progressLabel(latestProgress, t) }}</span>
            <span class="plugin-check-progress__amount">{{ progressAmount(latestProgress, locale, t) }}</span>
            <a-button v-if="nodeProgress.length > 1" type="link" size="small" :aria-expanded="showNodes" @click="showNodes = !showNodes">
                {{ t('pluginInstall.nodes', { count: nodeProgress.length }) }}
            </a-button>
        </div>
        <div v-if="showNodes" class="plugin-check-progress__nodes">
            <div v-for="event in nodeProgress" :key="event.attributes?.serverId" class="plugin-check-progress__node">
                <span class="plugin-check-progress__identity">{{ event.attributes?.serviceId || event.attributes?.serverId }}<template v-if="event.attributes?.serviceId && event.attributes?.serviceId !== event.attributes?.serverId"> · {{ event.attributes?.serverId }}</template></span>
                <span>{{ progressLabel(event, t) }} {{ progressAmount(event, locale, t) }}</span>
                <span v-if="event.errorMessage" class="plugin-check-progress__error">{{ event.errorMessage }}</span>
            </div>
        </div>
        <div v-if="error" class="plugin-check-progress__error" role="alert">{{ error }}</div>
        <div v-else-if="latestProgress && pluginCheckResult(latestProgress)" class="plugin-check-progress__hint">{{ t('pluginInstall.checkOnly') }}</div>
    </div>
</template>

<script setup lang="ts">
import { FileUpload as CoreFileUpload } from '@jetlinks-web-core/components';
import { createPluginDriverUpload, type PluginInstallProgress } from '../../../api/link/pluginInstall';
import { pluginCheckResult } from '../../../api/link/pluginInstallProgress';
import { usePluginFileUpload } from './usePluginFileUpload';
import { progressLabel, progressAmount } from './installProgress';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { theme, type UploadProps } from 'ant-design-vue';

defineOptions({ name: 'PluginFileUpload' })

const props = defineProps({
    modelValue: {
        type: String,
        default: '',
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    fileName: {
        type: String,
        default: undefined,
    },
    uploading: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(['update:modelValue', 'change', 'update:uploading']);
const { t, locale } = useI18n();
const { token } = theme.useToken();
const progress = ref<PluginInstallProgress[]>([]);
const latestProgress = ref<PluginInstallProgress>();
const showNodes = ref(false);
const nodeProgress = computed(() => progress.value.filter(event => event.attributes?.serverId));
let abort: (() => void) | undefined;
const uploadRequest: UploadProps['customRequest'] = options => {
    abort?.();
    progress.value = []; latestProgress.value = undefined; showNodes.value = false;
    const handle = createPluginDriverUpload(event => {
        latestProgress.value = event;
        if (pluginCheckResult(event)) progress.value = progress.value.map(previous =>
            ['STARTED', 'PROGRESS'].includes(previous.status) ? { ...previous, status: 'CANCELLED' } : previous);
        const id = event.attributes?.serverId;
        if (id) progress.value = [...progress.value.filter(previous => previous.attributes?.serverId !== id), event];
    })(options);
    abort = handle.abort;
    return handle;
};
onBeforeUnmount(() => abort?.());
const { fileList, uploading, error, beforeUpload, handleChange, handleRemove } =
    usePluginFileUpload(props.fileName, {
        onChange: (result) => {
            emit('update:modelValue', result?.version || '');
            emit('change', result || {});
        },
        onUploadingChange: (value) => emit('update:uploading', value),
    });
const removeFile = () => {
    abort?.(); progress.value = []; latestProgress.value = undefined; showNodes.value = false;
    handleRemove();
};
</script>

<style scoped>
.plugin-check-progress { margin-top:var(--space-2); font-size:var(--fs-12,12px); line-height:20px; }
.plugin-check-progress__summary { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2); }
.plugin-check-progress__amount, .plugin-check-progress__hint { color:var(--ink-3); }
.plugin-check-progress__nodes { max-height:180px; overflow:auto; margin-top:var(--space-2); padding:var(--space-2) 0; border-top:1px solid var(--line); }
.plugin-check-progress__node { display:flex; flex-wrap:wrap; gap:var(--space-2); color:var(--ink-3); }
.plugin-check-progress__identity { overflow-wrap:anywhere; }
.plugin-check-progress__error { color:v-bind('token.colorError'); overflow-wrap:anywhere; }
</style>
