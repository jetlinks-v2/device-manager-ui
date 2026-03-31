<template>
  <a-row :gutter="[24, 24]" :style="containerStyle">
    <a-col :span="12">
      <a-form
        ref="formRef"
        class="form"
        layout="vertical"
        :model="formData"
        name="certificate-form"
        :label-col="{ span: 8 }"
        :wrapper-col="{ span: 24 }"
        autocomplete="off"
      >
        <a-form-item
          :label="$t('Detail.index.247061-0')"
          name="type"
          :rules="[{ required: true, message: $t('Detail.index.247061-1'), trigger: 'blur' }]"
        >
          <a-radio-group v-model:value="formData.type">
            <a-radio-button class="form-radio-button" value="common">
              <img :src="link.certificate" />
            </a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          :label="$t('Detail.index.247061-2')"
          name="name"
          :rules="[
            { required: true, message: $t('Detail.index.247061-3'), trigger: 'blur' },
            { max: 64, message: $t('Detail.index.247061-4') },
          ]"
        >
          <a-input v-model:value="formData.name" :placeholder="$t('Detail.index.247061-3')" />
        </a-form-item>
        <a-form-item
          v-if="props.id === ':id' || formData.configs?.cert"
          :label="$t('Detail.index.247061-5')"
          :name="['configs', 'cert']"
          :rules="props.id === ':id' ? [{ required: true, message: $t('Detail.index.247061-6'), trigger: 'change' }] : []"
        >
          <CertificateFile
            name="cert"
            accept=".pem"
            v-model:modelValue="formData.configs.cert"
            :placeholder="$t('Detail.index.247061-7')"
          />
        </a-form-item>
        <a-form-item
          v-if="props.id === ':id' || formData.configs?.cert"
          :label="$t('Detail.index.247061-8')"
          name="mode"
          :rules="[{ required: true, message: $t('Detail.index.247061-9'), trigger: 'blur' }]"
        >
          <a-radio-group v-model:value="formData.mode" button-style="solid">
            <a-radio-button value="client" style="margin-right: 30px" size="large">
              {{ $t('Detail.index.247061-10') }}
            </a-radio-button>
            <a-radio-button value="server" size="large">
              {{ $t('Detail.index.247061-11') }}
            </a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          v-if="formData.mode !== 'client' && (props.id === ':id' || formData.configs?.cert)"
          :label="$t('Detail.index.247061-12')"
          :name="['configs', 'key']"
          :rules="props.id === ':id' ? [{ required: true, message: $t('Detail.index.247061-6'), trigger: 'change' }] : []"
        >
          <CertificateFile
            name="key"
            v-model:modelValue="formData.configs.key"
            :placeholder="$t('Detail.index.247061-13')"
          />
        </a-form-item>
        <a-form-item
          :label="$t('Detail.index.247061-14')"
          name="description"
          :rules="[{ max: 200, message: $t('Detail.index.247061-15') }]"
        >
          <a-textarea
            v-model:value="formData.description"
            :placeholder="$t('Detail.index.247061-16')"
            :maxlength="200"
            :rows="3"
            showCount
          />
        </a-form-item>
        <a-form-item v-if="!readonly">
          <a-space>
            <a-button v-if="showCancel" @click="emit('cancel')">
              {{ $t('Certificate.index.646549-10') }}
            </a-button>
            <a-button class="form-submit" type="primary" @click.prevent="onSubmit" :loading="loading">
              {{ $t('Detail.index.247061-17') }}
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-col>
    <a-col :span="12">
      <div class="doc">
        <h1>{{ $t('Detail.index.247061-18') }}</h1>
        <div>{{ $t('Detail.index.247061-19') }}</div>
        <h1>{{ $t('Detail.index.247061-20') }}</h1>
        <h2>{{ $t('Detail.index.247061-5') }}</h2>
        <div>{{ $t('Detail.index.247061-22') }}</div>
        <h2>{{ $t('Detail.index.247061-12') }}</h2>
        <div>
          {{ $t('Detail.index.247061-24') }}
          {{ $t('Detail.index.247061-25') }}
        </div>
      </div>
    </a-col>
  </a-row>
</template>

<script lang="ts" setup>
import { computed, ref, watch, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { link } from '../../../../assets';
import { onlyMessage } from '@jetlinks-web/utils';
import { save, update, queryDetail } from '../../../../api/link/certificate';
import CertificateFile from './CertificateFile.vue';
import type { FormDataType, TypeObjType } from '../type';

const props = withDefaults(
  defineProps<{
    id?: string;
    view?: boolean;
    showCancel?: boolean;
    padding?: string;
  }>(),
  {
    id: ':id',
    view: false,
    showCancel: false,
    padding: '24px',
  },
);

const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'cancel'): void;
}>();

const { t: $t } = useI18n();

const formRef = ref();
const loading = ref(false);
const readonly = computed(() => props.view);
const containerStyle = computed(() => ({ padding: props.padding }));

const createDefaultFormData = (): FormDataType => ({
  type: 'common',
  name: '',
  configs: {
    cert: '',
    key: '',
  },
  description: '',
  mode: 'server',
  authenticationMethod: 'single',
});

const formData = ref<FormDataType>(createDefaultFormData());

const loadDetail = async (id: string) => {
  if (id === ':id') {
    formData.value = createDefaultFormData();
    return;
  }

  loading.value = true;
  const res: any = await queryDetail(id).catch(() => undefined);
  if (res?.success) {
    const result: any = res.result;
    const type = result.type.value as TypeObjType;
    formData.value = {
      ...result,
      configs: result.configs ? {
        key: result.configs.key,
        cert: result.configs.cert ? result.configs.cert : result.configs.trust,
      } : null,
      mode: result.mode.value,
      authenticationMethod: result.authenticationMethod?.value,
      type,
    };
  }
  loading.value = false;
};

const onSubmit = async () => {
  loading.value = true;
  try {
    await formRef.value.validate();
    const params: any = toRaw(formData.value);

    if (formData.value.mode === 'client') {
      if (formData.value.authenticationMethod === 'binomial') {
        params.configs.trust = params.configs.cert;
      } else {
        params.configs = {
          trust: formData.value.configs.cert,
        };
      }
    }

    const response =
      props.id === ':id'
        ? await save(params).catch(() => undefined)
        : await update({ ...params, id: props.id }).catch(() => undefined);

    if (response?.status === 200) {
      onlyMessage($t('Detail.index.247061-26'), 'success');
      emit('success');
    }
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.id,
  (id) => {
    loadDetail(id);
  },
  { immediate: true },
);
</script>

<style lang="less" scoped>
.form {
  .form-radio-button {
    width: 148px;
    height: 80px;
    padding: 0;

    img {
      width: 100%;
      height: 100%;
    }
  }
}
</style>
