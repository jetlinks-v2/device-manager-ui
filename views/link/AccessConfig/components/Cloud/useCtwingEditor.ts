import type { ExtractPropTypes } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import type { FormInstance } from 'ant-design-vue';
import { update, save, getProtocolList } from '../../../../../api/link/accessConfig';
import { ProtocolMapping } from '../../data';
import { randomString, onlyMessage } from '@jetlinks-web/utils';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { network } from '../../../../../assets';
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
    bindProduct: {
        type: Boolean,
        default: false
    }
};
/** 保留原配置步骤、校验和保存链路；由界面在 setup 内调用，生命周期归属不变。 */
export function useCtwingEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const emptyCreateSearch = emptyCreateSearchRef(false);
    const { t: $t } = useI18n();
    const menuStory = useMenuStore();
    const origin = window.location.origin;
    const img1 = network.network1;
    const img2 = network.network2;
    const img3 = network.network3;
    const img4 = network.network4;
    const img5 = network.network5C;
    const img6 = network.network6C;
    interface FormState {
        apiAddress: string;
        appKey: string;
        appSecret: string;
        description: string;
    }
    interface Form {
        name: string;
        bizKey: string;
        description: string;
        i18nMessages?: Record<string, Record<string, string>>;
    }
    const route = useRoute();
    const view = route.query.view as string;
    const id = route.params.id as string;
    const loading = ref(false);
    const formRef1 = ref<FormInstance>();
    const formRef2 = ref<FormInstance>();
    const formState = ref<FormState>({
        apiAddress: 'https://ag-api.ctwing.cn/',
        appKey: '',
        appSecret: '',
        description: '',
    });
    const formData = ref<Form>({
        name: '',
        bizKey: '',
        description: '',
        i18nMessages: {},
    });
    const showAddBtn = computed(() => {
        return route.query.view === 'false' && !props.bindProduct;
    });
    const current = ref(0);
    const stepCurrent = ref(0);
    const steps = ref([$t('Cloud.Ctwing.076179-41'), $t('Cloud.Ctwing.076179-42'), $t('Cloud.Ctwing.076179-43')]);
    const protocolList: any = ref([]);
    const allProtocolList = ref([]);
    const protocolCurrent: any = ref('');
    const { onOpen } = useTabSaveSuccess('link/Protocol', {
        onSuccess(value) {
            protocolCurrent.value = value.result?.id;
            queryProtocolList(props.provider?.id);
        }
    });
    const { onBack } = useTabSaveSuccessBack();
    const protocolChange = (id: string) => {
        protocolCurrent.value = id;
    };
    const protocolSearch = (value: string) => {
        emptyCreateSearch.value = Boolean(value?.trim());
        protocolList.value = value
            ? allProtocolList.value.filter((i: any) => i.name &&
                i.name
                    .toLocaleLowerCase()
                    .includes(value.toLocaleLowerCase()))
            : allProtocolList.value;
    };
    const saveData = async () => {
        const data: any = await formRef2.value?.validate();
        loading.value = true;
        const params = {
            ...data,
            configuration: {
                ...formState.value,
                protocol: protocolCurrent.value,
            },
            protocol: protocolCurrent.value,
            provider: props.provider.id,
            transport: 'HTTP',
        };
        const resp = id === ':id'
            ? await save(params)
            : await update({
                ...props.data,
                ...params,
                id,
            });
        if (resp.status === 200) {
            onlyMessage($t('Cloud.Ctwing.076179-44'), 'success');
            history.back();
            onBack(resp);
        }
        loading.value = false;
    };
    const queryProtocolList = async (id: string, params = {}) => {
        const resp: any = await getProtocolList(ProtocolMapping.get(id), {
            ...params,
            'sorts[0].name': 'createTime',
            'sorts[0].order': 'desc',
            paging: false,
        });
        if (resp.status === 200) {
            protocolList.value = resp.result;
            allProtocolList.value = resp.result;
            emptyCreateSearch.value = false;
        }
    };
    const addProtocol = () => {
        onOpen({
            save: true
        });
    };
    const next = async () => {
        if (current.value === 0) {
            await formRef1.value?.validate();
            queryProtocolList(props.provider.id);
            current.value = current.value + 1;
        }
        else if (current.value === 1) {
            if (!protocolCurrent.value) {
                onlyMessage($t('Cloud.Ctwing.076179-45'), 'error');
            }
            else {
                current.value = current.value + 1;
            }
        }
    };
    const prev = () => {
        current.value = current.value - 1;
    };
    onMounted(() => {
        if (id !== ':id') {
            formState.value = props.data.configuration;
            protocolCurrent.value = props.data.protocol;
            formData.value = {
                name: props.data.name,
                bizKey: props.data.bizKey || '',
                description: props.data.description,
            };
        }
    });
    watch(current, (v) => {
        stepCurrent.value = v;
    }, {
        deep: true,
        immediate: true,
    });
    const [DefineEmptyCreate, EmptyCreateButton] = createReusableTemplate();
    return {
      update, randomString, emptyCreateSearch, $t, menuStory, origin, img1, img2, img3, img4, img5, img6,
      route, view, id, loading, formRef1, formRef2, formState, formData, showAddBtn, current, stepCurrent,
      steps, protocolList, allProtocolList, protocolCurrent, onOpen, onBack, protocolChange, protocolSearch,
      saveData, queryProtocolList, addProtocol, next, prev, DefineEmptyCreate, EmptyCreateButton, props
    };
}
