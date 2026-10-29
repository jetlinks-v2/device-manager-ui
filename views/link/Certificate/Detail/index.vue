<template>
    <PageChrome>
        <a-button class="router-detail-back" type="text" @click="menuStore.jumpPage('link/Certificate')">
            <template #icon><AIcon type="LeftOutlined" /></template>
            {{ $t('Certificate.detail.backToList') }}
        </a-button>
    </PageChrome>
    <j-page-container>
        <FullPage class="certificate-detail" :fixed="false" margin="0">
            <ContentPanel class="certificate-guide" :fill="true" :background="false">
                <a-row :gutter="[24, 16]">
                    <a-col :xs="24" :xl="8">
                        <div class="certificate-guide-overview">
                            <div>
                                <h1>{{ $t('Detail.index.247061-18') }}</h1>
                                <p>{{ $t('Detail.index.247061-19') }}</p>
                            </div>
                        </div>
                    </a-col>
                    <a-col :xs="24" :xl="16">
                        <div class="certificate-guide-config">
                            <h1>{{ $t('Detail.index.247061-20') }}</h1>
                            <a-row :gutter="[24, 16]">
                                <a-col :xs="24" :md="12">
                                    <h2>1、{{ $t('Detail.index.247061-5') }}</h2>
                                    <p>{{ $t('Detail.index.247061-22') }}</p>
                                </a-col>
                                <a-col :xs="24" :md="12">
                                    <h2>2、{{ $t('Detail.index.247061-12') }}</h2>
                                    <p>
                                        {{ $t('Detail.index.247061-24') }}
                                        {{ $t('Detail.index.247061-25') }}
                                    </p>
                                </a-col>
                            </a-row>
                        </div>
                    </a-col>
                </a-row>
            </ContentPanel>

            <a-form class="certificate-form" layout="vertical" :model="formData" name="basic"
                    :label-col="{ span: 8 }" :wrapper-col="{ span: 24 }" autocomplete="off" ref="formRef">
                <ResponsiveGrid min="min(100%, 20rem)" fill="auto-fit" gap="var(--space-4)">
                    <ContentPanel class="certificate-fields" :fill="true" :background="false">
                        <a-form-item :label="$t('Detail.index.247061-0')" name="type"
                                     :rules="[{ required: true, message: $t('Detail.index.247061-1'), trigger: 'blur' }]">
                            <a-radio-group class="certificate-standard" v-model:value="formData.type">
                                <a-radio-button class="certificate-standard-option" value="common">
                                    <img :src="link.certificate" alt="" />
                                    <AIcon class="certificate-standard-check" type="CheckCircleFilled" aria-hidden="true" />
                                </a-radio-button>
                            </a-radio-group>
                        </a-form-item>
                        <a-form-item :label="$t('Detail.index.247061-2')" name="name" :rules="[
                            { required: true, message: $t('Detail.index.247061-3'), trigger: 'blur' },
                            { max: 64, message: $t('Detail.index.247061-4') },
                        ]">
                            <a-input :placeholder="$t('Detail.index.247061-3')" v-model:value="formData.name" />
                        </a-form-item>
                        <a-form-item :label="$t('Detail.index.247061-14')" name="description"
                                     :rules="[{ max: 200, message: $t('Detail.index.247061-15') }]">
                            <a-textarea :placeholder="$t('Detail.index.247061-16')" v-model:value="formData.description"
                                        :maxlength="200" :rows="8" showCount />
                        </a-form-item>
                    </ContentPanel>

                    <ContentPanel class="certificate-fields" :fill="true" :background="false">
                        <a-form-item :label="$t('Detail.index.247061-5')" :name="['configs','cert']" :rules="[
                            { required: true, message: $t('Detail.index.247061-6'), trigger: 'change' },
                        ]">
                            <CertificateFile name="cert" accept=".pem" v-model:modelValue="formData.configs.cert"
                                             :placeholder="$t('Detail.index.247061-7')" />
                        </a-form-item>
                        <a-form-item :label="$t('Detail.index.247061-8')" name="mode"
                                     :rules="[{ required: true, message: $t('Detail.index.247061-9'), trigger: 'blur' }]">
                            <a-radio-group class="certificate-mode" v-model:value="formData.mode" button-style="solid">
                                <a-radio-button value="client" size="large">{{ $t('Detail.index.247061-10') }}</a-radio-button>
                                <a-radio-button value="server" size="large">{{ $t('Detail.index.247061-11') }}</a-radio-button>
                            </a-radio-group>
                        </a-form-item>
                        <a-form-item :label="$t('Detail.index.247061-12')" v-if="formData.mode !== 'client'" :name="['configs','key']" :rules="[
                            { required: true, message: $t('Detail.index.247061-6'), trigger: 'change' },
                        ]">
                            <CertificateFile name="key" v-model:modelValue="formData.configs.key"
                                             :placeholder="$t('Detail.index.247061-13')" />
                        </a-form-item>
                    </ContentPanel>

                </ResponsiveGrid>

                <div v-if="view === 'false'" class="certificate-actions">
                    <a-button class="form-submit" html-type="submit" type="primary"
                              @click.prevent="onSubmit" :loading="loading">{{ $t('Detail.index.247061-17') }}</a-button>
                </div>
            </a-form>
        </FullPage>
    </j-page-container>
</template>

<script lang="ts" setup name="CertificateDetail">
import { link } from '../../../../assets'
import CertificateFile from './CertificateFile.vue';
import type { UploadChangeParam } from 'ant-design-vue';
import { save, update, queryDetail } from '../../../../api/link/certificate';
import { FormDataType, TypeObjType } from '../type';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const router = useRouter();
const route = useRoute();
const view = route.query.view as string;
const id = route.params.id as string;
const menuStore = useMenuStore();

const formRef = ref()
const fileLoading = ref(false);
const loading = ref(false);

const formData = ref<FormDataType>({
    type: 'common',
    name: '',
    configs: {
        cert: '',
        key: '',
    },
    description: '',
    mode: 'server',
    authenticationMethod: 'single'
});

// const rules = {
//         type: [{ required: true, message: $t('Detail.index.247061-1'), trigger: 'blur' }],
//         name: [
//             { required: true, message: $t('Detail.index.247061-3'), trigger: 'blur' },
//             { max: 64, message: $t('Detail.index.247061-4') },
//         ],
//         'configs.cert': [
//             { required: true, message: $t('Detail.index.247061-6'), trigger: 'blur' },
//         ],
//         'configs.key': [
//             { required: true, message: $t('Detail.index.247061-6'), trigger: 'blur' },
//         ],
//         description: [{ max: 200, message: $t('Detail.index.247061-15') }],
//         mode:[{ required: true, message: $t('Detail.index.247061-9'), trigger: 'blur' }],
//         authenticationMethod:[{ required: true, message: '请选择认证方式', trigger: 'blur' }]
// );

const onSubmit = () => {
    formRef.value.validate()
        .then(async (res) => {
            let params: any = toRaw(formData.value);
            if (formData.value.mode === 'client') {
                if (formData.value.authenticationMethod === 'binomial') {
                    params.configs.trust = params.configs.cert
                } else {
                    params.configs = {
                        // key:formData.value.configs.key,
                        trust: formData.value.configs.cert
                    }
                }
            }
            loading.value = true;
            const response =
                id === ':id'
                    ? await save(params).catch(() => { })
                    : await update({ ...params, id }).catch(() => { });
            if (response?.status === 200) {
                onlyMessage($t('Detail.index.247061-26'), 'success');
              menuStore.jumpPage('link/Certificate')
            }
            loading.value = false;
        })
        .catch((err) => {
            loading.value = false;
        });
};

const handleChange = (info: UploadChangeParam) => {
    fileLoading.value = true;
    if (info.file.status === 'done') {
        onlyMessage($t('Detail.index.247061-27'), 'success');
        const result = info.file.response?.result;
        formData.value.configs.cert = result;
        fileLoading.value = false;
    }
};

const detail = async (id: string) => {
    if (id !== ':id') {
        loading.value = true;
        const res: any = await queryDetail(id);
        if (res.success) {
            const result: any = res.result;
            const type = result.type.value as TypeObjType;
            formData.value = {
                ...result,
                configs: {
                    key: result.configs.key,
                    cert: result.configs?.cert ? result.configs?.cert : result.configs?.trust
                },
                mode: result.mode.value,
                authenticationMethod: result.authenticationMethod?.value,
                type,
            };
        }
        loading.value = false;
    }
};

detail(id);
</script>

<style lang="less" scoped src="./detail.less"></style>
