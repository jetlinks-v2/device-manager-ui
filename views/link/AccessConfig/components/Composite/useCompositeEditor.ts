import type { GatewayChildDraft } from '../gatewayEditorContext';
import type { ExtractPropTypes } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import type { PropType } from 'vue';
import { save, update, getCompositeProviderDetail } from '@device-manager-ui/api/link/accessConfig';
import { device } from '@device-manager-ui/assets';
import { onlyMessage } from '@jetlinks-web/utils';
import { randomString } from '@jetlinks-web/utils';
import { omit } from 'lodash-es';
import { useRequest } from '@jetlinks-web/hooks';
import { BackMap } from '../../data';
import { useI18n } from 'vue-i18n';
import { useTabSaveSuccess } from '@jetlinks-web-core/hooks';
export const editorProps = {
    otherProvider: {
        type: Array as PropType<GatewayChildDraft['provider'][]>,
        default: () => ([])
    },
    data: {
        type: Object as PropType<Record<string, any>>,
        default: () => ({})
    }
};
/** 保留原配置步骤、校验和保存链路；由界面在 setup 内调用，生命周期归属不变。 */
export function useCompositeEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const { t: $t } = useI18n();
    const choosenProviderList = ref<Record<string, any>[]>([]);
    const searchValue = ref();
    const filterProviderList = computed(() => {
        return choosenProviderList.value?.filter((item: Record<string, any>) => {
            if (searchValue.value) {
                return item.name.includes(searchValue.value);
            }
            return true;
        });
    });
    const route = useRoute();
    const id = route.params.id as string;
    const stepCurrent = ref(0);
    const providerListVisible = ref(false);
    const generateId = randomString(10);
    const current = ref();
    const outlineVisible = ref(false);
    const formRef = ref();
    const formData = reactive({
        id: route.params.id !== ':id' ? route.params.id : generateId,
        name: '',
        bizKey: '',
        description: '',
        i18nMessages: {},
    });
    const childDraft = ref<GatewayChildDraft>();
    // 子项可能尚无实体 ID，是否允许重选由操作入口决定，模式不混入保存数据。
    const openChild = (provider: GatewayChildDraft['provider'], data: Record<string, unknown> = {}, mode: GatewayChildDraft['mode'] = 'create') => {
        providerListVisible.value = false;
        childDraft.value = { provider, data, mode };
    };
    const cancelChild = () => { childDraft.value = undefined; };
    const reselectChild = () => { cancelChild(); providerListVisible.value = true; };
    const saveChild = (data: Record<string, unknown>) => {
        const editing = choosenProviderList.value.some(item => item.id === data.id);
        if (editing) choosenProviderList.value = choosenProviderList.value.map(item => item.id === data.id ? data : item);
        else handleAddProvider(data);
        cancelChild();
    };
    const { loading, run: saveRun } = useRequest(id === ':id' ? save : update, {
        immediate: false,
        onSuccess: () => {
            onlyMessage($t('Edge.geteway.598238-14'));
            history.back();
        }
    });
    const getDescription = (slotProps: Record<string, any>) => slotProps.description
        ? slotProps.description
        : props.otherProvider?.find((item: Record<string, any>) => item.id === slotProps.provider)?.description;
    const getStatus = (slotProps: Record<string, any>) => slotProps.channelInfo.addresses[0].health === -1 ? 'error' : 'processing';
    const clientHeight = document.body.clientHeight;
    const getActions = (item: any) => {
        return [
            {
                key: 'update',
                text: $t('Composite.index.636069-12'),
                tooltip: {
                    title: $t('Composite.index.636069-12')
                },
                icon: 'EditOutlined',
                onClick: () => {
                    const providerInfo = props.otherProvider?.find((va: Record<string, any>) => va.id === item.provider);
                    if (providerInfo) openChild(providerInfo as GatewayChildDraft['provider'], omit(item, ['channelInfo', 'protocolDetail', 'transportDetail']), 'edit');
                }
            },
            {
                key: 'delete',
                text: $t('Composite.index.636069-13'),
                tooltip: {
                    title: $t('Composite.index.636069-13')
                },
                icon: 'DeleteOutlined',
                popConfirm: {
                    title: $t('Composite.index.636069-14'),
                    onConfirm: () => {
                        choosenProviderList.value = choosenProviderList.value.filter((val: Record<string, any>) => val.id !== item.id);
                        // console.log(item)
                    }
                }
            }
        ];
    };
    const handleAccessItemDetail = (item: any) => {
        current.value = item;
        outlineVisible.value = true;
    };
    const handleNext = () => {
        if (!choosenProviderList.value?.length) {
            onlyMessage($t('Composite.index.636069-15'), 'warning');
            return;
        }
        stepCurrent.value = 1;
    };
    const handleBack = () => {
        stepCurrent.value = 0;
    };
    const handleSearch = (value: string) => {
        searchValue.value = value;
    };
    /**
     * 新增设备接入网关
     */
    const handleAdd = () => {
        if (choosenProviderList.value?.length >= 10) {
            onlyMessage($t('Composite.index.636069-16'), 'warning');
            return;
        }
        providerListVisible.value = true;
    };
    /**
     * 保存
     */
    const handleSave = async () => {
        const valid = await formRef.value.validate();
        if (valid) {
            const params = {
                ...formData,
                provider: 'composite-device-gateway',
                channel: 'composite-device-gateway',
                channelId: formData.id,
                protocol: formData.id,
                transport: 'composite',
                configuration: {
                    gateways: choosenProviderList.value.map(item => {
                        return omit(item, ['channelInfo', 'protocolDetail', 'transportDetail']);
                    })
                }
            };
            saveRun(params);
        }
    };
    const closeDrawer = () => {
        providerListVisible.value = false;
    };
    const handleAddProvider = (data: any) => {
        choosenProviderList.value?.unshift({
            id: data.id || randomString(8),
            ...data
        });
        providerListVisible.value = false;
    };
    //获取已选择的接入网关的详情
    const getProviderDetail = async (data: any[]) => {
        const res = await getCompositeProviderDetail(data);
        if (res.success) {
            choosenProviderList.value = res.result;
        }
    };
    watch(() => JSON.stringify(props.data), (val) => {
        if (val) {
            formData.name = props.data.name;
            formData.bizKey = props.data.bizKey || '';
            formData.description = props.data.description;
            if (props.data.configuration?.gateways?.length) {
                getProviderDetail(props.data.configuration?.gateways);
            }
            else {
                choosenProviderList.value = [];
            }
        }
    }, { immediate: true });
    const [DefineEmptyCreate, EmptyCreateButton] = createReusableTemplate();
    return {
      save, update, device, BackMap, $t, choosenProviderList, searchValue, filterProviderList, route, id,
      stepCurrent, providerListVisible, generateId, current, outlineVisible, formRef, formData, childDraft, openChild, cancelChild, reselectChild, saveChild,
      loading, saveRun, getDescription, getStatus, clientHeight, getActions, handleAccessItemDetail,
      handleNext, handleBack, handleSearch, handleAdd, handleSave, closeDrawer, handleAddProvider,
      getProviderDetail, DefineEmptyCreate, EmptyCreateButton, props
    };
}
