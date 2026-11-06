import { useGatewaySaveBack } from '../useGatewaySaveBack';
import type { ExtractPropTypes } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import { save, update, getPluginList, getPluginConfig } from '../../../../../api/link/accessConfig';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { CreteRuleByType } from '../../../components/Form/rules';
import { useI18n } from 'vue-i18n';
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks';
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
export function usePluginEditor(props: Readonly<ExtractPropTypes<typeof editorProps>>) {
    const emptyCreateSearch = emptyCreateSearchRef(false);
    const { t: $t } = useI18n();
    const route = useRoute();
    const menuStory = useMenuStore();
    const current = ref(0);
    const pluginList = ref([]);
    const AccessCurrent = ref(props.data.channelId);
    const paramsId = route.params.id as string;
    const view = route.query.view as string;
    const clientHeight = document.body.clientHeight;
    const loading = ref(false);
    const formData = reactive({
        name: undefined,
        description: undefined,
        bizKey: props.data?.bizKey || '',
        i18nMessages: {},
        configuration: {},
    });
    const formRef = ref();
    const config = ref<any>([]);
    const { onBack } = useGatewaySaveBack();
    const queryPlugin = (params = {}) => {
        emptyCreateSearch.value = 'terms' in params && Array.isArray(params.terms) && params.terms.some(term => String(term.value ?? '').replace(/%/g, '').trim().length > 0);
        getPluginList({
            terms: [
                {
                    terms: [
                        {
                            column: 'type',
                            value: props.provider.id === 'media-plugin' ? 'media' : 'deviceGateway',
                            termType: 'eq',
                        },
                    ],
                },
                params,
            ],
            sorts: [{ name: 'createTime', order: 'desc' }],
            paging: false,
        }).then((res) => {
            pluginList.value = [];
            if (res.success) {
                pluginList.value = res.result || [];
            }
        });
    };
    const showAddBtn = computed(() => {
        return route.query.view === 'false' && !props.bindProduct;
    });
    const getRules = (item: any) => {
        let typeName = $t('Plugin.index.626239-18');
        let rules: any[] = [];
        if (['select', 'date'].includes(item.type?.type || 'string')) {
            typeName = $t('Plugin.index.626239-19');
        }
        if (item.type?.expands?.required) {
            rules.push({
                required: true,
                message: $t('Plugin.index.626239-20', [typeName, item.name]),
            });
        }
        const typeRules = CreteRuleByType(item.type?.type);
        rules = [...rules, ...typeRules];
        return rules;
    };
    const handleOptions = (record) => {
        const type = record.type;
        const options = [];
        if (type === 'boolean') {
            options.push({
                label: record.falseText,
                value: record.falseValue,
            }, {
                label: record.trueText,
                value: record.trueValue,
            });
        }
        if (type === 'enum') {
            record.elements.forEach(element => {
                options.push({
                    label: element.text,
                    value: element.value,
                });
            });
        }
        return options;
    };
    const queryPluginConfig = (id: string, update: boolean = true) => {
        return getPluginConfig(id).then((res) => {
            if (res.success && id === AccessCurrent.value) {
                const properties = res.result?.others?.configMetadata?.properties || [];
                config.value = properties.map((item: any) => {
                    if (update) {
                        formData.configuration[item.property] = undefined;
                    }
                    return {
                        label: item.name,
                        name: item.property,
                        type: item.type?.type || 'string',
                        rules: getRules(item),
                        options: handleOptions(item.type)
                    };
                });
            }
        });
    };
    const pluginSearch = (val: string) => {
        queryPlugin({
            terms: [
                {
                    column: 'name',
                    termType: 'like',
                    value: `%${val}%`,
                },
            ],
            type: 'and',
        });
    };
    const AccessChange = (id: string) => {
        AccessCurrent.value = id;
    };
    const addPlugin = () => {
        const url = menuStory.getMenu('link/plugin')?.path;
        const wd: any = window.open(`${window.location.origin + window.location.pathname}#${url}?save=true`);
        wd.onTabSaveSuccess = (value: any) => {
            if (value.success) {
                AccessCurrent.value = value.result?.id;
                pluginList.value.unshift(value.result as any);
            }
        };
    };
    /**
     * 下一步
     */
    const next = () => {
        if (!AccessCurrent.value) {
            return onlyMessage($t('Plugin.index.626239-21'), 'error');
        }
        current.value += 1;
    };
    /**
     * 上一步
     */
    const prev = () => {
        current.value -= 1;
    };
    /**
     * 保存
     */
    const saveData = () => {
        formRef.value.validate().then(async (data: any) => {
            if (data) {
                const params = {
                    ...props.data,
                    ...data,
                    protocol: props.provider.id === 'media-plugin'
                        ? props.provider.id
                        : 'plugin_gateway',
                    channel: 'plugin', // 网络组件
                    channelId: AccessCurrent.value,
                    provider: props.provider.id,
                    transport: 'plugin',
                };
                if (route.query.provider) {
                    // 复合网关是业务绑定的唯一实体，子网关配置不能携带业务标识。
                    delete params.bizKey;
                    onBack({
                        ...params,
                        protocolDetail: pluginList.value.find((i: any) => i.id === AccessCurrent.value),
                    });
                    return;
                }
                loading.value = true;
                const resp = paramsId === ':id'
                    ? await save(params).catch(() => {
                        success: false;
                    })
                    : await update({ ...params, id: paramsId }).catch(() => {
                        success: false;
                    });
                loading.value = false;
                if (resp.success) {
                    onlyMessage($t('Plugin.index.626239-22'), 'success');
                    history.back();
                    onBack(resp);
                }
            }
        });
    };
    let pendingConfig: Promise<unknown> = Promise.resolve();
    const waitForPluginConfig = () => pendingConfig;
    // 元数据只随插件选择加载；切换步骤不能重置已填写的动态值。
    watch(AccessCurrent, (id) => {
        if (id) pendingConfig = queryPluginConfig(id, id !== props.data.channelId);
    }, { immediate: true });
    onMounted(() => {
        if (paramsId !== ':id') {
            // 编辑，回显表单值
            formData.name = props.data.name;
            formData.description = props.data.description;
            formData.configuration = props.data.configuration;
        }
    });
    queryPlugin();
    const [DefineEmptyCreate, EmptyCreateButton] = createReusableTemplate();
    return {
      update, emptyCreateSearch, $t, route, menuStory, current, pluginList, AccessCurrent, paramsId, view,
      clientHeight, loading, formData, formRef, config, onBack, queryPlugin, showAddBtn, getRules,
      handleOptions, queryPluginConfig, waitForPluginConfig, pluginSearch, AccessChange, addPlugin, next, prev, saveData,
      DefineEmptyCreate, EmptyCreateButton, props
    };
}
