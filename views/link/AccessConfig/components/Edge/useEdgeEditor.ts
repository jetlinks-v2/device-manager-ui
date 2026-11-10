import type { ExtractPropTypes } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import { onlyMessage } from '@jetlinks-web/utils';
import type { FormInstance } from 'ant-design-vue';
import { update, save, getNetworkList } from '../../../../../api/link/accessConfig';
import { descriptionList, ProtocolMapping, NetworkTypeMapping } from '../../data';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { useI18n } from 'vue-i18n';
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
};
/** 保留原配置步骤、校验和保存链路；由界面在 setup 内调用，生命周期归属不变。 */
export function useEdgeEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const emptyCreateSearch = emptyCreateSearchRef(false);
    const { t: $t } = useI18n();
    const menuStory = useMenuStore();
    interface FormState {
        name: string;
        bizKey: string;
        description: string;
        i18nMessages?: Record<string, Record<string, string>>;
    }
    const route = useRoute();
    const view = route.query.view as string;
    const id = route.params.id as string;
    const loading = ref(false);
    const type = ref(props.provider.type || props.data.type);
    const channel = ref(props.provider.channel);
    const formState = ref<FormState>({
        name: '',
        bizKey: '',
        description: '',
        i18nMessages: {},
    });
    const formRef = ref<FormInstance>();
    const current = ref(0);
    const stepCurrent = ref(0);
    const steps = ref([$t('Edge.index.066653-18'), $t('Edge.index.066653-19')]);
    const networkCurrent: any = ref('');
    const networkList: any = ref([]);
    const allNetworkList: any = ref([]);
    const { onBack } = useTabSaveSuccessBack();
    const { onOpen } = useTabSaveSuccess('link/Type/Detail', {
        onSuccess(value) {
            networkCurrent.value = value.result.id;
            queryNetworkList(props.provider?.id, networkCurrent.value || '');
        }
    });
    const onFinish = async (values: any) => {
        loading.value = true;
        const providerId = props.provider.id;
        const params = {
            ...values,
            protocol: 'official-edge-protocol',
            provider: providerId,
            transport: ProtocolMapping.get(providerId),
        };
        if (networkCurrent.value)
            params.channelId = networkCurrent.value;
        const resp = id === ':id' ? await save(params) : await update({ ...params, id });
        if (resp.status === 200) {
            onlyMessage($t('Edge.index.066653-20'), 'success');
            history.back();
            onBack(resp);
        }
        loading.value = false;
    };
    const checkedChange = (id: string) => {
        networkCurrent.value = id;
    };
    const getColor = (i: any) => (i.health === -1 ? 'error' : 'processing');
    const queryNetworkList = async (id: string, include: string, data = {}) => {
        const resp = await getNetworkList(NetworkTypeMapping.get(id), include, data);
        if (resp.status === 200) {
            networkList.value = resp.result;
            allNetworkList.value = resp.result;
            emptyCreateSearch.value = false;
        }
    };
    const networkSearch = (value: string) => {
        emptyCreateSearch.value = Boolean(value?.trim());
        networkList.value = value
            ? allNetworkList.value.filter((i: any) => i.name &&
                i.name
                    .toLocaleLowerCase()
                    .includes(value.toLocaleLowerCase()))
            : allNetworkList.value;
    };
    const saveData = async () => {
        const data: any = await formRef.value?.validate();
        onFinish(data);
    };
    const addNetwork = () => {
        onOpen({
            type: NetworkTypeMapping.get(props.provider?.id) || ''
        });
    };
    const next = async () => {
        if (!networkCurrent.value) {
            onlyMessage($t('Edge.index.066653-21'), 'error');
        }
        else {
            current.value = current.value + 1;
        }
    };
    const prev = () => {
        current.value = current.value - 1;
    };
    onMounted(() => {
        if (props.provider.id === 'official-edge-gateway') {
            queryNetworkList(props.provider.id, '');
        }
        if (id !== ':id') {
            formState.value = {
                name: props.data.name,
                bizKey: props.data.bizKey || '',
                description: props.data?.description || '',
            };
            networkCurrent.value = props.data.channelId;
        }
    });
    watch(current, (v) => {
        stepCurrent.value = v;
    }, {
        deep: true,
        immediate: true,
    });
    const addressesTip = (data: any) => {
        let tip: any = '';
        data.forEach((item: any) => {
            tip = tip + " " + item.address;
        });
        return tip;
    };
    const [DefineEmptyCreate, EmptyCreateButton] = createReusableTemplate();
    return {
      update, descriptionList, ProtocolMapping, emptyCreateSearch, $t, menuStory, route, view, id, loading,
      type, channel, formState, formRef, current, stepCurrent, steps, networkCurrent, networkList,
      allNetworkList, onBack, onOpen, onFinish, checkedChange, getColor, queryNetworkList, networkSearch,
      saveData, addNetwork, next, prev, addressesTip, DefineEmptyCreate, EmptyCreateButton, props
    };
}
