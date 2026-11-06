import { useGatewaySaveBack } from '../useGatewaySaveBack';
import type { ExtractPropTypes } from 'vue';
import { onlyMessage } from "@jetlinks-web/utils";
import { update, save } from "../../../../../api/link/accessConfig";
import { ProtocolMapping } from "../../data";
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
export function useCollectorEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
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
        name: "",
        description: "",
        i18nMessages: {},
        bizKey: '',
    });
    const { onBack } = useGatewaySaveBack();
    const onFinish = async (values: any) => {
        loading.value = true;
        const providerId = props.provider.id;
        const params = {
            ...values,
            provider: providerId,
            protocol: providerId,
            transport: ProtocolMapping.get(providerId),
            channel: props.provider.channel,
        };
        if (route.query.provider) {
            // 复合网关是业务绑定的唯一实体，子网关配置不能携带业务标识。
            delete params.bizKey;
            onBack({ ...params });
            return;
        }
        const resp = id === ":id" ? await save(params) : await update({ ...params, id });
        if (resp.status === 200) {
            onlyMessage($t('Edge.geteway.598238-14'), "success");
            history.back();
            onBack(resp);
        }
        loading.value = false;
    };
    onMounted(() => {
        if (id !== ":id") {
            formState.value = {
                name: props.data.name,
                description: props.data?.description || "",
                bizKey: props.data?.bizKey || '',
            };
        }
    });
    return {
      update, ProtocolMapping, $t, route, view, id, loading, type, formState, onBack, onFinish, props
    };
}
