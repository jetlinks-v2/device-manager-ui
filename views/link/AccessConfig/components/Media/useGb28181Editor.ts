import type { ExtractPropTypes } from 'vue';
import { Form } from 'ant-design-vue';
import type { FormInstance } from 'ant-design-vue';
import { getResourcesCurrent, getClusters, update, save } from '../../../../../api/link/accessConfig';
import { allResources } from '../../../../../api/link/type';
import { onlyMessage } from '@jetlinks-web/utils';
import { isNumber } from 'lodash-es';
import type { Rule } from 'ant-design-vue/es/form';
import { testIpv4_6 } from '@jetlinks-web-core/utils/validate';
import { useI18n } from 'vue-i18n';
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks';
export const editorProps = {
    provider: {
        type: Object,
        default: () => { }
    },
    data: {
        type: Object,
        default: () => { }
    }
};
/** 保留原配置步骤、校验和保存链路；由界面在 setup 内调用，生命周期归属不变。 */
export function useGb28181Editor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const { t: $t } = useI18n();
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
    const steps = ref([$t('Media.GB28181.666483-36'), $t('Media.GB28181.666483-37')]);
    const formData = ref({
        name: '',
        bizKey: '',
        description: '',
        i18nMessages: {},
    });
    let formState = ref<FormState>({
        domain: undefined,
        sipId: undefined,
        shareCluster: true,
        hostPort: {
            port: undefined,
            host: '0.0.0.0',
            publicPort: undefined,
            publicHost: undefined
        }
    });
    let params = {
        configuration: {}
    };
    let sipListConst: any = [];
    const sipListOption = ref([]);
    const sipList = ref([]);
    const sipListIndex: any = ref([]);
    const clustersList = ref([]);
    // 所有的网关节点
    const sipMap = new Map();
    const dynamicValidateForm = reactive<{
        cluster: Form2[];
    }>({
        cluster: []
    });
    const { onBack } = useTabSaveSuccessBack();
    const rules = {
        publicPort: [
            {
                required: true,
                message: $t('Media.GB28181.666483-38')
            }
        ]
    };
    const validateUrl = async (_rule: Rule, value: string) => {
        if (!value) {
            return Promise.reject($t('Media.GB28181.666483-14'));
        }
        else {
            if (!testIpv4_6(value)) {
                return Promise.reject($t('Media.GB28181.666483-39'));
            }
            return Promise.resolve();
        }
    };
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
            id
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
                    port: i.port
                }),
                label: `${i.transports.join('/')} (${i.port})`
            };
        });
    };
    const { resetFields, validate, validateInfos } = useForm(formData, reactive({
        name: [
            { required: true, message: $t('Media.GB28181.666483-28'), trigger: 'blur' },
            {
                max: 64,
                message: $t('Media.GB28181.666483-3'),
                trigger: 'blur'
            }
        ],
        description: [{ max: 200, message: $t('Media.GB28181.666483-40') }]
    }));
    const saveData = () => {
        validate().then(async (values) => {
            params = {
                ...params,
                ...values,
                provider: 'gb28181-2016',
                transport: 'SIP',
                channel: 'gb28181'
            };
            loading.value = true;
            const resp = id === ':id'
                ? await save(params).catch(() => {
                    loading.value = false;
                })
                : await update({ ...params, id }).catch(() => {
                    loading.value = false;
                });
            if (resp?.status === 200) {
                onlyMessage($t('Media.GB28181.666483-41'), 'success');
                if (route.query.save) {
                    // @ts-ignore
                    onBack(rsp);
                }
                else {
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
                        i.port = isNumber(i.port) ? i.port : JSON.parse(i.port).port;
                    });
                    data1 = {
                        ...data1,
                        ...data2
                    };
                }
                else {
                    return onlyMessage($t('Media.GB28181.666483-42'), 'error');
                }
                current.value = current.value + 1;
                params.configuration = data1;
            })
                .catch((err) => {
                err.errorFields?.forEach((item: any) => {
                    const activeId: any = dynamicValidateForm.cluster[item.name[1]].id;
                    if (!activeKey.value.includes(activeId)) {
                        activeKey.value.push(activeId); // 校验未通过的展开
                    }
                });
            });
        }
        else {
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
        const keys = dynamicValidateForm?.cluster?.map?.((item) => item.clusterNodeId) || [];
        return clustersList.value.filter((item) => item.value === id || !keys.includes(item.value));
    };
    const getSipListOption = (list: any[], id: string) => {
        const keys = dynamicValidateForm?.cluster?.map?.((item) => item.port) || [];
        return (list || []).filter((item) => item.value === id || !keys.includes(item.value));
    };
    const handleIntersection = (arr: any[]) => {
        let intersection = [];
        if (arr && arr.length > 0) {
            // 获取第一个节点的portList作为基准
            intersection = arr[0].portList || [];
            for (let i = 1; i < arr.length; i++) {
                const currentPortList = arr[i].portList || [];
                intersection = intersection.filter((port1) => currentPortList.some((port2) => port1.port === port2.port &&
                    JSON.stringify(port1.transports.sort()) === JSON.stringify(port2.transports.sort())));
            }
        }
        return intersection;
    };
    const getResources = async () => {
        const resp = await allResources();
        if (resp.status === 200) {
            const arr = resp.result?.filter((i: any) => i.host === '0.0.0.0');
            sipList.value = handleIntersection(arr).map((i: any) => {
                return {
                    value: JSON.stringify({
                        host: '0.0.0.0',
                        port: i.port
                    }),
                    label: `${i.transports.join('/')} (${i.port})`
                };
            });
            arr.forEach((i: any) => {
                const id = i.clusterNodeId;
                const obj = {
                    sipListOption: [
                        {
                            value: i.host,
                            label: i.host
                        }
                    ],
                    sipListIndex: i.portList.map((i: any) => ({
                        value: JSON.stringify({
                            host: i.host,
                            port: i.port
                        }),
                        label: `${i.transports.join('/')} (${i.port})`
                    }))
                };
                sipMap.set(id, obj);
            });
            console.log('sipMap====', sipMap);
        }
    };
    onMounted(async () => {
        // getResourcesCurrent().then((resp) => {
        //   if (resp.status === 200) {
        //     sipListConst = resp.result
        //     sipListOption.value = sipListConst.map((i: any) => ({
        //       value: i.host,
        //       label: i.host
        //     }))
        //     sipList.value = sipListConst
        //       .find((i: any) => i.host === '0.0.0.0')
        //       ?.portList.map((i: any) => {
        //         return {
        //           value: JSON.stringify({
        //             host: '0.0.0.0',
        //             port: i.port
        //           }),
        //           label: `${i.transports.join('/')} (${i.port})`
        //         }
        //       })
        //     dynamicValidateForm.cluster.forEach((cluster, index) => {
        //       if (cluster.host) {
        //         const value = cluster.host
        //         sipListIndex.value[index] = sipListConst
        //           .find((i: any) => i.host === value)
        //           ?.portList.map((i: any) => {
        //             return {
        //               value: JSON.stringify({
        //                 host: value,
        //                 port: i.port
        //               }),
        //               label: `${i.transports.join('/')} (${i.port})`
        //             }
        //           })
        //       }
        //     })
        //   }
        // })
        // 先获取资源数据，确保sipMap被正确填充
        await getResources();
        // 并行获取集群数据
        getClusters().then((resp: any) => {
            if (resp.status === 200) {
                const list = resp.result.map((i: any) => ({
                    value: i.id,
                    label: i.name
                }));
                clustersList.value = list;
            }
        });
        // 在sipMap数据准备好后，再恢复表单数据
        if (id !== ':id') {
            const { configuration, name, description = '' } = props.data;
            formData.value = { name, bizKey: props.data.bizKey || '', description };
            formState.value = {
                ...formState.value,
                ...props.data.configuration
            };
            if (!configuration?.shareCluster) {
                dynamicValidateForm.cluster = configuration.cluster;
                develop();
            }
        }
    });
    watch(current, (v) => {
        stepCurrent.value = v;
    }, {
        deep: true,
        immediate: true
    });
    return {
      update, $t, route, view, id, loading, activeKey, clientHeight, formRef1, formRef2, useForm, current,
      stepCurrent, steps, formData, formState, params, sipListConst, sipListOption, sipList, sipListIndex,
      clustersList, sipMap, dynamicValidateForm, onBack, rules, validateUrl, removeCluster, addCluster,
      filterOption, handleChangeForm2Sip, resetFields, validate, validateInfos, saveData, next, prev,
      develop, getClusterNodeIds, getSipListOption, handleIntersection, getResources, props
    };
}
