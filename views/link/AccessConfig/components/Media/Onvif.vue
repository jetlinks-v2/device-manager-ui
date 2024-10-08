<template>
    <div class="card-last">
        <a-row :gutter="[24, 24]">
            <a-col :span="12">
                <title-component data="基本信息" />
                <div>
                    <a-form
                        :model="formState"
                        name="basic"
                        autocomplete="off"
                        layout="vertical"
                        @finish="onFinish"
                    >
                        <a-form-item
                            label="名称"
                            name="name"
                            :rules="[
                                {
                                    required: true,
                                    message: '请输入名称',
                                    trigger: 'blur',
                                },
                                {
                                    max: 64,
                                    message: '最多可输入64个字符',
                                    trigger: 'blur',
                                },
                            ]"
                        >
                            <a-input
                                placeholder="请输入名称"
                                v-model:value="formState.name"
                            />
                        </a-form-item>
                        <a-form-item label="说明" name="description">
                            <a-textarea
                                placeholder="请输入说明"
                                :rows="4"
                                v-model:value="formState.description"
                                show-count
                                :maxlength="200"
                            />
                        </a-form-item>
                        <a-form-item>
                            <j-permission-button
                                v-if="view === 'false'"
                                type="primary"
                                html-type="submit"
                                :hasPermission="`link/AccessConfig:${
                                    id === ':id' ? 'add' : 'update'
                                }`"
                                :loading="loading"
                            >
                                保存
                            </j-permission-button>
                        </a-form-item>
                    </a-form>
                </div>
            </a-col>
            <a-col :span="12">
                <div class="doc">
                    <h1>Onvif视频接入</h1>
                    <p>
                        适用于使用RSTP或RTMP固定地址接入的视频设备
                    </p>
                    <h1>消息协议</h1>
                    <p>
                        内置Onvif协议
                    </p>
                </div>
            </a-col>
        </a-row>
    </div>
</template>

<script lang="ts" setup>
import { onlyMessage } from '@jetlinks-web/utils';
import { update, save } from '../../../../../api/link/accessConfig';
interface FormState {
    name: string;
    description: string;
}
const route = useRoute();
const view = route.query.view as string;
const id = route.params.id as string;

const props = defineProps({
    provider: {
        type: Object,
        default: () => {},
    },
    data: {
        type: Object,
        default: () => {},
    },
});
const loading = ref(false);
const channel = ref(props.provider.channel);

const formState = ref<FormState>({
    name: '',
    description: '',
});
const onFinish = async (values: any) => {
    loading.value = true;
    const params = {
        ...values,
        provider: 'onvif',
        transport: 'ONVIF',
        channel: 'onvif',
    };
    const resp =
        id === ':id' ? await save(params) : await update({ ...params, id });
    if (resp.status === 200) {
        onlyMessage('操作成功', 'success');

        if (route.query.save) {
            // @ts-ignore
            if ((window as any).onTabSaveSuccess) {
                (window as any).onTabSaveSuccess(resp.result);
                setTimeout(() => window.close(), 300);
            }
        } else {
            history.back();
        }
    }
    loading.value = false;
};
onMounted(() => {
    if (id !== ':id') {
        formState.value = {
            name: props.data.name,
            description: props.data?.description || '',
        };
    }
});
</script>
<style lang="less" scoped>
.card-last {
    padding-right: 5px;
    overflow-y: auto;
    overflow-x: hidden;
}
</style>
