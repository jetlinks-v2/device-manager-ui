<template>
    <div class="debug-container">
        <div class="top">
            <div class="header">
                <a-tabs v-model:activeKey="headerType">
                  <template #rightExtra>
                    <a v-if="virtualRule?.script && isBeginning" @click="beginAction">
                      {{ $t('Debug.index.853800-0') }}
                    </a>
                  </template>
                    <a-tab-pane key="property">
                        <template #tab>
                            <span class="title">
                                {{ $t('Debug.index.853800-1') }}
                            </span>
                        </template>
                    </a-tab-pane>
                    <a-tab-pane key="tag">
                        <template #tab>
                            <span class="title">
                                {{ $t('Debug.index.853800-2') }}
                            </span>
                        </template>
                    </a-tab-pane>
                </a-tabs>
            </div>
            <div class="description">
                {{
                    $t('Debug.index.853800-3', [headerType === 'property' ? $t('Debug.index.853800-19') : $t('Debug.index.853800-20')])
                }}
            </div>
            <div class="top-bottom" v-if="headerType === 'property'">
                <a-table
                    :columns="columns"
                    :data-source="property"
                    :pagination="false"
                    bordered
                    size="small"
                    :scroll="{ y: 180 }"
                >
                    <template #bodyCell="{ column, record, index }">
                        <template v-if="column.key === 'id'">
                            <a-select
                                showSearch
                                :options="options"
                                v-model:value="record.id"
                                :getPopupContainer="getPopupContainer"
                                size="small"
                                style="width: 100%;"
                                :virtual="true"
                                :dropdownStyle="{
                                  zIndex: 1072
                                }"
                            />
                        </template>
                        <template v-if="column.key === 'current'">
                            <a-input
                                v-model:value="record.current"
                                size="small"
                            ></a-input>
                        </template>
                        <template v-if="column.key === 'last'">
                            <a-input
                                v-model:value="record.last"
                                size="small"
                            ></a-input>
                        </template>
                        <template v-if="column.key === 'action'">
                            <AIcon
                                type="DeleteOutlined"
                                @click="deleteItem(index)"
                            />
                        </template>
                    </template>
                </a-table>
                <a-button
                    type="dashed"
                    block
                    style="margin-top: 5px"
                    @click="addItem"
                >
                    <template #icon>
                        <AIcon type="PlusOutlined" />
                    </template>
                    {{ $t('Debug.index.853800-4') }}
                </a-button>
            </div>
            <div class="top-bottom" v-if="headerType === 'tag'">
                <a-table
                    :columns="tagColumns"
                    :data-source="tag"
                    :pagination="false"
                    bordered
                    size="small"
                    :scroll="{ y: 200 }"
                >
                    <template #bodyCell="{ column, record, index }">
                        <template v-if="column.key === 'id'">
                            <a-select
                                showSearch
                                :options="tagOptions"
                                v-model:value="record.id"
                                size="small"
                                style="width: 100%;"
                                :virtual="true"
                                :getPopupContainer="getPopupContainer"
                                :dropdownStyle="{
                                  zIndex: 1072
                                }"
                            />
                        </template>
                        <template v-if="column.key === 'current'">
                            <a-input
                                v-model:value="record.current"
                                size="small"
                            ></a-input>
                        </template>
                        <template v-if="column.key === 'action'">
                            <AIcon
                                type="DeleteOutlined"
                                @click="deleteTagItem(index)"
                            />
                        </template>
                    </template>
                </a-table>
                <a-button
                    type="dashed"
                    block
                    style="margin-top: 5px"
                    @click="addTagItem"
                >
                    <template #icon>
                        <AIcon type="PlusOutlined" />
                    </template>
                    {{ $t('Debug.index.853800-4') }}
                </a-button>
            </div>
        </div>
        <div class="bottom">
            <div class="header">
                <div class="title">
                    <div>{{ $t('Debug.index.853800-5') }}</div>
                    <div v-if="virtualRule?.script && !isBeginning">
                        {{ $t('Debug.index.853800-6') }}
                    </div>
                </div>
                <div class="action">
                    <div
                        v-if="!isBeginning && virtualRule?.type === 'window'"
                        class="action"
                        @click="runScriptAgain"
                    >
                        <a>{{ $t('Debug.index.853800-7') }}</a>
                    </div>
                    <div v-if="virtualRule?.script && !isBeginning">
<!--                        <a v-if="isBeginning" @click="beginAction">-->
<!--                            {{ $t('Debug.index.853800-0') }}-->
<!--                        </a>-->
                        <a v-if="!isBeginning" @click="stopAction"> {{ $t('Debug.index.853800-8') }} </a>
                    </div>
                    <div>
                        <a @click="clearAction"> {{ $t('Debug.index.853800-9') }} </a>
                    </div>
                </div>
            </div>
            <div class="log">
                <a-descriptions>
                    <a-descriptions-item
                        v-for="(item, index) in ruleEditorStore.state.log"
                        :key="item.time"
                        :span="3"
                    >
                        <template #label>
                            <template
                                v-if="!!runningState(index + 1, item._time)"
                            >
                                {{ runningState(index + 1, item._time) }}
                            </template>
                            <template v-else>{{
                                dayjs(item.time).format('HH:mm:ss')
                            }}</template>
                        </template>
                        <div v-if="!!runningState(index + 1, item._time)">
                            {{ dayjs(item.time).format('HH:mm:ss') }}
                        </div>
                        <a-tooltip placement="top" :title="item.content">
                            {{ item.content }}
                        </a-tooltip>
                    </a-descriptions-item>
                </a-descriptions>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts" name="Debug">
import { PropType, Ref } from 'vue';
import { useRuleEditorStore } from '../../../store/ruleEditor';
import dayjs from 'dayjs';
import { wsClient } from '@jetlinks-web/core';
import {useTableWrapper, useTableFullScreen} from "../../../components/Metadata/context";
import { onlyMessage } from '@/utils/comm';
import {message} from "ant-design-vue";
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
    virtualRule: Object as PropType<Record<any, any>>,
    id: String,
    propertiesOptions: Array,
});
const emits = defineEmits(['success']);

const isBeginning = ref(true);

type propertyType = {
    id?: string;
    current?: string;
    last?: string;

    type?: string
};
const property = ref<propertyType[]>([]);
const tag = ref<Array<any>>([]);
const tableWrapperRef = useTableWrapper()
const fullScreen = useTableFullScreen()
const columns = [
    {
        title: $t('Debug.index.853800-10'),
        dataIndex: 'id',
        key: 'id',
    },
    {
        title: $t('Debug.index.853800-11'),
        dataIndex: 'current',
        key: 'current',
    },
    {
        title: $t('Debug.index.853800-12'),
        dataIndex: 'last',
        key: 'last',
    },
    {
        title: $t('Debug.index.853800-13'),
        key: 'action',
        width: 50,
    },
];

const tagColumns = [
    {
        title: $t('Debug.index.853800-10'),
        dataIndex: 'id',
        key: 'id',
    },
    {
        title: $t('Debug.index.853800-11'),
        dataIndex: 'current',
        key: 'current',
    },
    {
        title: $t('Debug.index.853800-13'),
        key: 'action',
        width: 50,
    },
];
const headerType = ref('property');
const addItem = () => {
    property.value.push({});
};
const addTagItem = () => {
    tag.value.push({});
};
const deleteItem = (index: number) => {
    property.value.splice(index, 1);
};
const deleteTagItem = (index: number) => {
    tag.value.splice(index, 1);
};

const ws = ref();

const virtualIdRef = ref(new Date().getTime());
const medataSource = inject<Ref<any[]>>('metadataSource');
const tagsSource = inject<Ref<any[]>>('_tagsDataSource');
const ruleEditorStore = useRuleEditorStore();

const time = ref<number>(0);
const timer = ref<any>(null);

//是否全屏监听
const getPopupContainer = (node: any) => {
  if (fullScreen.value) {
    return tableWrapperRef.value || node
  }

  return document.body
}
const runScript = () => {
    const propertiesList = medataSource?.value || []
    const _properties = property.value.map((item: any) => {
        const _item = propertiesList.find((i: any) => i.id === item.id);
        return { ...item, type: _item?.valueType?.type };
    });
    console.log('runScript', _properties, propertiesList)
    let _tags = {};
    tag.value.forEach((item) => {
        _tags[item.id] = item.current;
    });
    if (ws.value) {
        ws.value.unsubscribe?.();
    }
    if (!props.virtualRule?.script) {
        isBeginning.value = true;
      message.config({
        getContainer() {
          return tableWrapperRef.value || document.body
        }
      })
        onlyMessage($t('Debug.index.853800-14'), 'warning');
        return;
    }

    ws.value = wsClient.getWebSocket(
        `virtual-property-debug-${props.id}-${new Date().getTime()}`,
        '/virtual-property-debug',
        {
            virtualId: `${virtualIdRef.value}-virtual-id`,
            property: props.id,
            virtualRule: {
                ...props.virtualRule,
            },
            properties: _properties || [],
            tags: _tags,
        },
    ).subscribe((data: any) => {
        ruleEditorStore.state.log.push({
            time: new Date().getTime(),
            content: JSON.stringify(data.payload),
            _time: unref(time.value),
        });
        emits('success', false);
        if (props.virtualRule?.type !== 'window') {
            stopAction();
        }
    }, () => {}, () => {
      ruleEditorStore.state.log.push({
        time: new Date().getTime(),
        content: $t('Debug.index.853800-15'),
        _time: unref(time.value),
      });
      stopAction()
    });
};

const runningState = (_index: number, _time: number) => {
    if (props.virtualRule?.windowType === 'time') {
        return $t('Debug.index.853800-16', [_time]);
    }
    if (props.virtualRule?.windowType === 'num') {
        return $t('Debug.index.853800-17', [_index]);
    }
    return false;
};

const wsAgain = ref<any>();
const runScriptAgain = async () => {
    if (wsAgain.value) {
        wsAgain.value.unsubscribe?.();
    }
    const propertiesList = medataSource?.value || []
    const _properties = property.value.map((item: any) => {
        const _item = propertiesList.find((i: any) => i.id === item.id);
        return { ...item, type: _item?.valueType?.type };
    });
    console.log('runScriptAgain', _properties, propertiesList)

    wsAgain.value = wsClient.getWebSocket(
        `virtual-property-debug-${props.id}-${new Date().getTime()}`,
        '/virtual-property-debug',
        {
            virtualId: `${virtualIdRef.value}-virtual-id`,
            property: props.id,
            virtualRule: {
                ...props.virtualRule,
            },
            properties: _properties || [],
        },
    ).subscribe((data: any) => {});
};

const getTime = () => {
    time.value = 0;
    timer.value = setInterval(() => {
        time.value += 1;
    }, 1000);
};

const beginAction = () => {
  if (!property.value.length || property.value.some(item => !item.id || !(item.current || item.last) )) {
    message.config({
      getContainer() {
        return tableWrapperRef.value || document.body
      },
    })
    return onlyMessage($t('Debug.index.853800-18'), 'warning')
  }
    isBeginning.value = false;
    runScript();
    getTime();
};
const stopAction = () => {
    isBeginning.value = true;
    if (ws.value) {
        ws.value.unsubscribe?.();
    }
    window.clearInterval(timer.value);
    timer.value = null;
};
const clearAction = () => {
    ruleEditorStore.set('log', []);
};

onUnmounted(() => {
    if (ws.value) {
        ws.value.unsubscribe?.();
    }
    clearAction();

    message.config({
      getContainer() {
        return document.body
      },
    })
    window.clearInterval(timer.value);
    timer.value = null;
});

const options = computed(() => {
    return (props.propertiesOptions || [])
        .map((item) => ({
            label: item.name,
            value: item.id,
        }));
});

const tagOptions = computed(() => {
    return (tagsSource.value || []).map((item) => ({
        label: item.name,
        value: item.id,
    }));
});

defineExpose({
  beginAction
})
// const getProperty = () => {
//     // const metadata = productStore.current.metadata || '{}';
//     // const _p: PropertyMetadata[] = JSON.parse(metadata).properties || [];
//   console.log(medataSource.value)
//     options.value =
// };
// getProperty();
</script>
<style lang="less" scoped>
.debug-container {
     display: flex;
    // width: 100%;
    // height: 340px;
    // margin-top: 20px;
  gap: 12px;

    .top {
        // min-width: 0;
        // max-width: 550px;
        // overflow-y: auto;
        height: 350px;
        border: 1px solid lightgray;
        //margin-bottom: 10px;

        .header {
            //display: flex;
            //align-items: center;
            width: 100%;
            height: 46px;
            border-bottom: 1px solid lightgray;
            padding: 0 12px;
            //justify-content: space-around;

            //div {
            //    display: flex;
            //    //width: 100%;
            //    align-items: center;
            //    justify-content: flex-start;
            //    height: 100%;
            //
            //    .title {
            //        margin: 0 10px;
            //        font-weight: 600;
            //        font-size: 16px;
            //    }
            //
            //    .description {
            //        margin-left: 10px;
            //        color: lightgray;
            //        font-size: 12px;
            //    }
            //}

            .action {
                width: 150px;
                font-size: 14px;
            }
        }

          .description {
              margin-left: 10px;
              font-size: 12px;
          }

        .top-bottom {
            padding: 10px;
        }
    }

    .bottom {
        border: 1px solid lightgray;
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            height: 40px;
            border-bottom: 1px solid lightgray;

            .title {
                display: flex;

                div {
                    margin: 0 10px;
                }
            }

            .action {
                display: flex;

                div {
                    margin: 0 10px;
                }
            }
        }

        .log {
            height: 300px;
            padding: 5px;
            overflow: auto;
        }
    }
}
</style>
