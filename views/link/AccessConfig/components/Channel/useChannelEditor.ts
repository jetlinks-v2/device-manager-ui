import type { ExtractPropTypes } from 'vue';
import { onlyMessage } from '@jetlinks-web/utils';
import { update, save } from '../../../../../api/link/accessConfig';
import { ProtocolMapping } from '../../data';
import { useI18n } from 'vue-i18n';
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks';
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
export function useChannelEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const { t: $t } = useI18n();
    interface FormState {
        name: string;
        description: string;
        i18nMessages?: Record<string, Record<string, string>>;
        bizKey?: string;
    }
    const route = useRoute();
    const view = route.query.view as string;
    const id = route.params.id as string;
    const loading = ref(false);
    const type = ref(props.provider.type || props.data.type);
    const formState = ref<FormState>({
        name: '',
        description: '',
        i18nMessages: {},
        bizKey: '',
    });
    const { onBack } = useTabSaveSuccessBack();
    const onFinish = async (values: any) => {
        loading.value = true;
        const providerId = props.provider.id;
        const params = {
            ...values,
            provider: providerId,
            protocol: providerId,
            transport: ProtocolMapping.get(providerId),
            channel: providerId === 'modbus-tcp' ? 'modbus' : 'opc-ua',
        };
        const resp = id === ':id' ? await save(params) : await update({ ...params, id });
        if (resp.status === 200) {
            onlyMessage($t('Channel.index.456223-16'), 'success');
            history.back();
            onBack(resp);
        }
        loading.value = false;
    };
    onMounted(() => {
        if (id !== ':id') {
            formState.value = {
                name: props.data.name,
                description: props.data?.description || '',
                bizKey: props.data?.bizKey || '',
            };
        }
    });
    return {
      update, ProtocolMapping, $t, route, view, id, loading, type, formState, onBack, onFinish, props
    };
}
