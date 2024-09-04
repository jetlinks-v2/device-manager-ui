<template>
    <div style="margin-top: 10px">
        <a-steps :current="stepCurrent">
            <a-step disabled v-for="item in steps" :key="item" :title="item" />
        </a-steps>
        <div class="steps-content">
            <div class="steps-box" v-if="current === 0">
                <div class="alert">
                    <AIcon type="InfoCircleOutlined" />
                    配置设备信令参数
                </div>

                <a-form
                    :model="formState"
                    ref="formRef1"
                    name="basic"
                    autocomplete="off"
                    layout="vertical"
                >
                    <a-row :gutter="[24, 24]">
                        <a-col :span="12">
                            <a-form-item
                                label="SIP 域"
                                name="domain"
                                :rules="[
                                    {
                                        required: true,
                                        message: '请输入SIP 域',
                                    },
                                    {
                                        max: 64,
                                        message: '最多可输入64个字符',
                                        trigger: 'blur',
                                    },
                                ]"
                            >
                                <a-input
                                    v-model:value="formState.domain"
                                    placeholder="请输入SIP 域"
                                />
                            </a-form-item>
                        </a-col>
                        <a-col :span="12">
                            <a-form-item
                                label="SIP ID"
                                name="sipId"
                                :rules="[
                                    {
                                        required: true,
                                        message: '请输入SIP ID',
                                    },
                                    {
                                        max: 64,
                                        message: '最多可输入64个字符',
                                        trigger: 'blur',
                                    },
                                ]"
                            >
                                <a-input
                                    v-model:value="formState.sipId"
                                    placeholder="请输入SIP ID"
                                />
                            </a-form-item>
                        </a-col>
                    </a-row>

                    <a-form-item
                        name="shareCluster"
                        :rules="[
                            {
                                required: true,
                                message: '请选择集群',
                            },
                        ]"
                    >
                        <template #label>
                            集群
                            <a-tooltip
                                title="共享配置:集群下所有节点共用同一配置,独立配置:集群下不同节点使用不同配置"
                            >
                                <AIcon
                                    type="QuestionCircleOutlined"
                                    style="margin-left: 2px"
                                />
                            </a-tooltip>
                        </template>
                        <a-radio-group v-model:value="formState.shareCluster">
                            <a-radio :value="true">共享配置</a-radio>
                            <a-radio :value="false">独立配置</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <div v-if="formState.shareCluster" class="form-item1">
                        <a-row :gutter="[24, 24]">
                            <a-col :span="6">
                                <a-form-item
                                    label="SIP 地址"
                                    :name="['hostPort', 'host']"
                                    :rules="[
                                        {
                                            required: true,
                                            message: '请选择SIP地址',
                                        },
                                    ]"
                                >
                                    <a-select
                                        v-model:value="formState.hostPort.host"
                                        style="width: 105%"
                                        :disabled="true"
                                        show-search
                                        :filter-option="filterOption"
                                    >
                                        <a-select-option value="0.0.0.0"
                                            >0.0.0.0</a-select-option
                                        >
                                    </a-select>
                                </a-form-item>
                            </a-col>
                            <a-col :span="6">
                                <a-form-item
                                    :name="['hostPort', 'port']"
                                    :rules="[
                                        {
                                            required: true,
                                            message: '请选择端口',
                                        },
                                    ]"
                                >
                                    <div class="form-label"></div>

                                    <a-select
                                        v-model:value="formState.hostPort.port"
                                        :options="sipList"
                                        placeholder="请选择端口"
                                        allowClear
                                        show-search
                                        :filter-option="filterOption"
                                    />
                                </a-form-item>
                            </a-col>
                            <a-col :span="6">
                                <a-form-item
                                    label="公网 Host"
                                    :name="['hostPort', 'publicHost']"
                                    :rules="[
                                        {
                                            required: true,
                                            message: '请输入IP地址',
                                        },
                                        {
                                            validator:validateUrl,
                                            trigger: 'change',
                                        },

                                    ]"
                                    :validateFirst="true"
                                >
                                    <a-input
                                        style="width: 105%"
                                        v-model:value="
                                            formState.hostPort.publicHost
                                        "
                                        :max="65535"
                                        :min="1"
                                        :precision="0"
                                        placeholder="请输入IP地址"
                                    />
                                </a-form-item>
                            </a-col>
                            <a-col :span="6">
                                <a-form-item
                                    :name="['hostPort', 'publicPort']"
                                    :rules="rules.publicPort"
                                    :validateFirst="true"
                                >
                                    <div class="form-label"></div>

                                    <a-input-number
                                        style="width: 100%"
                                        placeholder="请输入端口"
                                        v-model:value="
                                            formState.hostPort.publicPort
                                        "
                                        :min="1"
                                        :max="65535"
                                        :precision="0"
                                    />
                                </a-form-item>
                            </a-col>
                        </a-row>
                    </div>
                </a-form>
                <div v-if="!formState.shareCluster">
                    <a-form
                        ref="formRef2"
                        layout="vertical"
                        name="dynamic_form_nest_item"
                        :model="dynamicValidateForm"
                    >
                        <div
                            v-for="(
                                cluster, index
                            ) in dynamicValidateForm.cluster"
                            :key="cluster.id"
                        >
                            <a-collapse v-model:activeKey="activeKey">
                                <a-collapse-panel
                                    :key="cluster.id"
                                    :header="
                                        cluster.clusterNodeId
                                            ? cluster.clusterNodeId
                                            : `#${index + 1}.配置信息`
                                    "
                                >
                                    <template #extra>
                                        <span
                                            @click="removeCluster(cluster)"
                                            class="delete-btn"
                                            >删除</span
                                        >
                                    </template>
                                    <a-row :gutter="[24, 24]">
                                        <a-col :span="8">
                                            <a-form-item
                                                label="节点名称"
                                                :name="[
                                                    'cluster',
                                                    index,
                                                    'clusterNodeId',
                                                ]"
                                                :rules="{
                                                    required: true,
                                                    message: '请选择节点名称',
                                                }"
                                            >
                                                <a-select
                                                    v-model:value="
                                                        cluster.clusterNodeId
                                                    "
                                                    placeholder="请选择节点名称"
                                                    allowClear
                                                    show-search
                                                    :filter-option="
                                                        filterOption
                                                    "
                                                >
                                                  <a-select-option v-for="i in getClusterNodeIds(cluster.clusterNodeId)" :value="i.value">
                                                      {{ i.label}}
                                                  </a-select-option>
                                                </a-select>
                                            </a-form-item>
                                        </a-col>
                                        <a-col :span="4">
                                            <a-form-item
                                                :name="[
                                                    'cluster',
                                                    index,
                                                    'host',
                                                ]"
                                                :rules="{
                                                    required: true,
                                                    message: '请选择SIP 地址',
                                                }"
                                            >
                                                <template #label>
                                                    SIP 地址
                                                    <a-tooltip
                                                        title="到服务器上的网卡地址,绑定到所有网卡:0.0.0.0"
                                                    >
                                                        <AIcon
                                                            type="QuestionCircleOutlined"
                                                            style="
                                                                margin-left: 2px;
                                                            "
                                                        />
                                                    </a-tooltip>
                                                </template>

                                                <a-select
                                                    v-model:value="cluster.host"
                                                    :options="sipListOption"
                                                    placeholder="请选择IP地址"
                                                    allowClear
                                                    show-search
                                                    :filter-option="
                                                        filterOption
                                                    "
                                                    style="width: 110%"
                                                    @change="
                                                        handleChangeForm2Sip(
                                                            index,
                                                        )
                                                    "
                                                >
                                                </a-select>
                                            </a-form-item>
                                        </a-col>
                                        <a-col :span="4">
                                            <a-form-item
                                                :name="[
                                                    'cluster',
                                                    index,
                                                    'port',
                                                ]"
                                                :rules="{
                                                    required: true,
                                                    message: '请选择端口',
                                                }"
                                            >
                                                <div class="form-label"></div>
                                                <a-select
                                                    v-model:value="cluster.port"
                                                    placeholder="请选择端口"
                                                    allowClear
                                                    show-search
                                                    :filter-option="
                                                        filterOption
                                                    "
                                                >
                                                  <a-select-option
                                                      v-for="i in getSipListOption(sipListIndex[index], cluster.port)"
                                                    :value="i.value"
                                                  >
                                                    {{ i.label }}
                                                  </a-select-option>
                                                </a-select>
                                            </a-form-item>
                                        </a-col>
                                        <a-col :span="4">
                                            <a-form-item
                                                :name="[
                                                    'cluster',
                                                    index,
                                                    'publicHost',
                                                ]"
                                                :validateFirst="true"
                                                :rules="[
                                                    {
                                                        required: true,
                                                        message:
                                                            '请输入公网 Host',
                                                    },
                                                    {
                                                        validator:validateUrl,
                                                        trigger: 'change',
                                                    },
                                                ]"
                                            >
                                                <template #label>
                                                    公网 Host
                                                    <a-tooltip
                                                        title="监听指定端口的请求"
                                                    >
                                                        <AIcon
                                                            type="QuestionCircleOutlined"
                                                            style="
                                                                margin-left: 2px;
                                                            "
                                                        />
                                                    </a-tooltip>
                                                </template>
                                                <a-input
                                                    style="width: 110%"
                                                    v-model:value="
                                                        cluster.publicHost
                                                    "
                                                    placeholder="请输入IP地址"
                                                    allowClear
                                                />
                                            </a-form-item>
                                        </a-col>
                                        <a-col :span="4">
                                            <a-form-item
                                                :name="[
                                                    'cluster',
                                                    index,
                                                    'publicPort',
                                                ]"
                                                :rules="[
                                                    {
                                                        required: true,
                                                        message: '请输入端口',
                                                    },
                                                ]"
                                            >
                                                <div class="form-label"></div>

                                                <a-input-number
                                                    style="width: 100%"
                                                    placeholder="请输入端口"
                                                    v-model:value="
                                                        cluster.publicPort
                                                    "
                                                    :min="1"
                                                    :max="65535"
                                                    :precision="0"
                                                />
                                            </a-form-item>
                                        </a-col>
                                    </a-row>
                                </a-collapse-panel>
                            </a-collapse>
                        </div>
                        <a-form-item>
                            <a-button
                                style="margin-top: 10px"
                                type="primary"
                                block
                                ghost
                                @click="addCluster"
                            >
                                <AIcon type="PlusOutlined" />
                                新增
                            </a-button>
                        </a-form-item>
                    </a-form>
                </div>
            </div>
            <div class="steps-box" v-else>
                <div
                    class="card-last"
                    :style="`max-height:${
                        clientHeight > 900 ? 750 : clientHeight * 0.7
                    }px`"
                >
                    <a-row :gutter="[24, 24]">
                        <a-col :span="12">
                            <title-component data="基本信息" />
                            <div>
                                <a-form :model="formData" layout="vertical">
                                    <a-form-item
                                        label="名称"
                                        v-bind="validateInfos.name"
                                    >
                                        <a-input
                                            v-model:value="formData.name"
                                            allowClear
                                            placeholder="请输入名称"
                                        />
                                    </a-form-item>

                                    <a-form-item
                                        label="说明"
                                        v-bind="validateInfos.description"
                                    >
                                        <a-textarea
                                            placeholder="请输入说明"
                                            :rows="4"
                                            v-model:value="formData.description"
                                            show-count
                                            :maxlength="200"
                                        />
                                    </a-form-item>
                                </a-form>
                            </div>
                        </a-col>
                        <a-col :span="12">
                          <div style="height: 400px">
                            <title-component data="配置概览" />
                            <a-descriptions :column="1" :labelStyle="{ width: '80px'}">
                              <a-descriptions-item label="接入方式">{{ provider.name }}</a-descriptions-item>
                              <a-descriptions-item>
                                <span style="color: #a3a3a3">{{ provider.description }}</span>
                              </a-descriptions-item>
                              <a-descriptions-item label="SIP 域">{{ formState.domain }}</a-descriptions-item>
                              <a-descriptions-item label="SIP ID">{{ formState.sipId }}</a-descriptions-item>
                              <a-descriptions-item>
                                <!--               共享配置                 -->
                                <template v-if="formState.shareCluster">
                                  <a-badge :text="`${formState.hostPort.publicHost}:${formState.hostPort.publicPort}`" status="processing" />
                                </template>
                                <template v-else>
                                  <a-badge v-for="i in dynamicValidateForm.cluster" :text="`${i.publicHost}:${i.publicPort}`" status="processing" />
                                </template>
                              </a-descriptions-item>
                            </a-descriptions>
                          </div>
                        </a-col>
                    </a-row>
                </div>
            </div>
        </div>
        <div class="steps-action">
            <a-button
                v-if="[0].includes(current)"
                style="margin-right: 8px"
                @click="next"
            >
                下一步
            </a-button>
            <j-permission-button
                v-if="current === 1 && view === 'false'"
                type="primary"
                style="margin-right: 8px"
                @click="saveData"
                :loading="loading"
                :hasPermission="`link/AccessConfig:${
                    id === ':id' ? 'add' : 'update'
                }`"
            >
                保存
            </j-permission-button>
            <a-button v-if="current > 0" @click="prev"> 上一步 </a-button>
        </div>
    </div>
</template>

<script lang="ts" setup name="AccessNetwork">
import { Form } from 'ant-design-vue';
import type { FormInstance } from 'ant-design-vue';
import { getResourcesCurrent, getClusters, update, save } from '../../../../../api/link/accessConfig';
import { onlyMessage } from '@jetlinks-web/utils';
import { isNumber } from 'lodash-es';
import type { Rule } from 'ant-design-vue/es/form';
import { testIpv4_6 } from '@/utils/validate';
interface Form2 {
    clusterNodeId: string | undefined;
    port: string | undefined;
    host: string | undefined;
    publicPort: string | undefined;
    publicHost: string | undefined;
    id: number;
}
interface FormState {
    domain: string | undefined;
    sipId: string | number | undefined;
    shareCluster: boolean;
    hostPort: {
        port: string | undefined;
        host: string | undefined;
        publicPort: string | undefined;
        publicHost: string | undefined;
    };
}

const props = defineProps({
    provider: {
        type: Object,
        default: () => {},
    },
    data: {
        type: Object,
        default: () => {},
    }
});

const route = useRoute();
const view = route.query.view as string;
const id = route.params.id as string;
const loading = ref(false);
const activeKey: any = ref([]);
const clientHeight = document.body.clientHeight;

const formRef1 = ref<FormInstance>();
const formRef2 = ref<FormInstance>();
const useForm = Form.useForm;

const current = ref(0);
const stepCurrent = ref(0);
const steps = ref(['信令配置', '完成']);
const formData = ref({
    name: '',
    description: '',
});
let formState = ref<FormState>({
    domain: undefined,
    sipId: undefined,
    shareCluster: true,
    hostPort: {
        port: undefined,
        host: '0.0.0.0',
        publicPort: undefined,
        publicHost: undefined,
    },
});

let params = {
    configuration: {},
};
let sipListConst: any = [];
const sipListOption = ref([]);
const sipList = ref([]);
const sipListIndex: any = ref([]);
const clustersList = ref([]);

const dynamicValidateForm = reactive<{ cluster: Form2[] }>({
    cluster: [],
});

const rules = {
  publicPort: [
    {
      required: true,
      message: '输入端口',
    }
  ]
}

const  validateUrl=async (_rule: Rule, value: string) => {
    if (!value) {
        return Promise.reject('请输入IP地址');
    } else {
        if (!testIpv4_6(value)) {
            return Promise.reject('请输入正确的IP地址');
        }
        return Promise.resolve();
    }
}
const removeCluster = (item: Form2) => {
    let index = dynamicValidateForm.cluster.indexOf(item);
    if (index !== -1) {
        dynamicValidateForm.cluster.splice(index, 1);
    }
};

const addCluster = () => {
    const id: any = Date.now();
    dynamicValidateForm.cluster.push({
        clusterNodeId: undefined,
        port: undefined,
        host: undefined,
        publicPort: undefined,
        publicHost: undefined,
        id,
    });
    activeKey.value = [...activeKey.value, id.toString()];
};

const filterOption = (input: string, option: any) => {
    return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

const handleChangeForm2Sip = (index: number) => {
    dynamicValidateForm.cluster[index].port = undefined;
    const value = dynamicValidateForm.cluster[index].host;
    sipListIndex.value[index] = sipListConst
        .find((i: any) => i.host === value)
        ?.portList.map((i: any) => {
            return {
                value: JSON.stringify({
                    host: value,
                    port: i.port,
                }),
                label: `${i.transports.join('/')} (${i.port})`,
            };
        });
};

const { resetFields, validate, validateInfos } = useForm(
    formData,
    reactive({
        name: [
            { required: true, message: '请输入名称', trigger: 'blur' },
            {
                max: 64,
                message: '最多可输入64个字符',
                trigger: 'blur',
            },
        ],
        description: [{ max: 200, message: '最多可输入200个字符' }],
    }),
);

const saveData = () => {
    validate().then(async (values) => {
        params = {
            ...params,
            ...values,
            provider: 'gb28181-2016',
            transport: 'SIP',
            channel: 'gb28181',
        };
        loading.value = true;
        const resp =
            id === ':id'
                ? await save(params).catch(() => {
                      loading.value = false;
                  })
                : await update({ ...params, id }).catch(() => {
                      loading.value = false;
                  });

        if (resp?.status === 200) {
            onlyMessage('操作成功', 'success');
            if (route.query.save) {
                // @ts-ignore
               if((window as any).onTabSaveSuccess){
                (window as any).onTabSaveSuccess(resp);
                setTimeout(() => window.close(), 300);
               }
            } else {
                history.back();
            }
        }
    });
};

const next = async () => {

    let data1: any = await formRef1.value?.validate();
    if (data1.hostPort?.port && !isNumber(data1.hostPort.port) && data1.shareCluster) {
        data1.hostPort.port = JSON.parse(data1.hostPort.port).port;
    }
    if (!data1?.shareCluster) {
        await formRef2.value
            ?.validate()
            .then((data2) => {
                if (data2 && data2?.cluster) {
                    data2.cluster.forEach((i: any) => {
                        i.enabled = true;
                        i.port = isNumber(i.port)
                            ? i.port
                            : JSON.parse(i.port).port;
                    });
                    data1 = {
                        ...data1,
                        ...data2,
                    };
                } else {
                    return onlyMessage('请新增或完善配置', 'error');
                }
                current.value = current.value + 1;
                params.configuration = data1;
            })
            .catch((err) => {
                err.errorFields?.forEach((item: any) => {
                    const activeId: any =
                        dynamicValidateForm.cluster[item.name[1]].id;
                    if (!activeKey.value.includes(activeId)) {
                        activeKey.value.push(activeId); // 校验未通过的展开
                    }
                });
            });
    } else {
        current.value = current.value + 1;
        params.configuration = data1;
    }
};
const prev = () => {
    current.value = current.value - 1;
    develop();
};

const develop = () => {
    if (dynamicValidateForm.cluster.length !== 0) {
        dynamicValidateForm.cluster.forEach((item) => {
            const id: any = JSON.stringify(Date.now() + Math.random());
            item.id = id;
            activeKey.value.push(id);
        });
    }
};

const getClusterNodeIds = (id?: string) => {
  const keys = dynamicValidateForm?.cluster?.map?.(item => item.clusterNodeId) || []
  return clustersList.value.filter(item => item.value === id || !keys.includes(item.value) )
}

const getSipListOption = (list: any[], id: string) => {
  const keys = dynamicValidateForm?.cluster?.map?.(item => item.port) || []
  return (list || []).filter(item => item.value === id || !keys.includes(item.value) )
}

onMounted(() => {
    getResourcesCurrent().then((resp) => {
        if (resp.status === 200) {
            sipListConst = resp.result;
            sipListOption.value = sipListConst.map((i: any) => ({
                value: i.host,
                label: i.host,
            }));

            sipList.value = sipListConst
                .find((i: any) => i.host === '0.0.0.0')
                ?.portList.map((i: any) => {
                    return {
                        value: JSON.stringify({
                            host: '0.0.0.0',
                            port: i.port,
                        }),
                        label: `${i.transports.join('/')} (${i.port})`,
                    };
                });
        }
    });

    getClusters().then((resp: any) => {
        if (resp.status === 200) {
            const list = resp.result.map((i: any) => ({
                value: i.id,
                label: i.name,
            }));
            clustersList.value = list;
        }
    });

    if (id !== ':id') {
        const { configuration, name, description = '' } = props.data;
        formData.value = { name, description };

        formState.value = {
            ...formState.value,
            ...props.data.configuration,
        };
        if (!configuration?.shareCluster) {
            dynamicValidateForm.cluster = configuration.cluster;
            develop();
        }
    }
});

watch(
    current,
    (v) => {
        stepCurrent.value = v;
    },
    {
        deep: true,
        immediate: true,
    },
);
</script>

<style lang="less" scoped>
.steps-content {
    margin: 20px;
}
.steps-box {
    min-height: 400px;
    .card-item {
        padding-right: 5px;
        max-height: 480px;
        overflow-y: auto;
        overflow-x: hidden;
    }
    .card-last {
        padding-right: 5px;
        overflow-y: auto;
        overflow-x: hidden;
    }
}
.steps-action {
    width: 100%;
    margin-top: 24px;
    margin-left: 20px;
}
.alert {
    height: 40px;
    padding-left: 10px;
    color: rgba(0, 0, 0, 0.55);
    line-height: 40px;
    background-color: #f6f6f6;
}
.search {
    display: flex;
    margin: 15px 0;
    justify-content: space-between;
}

.other {
    width: 100%;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    .item {
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
}

.form-item1 {
    background-color: #f6f6f6;
    padding: 10px;
}
.form-label {
    height: 30px;
    padding-bottom: 8px;
}
.delete-btn {
    display: inline-block;
    color: #e50012;
    padding: 0px 8px;
    background: #ffffff;
    border: 1px solid #e50012;
    border-radius: 2px;
}
</style>
