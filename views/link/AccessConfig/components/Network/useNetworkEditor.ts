import { useGatewaySaveBack } from '../useGatewaySaveBack';
import type { ExtractPropTypes } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import { getNetworkList, getProtocolList, getConfigView, save, update, getChildConfigView, getNetworkComponentList } from "../../../../../api/link/accessConfig";
import { descriptionList, NetworkTypeMapping, ProtocolMapping, ColumnsMQTT, ColumnsHTTP } from "../../data";
import { Form } from "ant-design-vue";
import type { FormInstance, TableColumnType } from "ant-design-vue";
import { useMenuStore } from "@jetlinks-web-core/store/menu";
import { onlyMessage } from "@jetlinks-web/utils";
import { useI18n } from "vue-i18n";
import { useTabSaveSuccess, useTabSaveSuccessBack } from '@jetlinks-web-core/hooks';
import { ref as emptyCreateSearchRef } from 'vue';
export const editorProps = {
    provider: {
        type: Object,
        default: () => { },
    },
    data: {
        type: Object,
        default: () => { },
    },
    bindProduct: {
        type: Boolean,
        default: false,
    },
};
/** 保留原配置步骤、校验和保存链路；由界面在 setup 内调用，生命周期归属不变。 */
export function useNetworkEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const emptyNetworkSearch = emptyCreateSearchRef(false);
    const emptyProtocolSearch = emptyCreateSearchRef(false);
    const { t: $t } = useI18n();
    const menuStory = useMenuStore();
    function generateUUID() {
        let d = new Date().getTime();
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            let r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
    }
    const clientHeight = document.body.clientHeight;
    const type = props.provider.channel;
    const route = useRoute();
    const view = route.query.view as string;
    const id = route.params.id as string;
    const formRef = ref<FormInstance>();
    const useForm = Form.useForm;
    const isAgent = ["agent-device-gateway", "agent-media-device-gateway"].includes(props.provider.id);
    const current = ref(0);
    const stepCurrent = ref(0);
    // const steps = computed(() => {
    //     return !isAgent ? [$t('Network.index.041705-13'), $t('Network.index.041705-14'), $t('Network.index.041705-19')] : [$t('Network.index.041705-13'), $t('Network.index.041705-19')];
    // });
    const steps = ref();
    const networkList: any = ref([]);
    const allNetworkList: any = ref([]);
    const procotolList: any = ref([]);
    const allProcotolList = ref([]);
    const networkCurrent: any = ref("");
    const procotolCurrent: any = ref("");
    const config: any = ref({});
    const columnsMQTT = ref(<TableColumnType>[]);
    const columnsHTTP = ref(<TableColumnType>[]);
    const formData = ref({
        name: "",
        description: "",
        bizKey: "",
        i18nMessages: {},
    });
    const loading = ref(false);
    const { onOpen: onTypeOpen } = useTabSaveSuccess('link/Type/Detail', {
        onSuccess(value) {
            if (value.success) {
                networkCurrent.value = value.result.id;
                queryNetworkList(props.provider?.id, networkCurrent.value || "");
            }
        }
    });
    const { onOpen: onProtocolOpen } = useTabSaveSuccess('link/Protocol', {
        onSuccess(value) {
            if (value.success) {
                procotolCurrent.value = value.result?.id;
                queryProcotolList(props.provider?.id);
            }
        }
    });
    const { resetFields, validate, validateInfos } = useForm(formData, reactive({
        name: [
            {
                required: true,
                message: $t("Network.index.041705-9"),
                trigger: "blur",
            },
            {
                max: 64,
                message: $t("Network.index.041705-20"),
                trigger: "blur",
            },
        ],
        description: [{ max: 200, message: $t("Network.index.041705-21") }],
    }));
    const { onBack } = useGatewaySaveBack();
    const showAddBtn = computed(() => {
        return route.query.view === "false" && !props.bindProduct;
    });
    const queryNetworkList = async (id: string, include: string, data = {}) => {
        const resp = NetworkTypeMapping.get(id) instanceof Array ? await getNetworkComponentList({
            networkTypes: NetworkTypeMapping.get(id),
        }, include) : await getNetworkList(NetworkTypeMapping.get(id), include, data);
        if (resp.status === 200) {
            networkList.value = resp.result;
            allNetworkList.value = resp.result;
            emptyNetworkSearch.value = false;
        }
    };
    const queryProcotolList = async (id: string, params = {}) => {
        const resp: any = await getProtocolList(ProtocolMapping.get(id), {
            ...params,
            "sorts[0].name": "createTime",
            "sorts[0].order": "desc",
        });
        if (resp.status === 200) {
            procotolList.value = resp.result;
            allProcotolList.value = resp.result;
            emptyProtocolSearch.value = false;
        }
    };
    const addNetwork = () => {
        onTypeOpen({
            type: NetworkTypeMapping.get(props.provider?.id) || "",
        });
    };
    const addProcotol = () => {
        onProtocolOpen({
            save: true
        });
    };
    const getNetworkCurrent = computed(() => {
        return ((networkList.value.find((i: any) => i.id === networkCurrent.value) &&
            networkList.value.find((i: any) => i.id === networkCurrent.value)
                ?.addresses) ||
            []);
    });
    const getColor = (i: any) => (i.health === -1 ? "error" : "processing");
    const getStream = (record: any) => {
        let stream = "";
        if (record.upstream && record.downstream)
            stream = $t("Network.index.041705-22");
        else if (record.upstream)
            stream = $t("Network.index.041705-23");
        else if (record.downstream)
            stream = $t("Network.index.041705-24");
        return stream;
    };
    const checkedChange = (id: string) => {
        networkCurrent.value = id;
    };
    const networkSearch = (value: string) => {
        emptyNetworkSearch.value = Boolean(value?.trim());
        networkList.value = value
            ? allNetworkList.value.filter((i: any) => i.name &&
                i.name.toLocaleLowerCase().includes(value.toLocaleLowerCase()))
            : allNetworkList.value;
    };
    const procotolChange = (id: string) => {
        if (!props.data.id) {
            procotolCurrent.value = id;
        }
    };
    const procotolSearch = (value: string) => {
        emptyProtocolSearch.value = Boolean(value?.trim());
        procotolList.value = value
            ? allProcotolList.value.filter((i: any) => i.name &&
                i.name.toLocaleLowerCase().includes(value.toLocaleLowerCase()))
            : allProcotolList.value;
    };
    const transport = computed(() => {
        if (props.provider?.id === "child-device") {
            return "Gateway";
        }
        if (['agent-device-gateway', 'agent-media-device-gateway'].includes(props.provider?.id)) {
            const network = allNetworkList.value.find((i: any) => i.id === networkCurrent.value);
            if (network?.type === 'HTTP_SERVER') {
                return 'HTTP';
            }
            else if (network?.type === 'MQTT_SERVER') {
                return 'MQTT';
            }
        }
        return ProtocolMapping.get(props.provider.id);
    });
    const saveData = () => {
        validate()
            .then(async (values) => {
            const params = {
                ...props.data,
                ...values,
                bizKey: formData.value.bizKey,
                protocol: procotolCurrent.value,
                channel: "network", // 网络组件
                channelId: networkCurrent.value,
                provider: props.provider.id,
                transport: transport.value,
            };
            if (route.query.provider) {
                // 复合网关是业务绑定的唯一实体，子网关配置不能携带业务标识。
                delete params.bizKey;
                onBack({
                    ...params,
                    channelInfo: networkList.value.find((i: any) => i.id === networkCurrent.value),
                    protocolDetail: procotolList.value.find((i: any) => i.id === procotolCurrent.value),
                });
                return;
            }
            loading.value = true;
            const resp = id === ":id" ? await save(params) : await update({ ...params, id });
            loading.value = false;
            if (resp.status === 200) {
                onlyMessage($t("Network.index.041705-25"), "success");
                history.back();
                onBack(resp);
            }
        })
            .catch((err) => { });
    };
    const loadProtocolConfig = async () => {
        const selected = procotolCurrent.value;
                const resp = type !== "child-device"
                    ? await getConfigView(selected, ProtocolMapping.get(props.provider.id))
                    : await getChildConfigView(selected);
                if (resp.status === 200 && selected === procotolCurrent.value) {
                    config.value = resp.result || {};
                    const Group = {
                        title: $t("Network.index.041705-28"),
                        dataIndex: "group",
                        key: "group",
                        ellipsis: true,
                        align: "center",
                        width: 100,
                        customCell: (record: any, rowIndex: number) => {
                            const obj = {
                                children: record,
                                rowSpan: 0,
                            };
                            const list = config.value?.routes || [];
                            const arr = list.filter((res: any) => res.group === record.group);
                            const isRowIndex = rowIndex === 0 || list[rowIndex - 1].group !== record.group;
                            isRowIndex && (obj.rowSpan = arr.length);
                            return obj;
                        },
                    };
                    columnsMQTT.value = [Group, ...ColumnsMQTT] as TableColumnType;
                    columnsHTTP.value = [Group, ...ColumnsHTTP] as TableColumnType;
                    return true;
                }
                return false;
    };
    const next = async () => {
        if (current.value === 0) {
            if (!networkCurrent.value) {
                onlyMessage($t("Network.index.041705-26"), "error");
            }
            else if (isAgent) {
                current.value = 2;
                procotolCurrent.value = props.provider.id;
            }
            else {
                queryProcotolList(props.provider.id);
                current.value = current.value + 1;
            }
        }
        else if (current.value === 1) {
            if (!procotolCurrent.value) {
                onlyMessage($t("Network.index.041705-27"), "error");
            }
            else {
                if (await loadProtocolConfig()) current.value += 1;
            }
        }
    };
    const prev = () => {
        if (isAgent) {
            current.value = 0;
        }
        else {
            current.value = current.value - 1;
        }
    };
    onMounted(() => {
        if (props.data && props.data.id) {
            if (["agent-device-gateway", "agent-media-device-gateway"].includes(props.data.provider)) {
                steps.value = [
                    $t("Network.index.041705-13"),
                    $t("Network.index.041705-19"),
                ];
                current.value = 0;
                networkCurrent.value = props.data.channelId;
                queryNetworkList(props.provider.id, networkCurrent.value);
            }
            else if (props.data.provider !== "child-device") {
                procotolCurrent.value = props.data.protocol;
                current.value = 0;
                networkCurrent.value = props.data.channelId;
                queryNetworkList(props.provider.id, networkCurrent.value);
                procotolCurrent.value = props.data.protocol;
                steps.value = [
                    $t("Network.index.041705-13"),
                    $t("Network.index.041705-14"),
                    $t("Network.index.041705-19"),
                ];
            }
            else {
                steps.value = [
                    $t("Network.index.041705-14"),
                    $t("Network.index.041705-19"),
                ];
                current.value = 1;
                queryProcotolList(props.provider.id);
            }
        }
        else {
            if (props.provider?.id) {
                if (
                // console.log('props.provider====',props.provider)
                ["agent-device-gateway", "agent-media-device-gateway"].includes(props.provider.id)) {
                    queryNetworkList(props.provider.id, "");
                    steps.value = [
                        $t("Network.index.041705-13"),
                        $t("Network.index.041705-19"),
                    ];
                    current.value = 0;
                }
                else if (type !== "child-device") {
                    queryNetworkList(props.provider.id, "");
                    steps.value = [
                        $t("Network.index.041705-13"),
                        $t("Network.index.041705-14"),
                        $t("Network.index.041705-19"),
                    ];
                    current.value = 0;
                }
                else {
                    steps.value = [
                        $t("Network.index.041705-14"),
                        $t("Network.index.041705-19"),
                    ];
                    current.value = 1;
                    queryProcotolList(props.provider.id);
                }
            }
        }
    });
    onMounted(() => {
        if (id !== ":id") {
            procotolCurrent.value = props.data.protocol;
            formData.value = {
                name: props.data.name,
                description: props.data.description,
                bizKey: props.data.bizKey || '',
            };
        }
    });
    watch(current, (v) => {
        stepCurrent.value = type === "child-device" ? v - 1 : v;
    }, {
        deep: true,
        immediate: true,
    });
    const addressesTip = (data: any) => {
        let tip: any = "";
        data.forEach((item: any) => {
            tip = tip + " " + item.address;
        });
        return tip;
    };
    const [DefineEmptyCreate1, EmptyCreateButton1] = createReusableTemplate();
    const [DefineEmptyCreate2, EmptyCreateButton2] = createReusableTemplate();
    return {
      update, descriptionList, emptyNetworkSearch, emptyProtocolSearch, $t, menuStory, generateUUID,
      clientHeight, type, route, view, id, formRef, useForm, isAgent, current, stepCurrent, steps,
      networkList, allNetworkList, procotolList, allProcotolList, networkCurrent, procotolCurrent, config,
      columnsMQTT, columnsHTTP, formData, loading, onTypeOpen, onProtocolOpen, resetFields, validate,
      validateInfos, onBack, showAddBtn, queryNetworkList, queryProcotolList, addNetwork, addProcotol,
      getNetworkCurrent, getColor, getStream, checkedChange, networkSearch, procotolChange, procotolSearch,
      transport, saveData, next, prev, loadProtocolConfig, addressesTip, DefineEmptyCreate1, EmptyCreateButton1,
      DefineEmptyCreate2, EmptyCreateButton2, props
    };
}
