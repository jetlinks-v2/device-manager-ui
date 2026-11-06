import type { ExtractPropTypes } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import type { FormInstance } from 'ant-design-vue';
import { update, save, getProtocolList } from '../../../../../api/link/accessConfig';
import { randomString, onlyMessage } from '@jetlinks-web/utils';
import { ProtocolMapping } from '../../data';
import { useMenuStore } from '@jetlinks-web-core/store';
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
export function useOneNetEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const emptyCreateSearch = emptyCreateSearchRef(false);
    const { t: $t } = useI18n();
    const menuStory = useMenuStore();
    const origin = window.location.origin;
    const img5 = network.network5;
    const img6 = network.network6;
    const img7 = network.network7;
    const img8 = network.network8;
    const img9 = network.network9;
    interface FormState {
        apiAddress: string;
        apiKey: string;
        validateToken: string;
        aesKey: string;
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
    const formRef1 = ref<FormInstance>();
    const formRef2 = ref<FormInstance>();
    const formState = ref<FormState>({
        apiAddress: props.provider.id === 'OneNet' ? 'http://api.zj.cmcconenet.com/' : 'https://iot-api.heclouds.com',
        apiKey: '',
        validateToken: '',
        aesKey: '',
        description: '',
    });
    const formData = ref<Form>({
        name: '',
        bizKey: '',
        description: '',
        i18nMessages: {},
    });
    const loading = ref(false);
    const current = ref(0);
    const stepCurrent = ref(0);
    const steps = ref([$t('Cloud.OneNet.808542-55'), $t('Cloud.OneNet.808542-56'), $t('Cloud.OneNet.808542-57')]);
    const procotolList: any = ref([]);
    const allProcotolList = ref([]);
    const procotolCurrent: any = ref('');
    const showAddBtn = computed(() => {
        return route.query.view === 'false' && !props.bindProduct;
    });
    const { onOpen } = useTabSaveSuccess('link/Protocol', {
        onSuccess(value) {
            procotolCurrent.value = value.result?.id;
            queryProcotolList(props.provider?.id);
        }
    });
    const { onBack } = useTabSaveSuccessBack();
    const procotolChange = (id: string) => {
        procotolCurrent.value = id;
    };
    const procotolSearch = (value: string) => {
        emptyCreateSearch.value = Boolean(value?.trim());
        procotolList.value = value
            ? allProcotolList.value.filter((i: any) => i.name &&
                i.name
                    .toLocaleLowerCase()
                    .includes(value.toLocaleLowerCase()))
            : allProcotolList.value;
    };
    const saveData = async () => {
        const data: any = await formRef2.value?.validate();
        loading.value = true;
        const params = {
            ...data,
            configuration: {
                ...formState.value,
                protocol: procotolCurrent.value,
            },
            protocol: procotolCurrent.value,
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
            onlyMessage($t('Cloud.OneNet.808542-58'), 'success');
            history.back();
            onBack(resp);
        }
        loading.value = false;
    };
    const queryProcotolList = async (id: string, params = {}) => {
        const resp: any = await getProtocolList(ProtocolMapping.get(id), {
            ...params,
            'sorts[0].name': 'createTime',
            'sorts[0].order': 'desc',
            paging: false,
        });
        if (resp.status === 200) {
            procotolList.value = resp.result;
            allProcotolList.value = resp.result;
            emptyCreateSearch.value = false;
        }
    };
    const addProcotol = () => {
        onOpen({
            save: true
        });
    };
    const next = async () => {
        if (current.value === 0) {
            let data1: any = await formRef1.value?.validate();
            queryProcotolList(props.provider.id);
            current.value = current.value + 1;
        }
        else if (current.value === 1) {
            if (!procotolCurrent.value) {
                onlyMessage($t('Cloud.OneNet.808542-59'), 'error');
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
            procotolCurrent.value = props.data.protocol;
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
      update, randomString, emptyCreateSearch, $t, menuStory, origin, img5, img6, img7, img8, img9, route,
      view, id, formRef1, formRef2, formState, formData, loading, current, stepCurrent, steps, procotolList,
      allProcotolList, procotolCurrent, showAddBtn, onOpen, onBack, procotolChange, procotolSearch, saveData,
      queryProcotolList, addProcotol, next, prev, DefineEmptyCreate, EmptyCreateButton, props
    };
}
