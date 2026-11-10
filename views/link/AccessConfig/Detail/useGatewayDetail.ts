import { getProviders, detail } from '@device-manager-ui/api/link/accessConfig';
import { queryProductList } from '@device-manager-ui/api/product';
import { accessConfigTypeFilter } from '@jetlinks-web-core/utils';
import { useI18n } from 'vue-i18n';
import { computed, defineAsyncComponent, onMounted, provide, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import Provider from '../components/Provider/index.vue';
import { gatewayEditorKey, gatewayFooterHostKey } from '../components/gatewayEditorContext';
/** 保留原配置步骤、校验和保存链路；由界面在 setup 内调用，生命周期归属不变。 */
export function useGatewayDetail() {
    const footerHost = shallowRef<HTMLElement>();
    provide(gatewayFooterHostKey, footerHost);
    const { t: $t } = useI18n();
    const route = useRoute();
    const id = route.params.id as string;
    const components = {
        network: defineAsyncComponent(() => import('../components/Network/index.vue')),
        provider: Provider,
        media: defineAsyncComponent(() => import('../components/Media/index.vue')),
        channel: defineAsyncComponent(() => import('../components/Channel/index.vue')),
        edge: defineAsyncComponent(() => import('../components/Edge/index.vue')),
        cloud: defineAsyncComponent(() => import('../components/Cloud/index.vue')),
        'collector-gateway': defineAsyncComponent(() => import('../components/Edge/geteway.vue')),
        'plugin_gateway': defineAsyncComponent(() => import('../components/Plugin/index.vue')),
        'composite-device-gateway': defineAsyncComponent(() => import('../components/Composite/index.vue')),
    };
    const dataSource: any = ref([]);
    const type = ref(false);
    const loading = ref(true);
    const providerLoadFailed = ref(false);
    const provider = ref<{
        id?: string;
        name?: string;
    } & Record<string, unknown>>({});
    const titleOverride = ref<{ id: string; name?: string; description?: string }>();
    const titleProvider = computed(() => titleOverride.value || provider.value);
    const data = ref({});
    const showType: any = ref('');
    const bindProduct = ref(false);
    const activeComponent = computed(() => showType.value === 'network'
        ? components[provider.value.id as keyof typeof components] || components.network
        : components[showType.value as keyof typeof components]);
    const goProviders = (param: any) => {
        showType.value = param.type;
        provider.value = param;
        type.value = false;
    };
    const goBack = () => {
        provider.value = {};
        type.value = true;
    };
    const cancelEditor = () => {
        // 外部创建由新标签页承载，取消只关闭页面，不触发保存成功回传。
        if (route.query.sourceId && window.opener)
            window.close();
        else
            history.back();
    };
    provide(gatewayEditorKey, {
        canReselect: computed(() => id === ':id' && !route.query.save && !route.query.provider),
        cancel: cancelEditor,
        reselect: goBack,
        setTitleProvider: value => { titleOverride.value = value; },
    });
    const compositeProvider = computed(() => {
        const arr: any[] = [];
        dataSource.value.forEach((item: any) => {
            item.list?.forEach((item: any) => {
                if (item.type === 'network' && !['composite-device-gateway', 'agent-device-gateway', 'agent-media-device-gateway'].includes(item.id)) {
                    arr.push(item);
                }
            });
        });
        return arr;
    });
    //network
    const TypeMap = new Map([
        ['fixed-media', 'media'],
        ['gb28181-2016', 'media'],
        ['onvif', 'media'],
        ['media-plugin', 'media'],
        ['OneNet', 'cloud'],
        ['OneNet-platform', 'cloud'],
        ['Ctwing', 'cloud'],
        ['modbus-tcp', 'channel'],
        ['opc-ua', 'channel'],
        ['official-edge-gateway', 'edge'],
        ['edge-child-device', 'edge'],
        ['network', 'network'],
        ['agent-device-gateway', 'network'],
        ['agent-media-device-gateway', 'network']
    ]);
    // DataMap后期优化
    const DataMap = new Map();
    DataMap.set('fixed-media', { type: 'media', title: $t('Detail.index.308483-1') });
    DataMap.set('gb28181-2016', { type: 'media', title: $t('Detail.index.308483-1') });
    DataMap.set('onvif', { type: 'media', title: $t('Detail.index.308483-1') });
    DataMap.set('media-plugin', { type: 'media', title: $t('Detail.index.308483-1') });
    DataMap.set('OneNet', { type: 'cloud', title: $t('Detail.index.308483-2') });
    DataMap.set('OneNet-platform', { type: 'cloud', title: $t('Detail.index.308483-2') });
    DataMap.set('Ctwing', { type: 'cloud', title: $t('Detail.index.308483-2') });
    DataMap.set('modbus-tcp', { type: 'channel', title: $t('Detail.index.308483-3') });
    DataMap.set('opc-ua', { type: 'channel', title: $t('Detail.index.308483-3') });
    DataMap.set('official-edge-gateway', { type: 'edge', title: $t('Detail.index.308483-4') });
    DataMap.set('edge-child-device', { type: 'edge', title: $t('Detail.index.308483-4') });
    DataMap.set('network', { type: 'network', title: $t('Detail.index.308483-5') });
    DataMap.set('agent-device-gateway', { type: 'network', title: $t('Detail.index.308483-6') });
    DataMap.set('agent-media-device-gateway', { type: 'network', title: $t('Detail.index.308483-6') });
    const getTypeList = (result: Record<string, any>) => {
        const list = [];
        const media: any[] = [];
        const network: any[] = [];
        const cloud: any[] = [];
        const channel: any[] = [];
        const edge: any[] = [];
        const agent: any[] = [];
        result.map((item: any) => {
            if (item.id === 'fixed-media' || item.id === 'gb28181-2016' || item.id === 'onvif' || item.id === 'media-plugin') {
                item.type = 'media';
                media.push(item);
            }
            else if (item.id === 'OneNet' || item.id === 'Ctwing' || item.id === 'OneNet-platform') {
                item.type = 'cloud';
                cloud.push(item);
            }
            else if (item.id === 'modbus-tcp' || item.id === 'opc-ua' || item.id === 'collector-gateway') {
                item.type = 'channel';
                if (item.id === 'collector-gateway') {
                    channel.push(item);
                }
            }
            else if (item.id === 'official-edge-gateway' ||
                item.id === 'edge-child-device') {
                item.type = 'edge';
                edge.push(item);
            }
            else if (item.id === 'agent-device-gateway' ||
                item.id === 'agent-media-device-gateway') {
                item.type = 'network';
                agent.push(item);
            }
            else {
                item.type = 'network';
                network.push(item);
            }
        });
        network.length &&
            list.push({
                list: [...network],
                title: $t('Detail.index.308483-5'),
            });
        media.length &&
            list.push({
                list: [...media],
                title: $t('Detail.index.308483-1'),
            });
        cloud.length &&
            list.push({
                list: [...cloud],
                title: $t('Detail.index.308483-2'),
            });
        channel.length &&
            list.push({
                list: [...channel],
                title: $t('Detail.index.308483-3'),
            });
        edge.length &&
            list.push({
                list: [...edge],
                title: $t('Detail.index.308483-4'),
            });
        agent.length && list.push({
            list: [...agent],
            title: $t('Detail.index.308483-6')
        });
        return list;
    };
    const queryProviders = async () => {
        const resp: any = await getProviders();
        if (resp.status === 200) {
            const _data = resp.result || [];
            dataSource.value = getTypeList(accessConfigTypeFilter(_data as any[]));
            // 快速添加接入网关
            if (route.query.save && route.query?.type) {
                const type = route.query.type;
                goProviders(dataSource.value
                    .find((f: any) => f.title === DataMap.get(type).title)
                    ?.list?.find((f: any) => f.id === type));
            }
        } else {
            throw new Error('Gateway providers request failed');
        }
    };
    /**
     * 检查是否被产品使用
     */
    const checkBindProduct = async (_id: string) => {
        const resp = await queryProductList({
            paging: false,
            terms: [{
                    column: 'accessId',
                    termType: 'eq',
                    value: _id
                }]
        });
        console.log(resp.success && resp.result?.total);
        if (resp.success && resp.result?.total) {
            bindProduct.value = true;
        }
    };
    const getProvidersData = async () => {
        if (id !== ':id' && !route.query.provider) {
            checkBindProduct(id);
            getProviders().then((response: any) => {
                if (response.status === 200) {
                    const _data = response.result || [];
                    dataSource.value = getTypeList(accessConfigTypeFilter(_data as any[]));
                    detail(id).then((resp: any) => {
                        if (resp.status === 200) {
                            const dt = response.result.find((item: any) => item?.id === resp.result.provider);
                            response.result.forEach((item: any) => {
                                if (item.id === resp.result.provider) {
                                    resp.result.type = TypeMap.has(item.id)
                                        ? TypeMap.get(item.id)
                                        : TypeMap.get('network');
                                    showType.value = resp.result.type;
                                }
                            });
                            provider.value = dt;
                            data.value = resp.result;
                            type.value = false;
                        }
                    });
                }
                loading.value = false;
            });
        }
        else {
            type.value = route.query.provider ? false : true;
            loading.value = true;
            providerLoadFailed.value = false;
            // 新增弹窗的 Spin 覆盖整个请求；等待期间不展示“暂无接入方式”。
            try {
                if (!route.query.data) await queryProviders();
            } catch {
                providerLoadFailed.value = true;
            } finally {
                loading.value = false;
            }
        }
    };
    watch(() => route.query.provider, (val) => {
        if (val) {
            const _data = JSON.parse(val as string);
            type.value = false;
            showType.value = _data.type;
            provider.value = _data;
        }
    }, { immediate: true });
    watch(() => route.query.data, (val) => {
        if (val) {
            data.value = JSON.parse(val as string);
        }
    }, { immediate: true });
    onMounted(() => {
        loading.value = true;
        getProvidersData();
    });
    return {
      $t, route, id, components, dataSource, type, loading, providerLoadFailed, provider, data, showType, bindProduct, footerHost,
      titleProvider, activeComponent, goProviders, goBack, cancelEditor, compositeProvider, TypeMap, DataMap, getTypeList,
      queryProviders, checkBindProduct, getProvidersData
    };
}
