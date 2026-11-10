import type { ExtractPropTypes } from 'vue';
import { onlyMessage } from '@jetlinks-web/utils';
import { update, save } from '../../../../../api/link/accessConfig';
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
export function useOnvifEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const { t: $t } = useI18n();
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
    const channel = ref(props.provider.channel);
    const formState = ref<FormState>({
        name: '',
        bizKey: '',
        description: '',
        i18nMessages: {},
    });
    const { onBack } = useTabSaveSuccessBack();
    const onFinish = async (values: any) => {
        loading.value = true;
        const params = {
            ...values,
            provider: 'onvif',
            transport: 'ONVIF',
            channel: 'onvif',
        };
        const resp = id === ':id' ? await save(params) : await update({ ...params, id });
        if (resp.status === 200) {
            onlyMessage($t('Media.Onvif.507446-11'), 'success');
            if (route.query.save) {
                // @ts-ignore
                onBack(resp);
            }
            else {
                history.back();
            }
        }
        loading.value = false;
    };
    onMounted(() => {
        if (id !== ':id') {
            formState.value = {
                name: props.data.name,
                bizKey: props.data.bizKey || '',
                description: props.data?.description || '',
            };
        }
    });
    return {
      update, $t, route, view, id, loading, channel, formState, onBack, onFinish, props
    };
}
