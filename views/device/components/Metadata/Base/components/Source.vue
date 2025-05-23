<template>
  <div class="metadata-source">
    <a-select
      v-model:value="myValue"
      :placeholder="$t('components.Source.418270-0')"
      style="flex: 1 1 0;min-width: 0"
      :options="PropertySource"
      :dropdownStyle="{
              zIndex: 1071
            }"
      :getPopupContainer="(node) => tableWrapperRef || node"
      :disabled="disabled"
      @change="onChange"
    >
    </a-select>
    <PopoverModal
      v-if="myValue != 'manual' && !showReset"
      v-model:visible="modalVisible"
      :bodyStyle="{
                width: '450px',
                height: myValue === 'rule' ? '300px' : '92px',
            }"
      placement="bottomRight"
      @ok="confirm"
    >
      <template #content>
        <j-scrollbar v-if="myValue">
          <div style="padding: 0 10px">
            <VirtualRule
              v-if="modalVisible"
              :source="myValue"
              :value="record"
              :isProduct="isProduct"
              :dataSource="dataSource"
              ref="virtualRuleRef"
            />
          </div>
        </j-scrollbar>
      </template>
      <a-button style="padding: 0" type="link" :disabled="disabled" @click="handleSearch">
        <template #icon>
          <AIcon type="EditOutlined" :class="{'table-form-required-aicon': !value.type?.length}"/>
        </template>
      </a-button>
    </PopoverModal>
    <a-dropdown
      v-if="myValue === 'rule' && target === 'device' && showReset"
      placement="bottom"
      trigger="click"
      :getPopupContainer="(node) => tableWrapperRef || node"
    >
      <a-button style="padding: 0" type="link" @click="handleSearch">
        <template #icon>
          <AIcon type="MoreOutlined" />
        </template>
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item>
            <PopoverModal
              v-model:visible="modalVisible"
              :bodyStyle="{
                                width: '450px',
                                height: myValue === 'rule' ? '300px' : '80px',
                            }"
              placement="bottomRight"
              @ok="confirm"
            >
              <template #content>
                <j-scrollbar v-if="myValue">
                  <div style="padding: 0 10px">
                    <VirtualRule
                      :source="myValue"
                      :value="record"
                      :isProduct="isProduct"
                      :dataSource="dataSource"
                      ref="virtualRuleRef"
                    />
                  </div>
                </j-scrollbar>
              </template>
              <a-button style="padding: 4px 8px" type="link">
                {{ $t('components.Source.418270-1') }}
              </a-button>
            </PopoverModal>
          </a-menu-item>
          <a-menu-divider/>
          <a-menu-item>
            <div style="display: flex;">
              <a-button style="padding: 4px 8px" type="link" @click="resetRules">
                {{ $t('components.Source.418270-2') }}
              </a-button>
              <a-tooltip>
                <template #title>{{ $t('components.Source.418270-3') }}</template>
                <AIcon type="QuestionCircleOutlined" style="margin-top: 10px;"/>
              </a-tooltip>
            </div>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts" name="MetadataSource">
import {isNoCommunity} from '@/utils/utils';
import VirtualRule from './VirtualRule/index.vue';
import {Form} from 'ant-design-vue';
import {useInstanceStore} from '../../../../../../store/instance';
import {queryDeviceVirtualProperty, resetRule} from '../../../../../../api/instance';
import {onlyMessage} from '@/utils/comm';
import {provide, Ref} from 'vue';
import {queryProductVirtualProperty} from '../../../../../../api/product';
import {useProductStore} from '../../../../../../store/product';
import {PopoverModal} from '../../../../../../components/Metadata'
import {useTableWrapper} from "../../../../../../components/Metadata/context";
import {sourceType} from "../utils";
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const instanceStore = useInstanceStore();
const productStore = useProductStore();
const tableWrapperRef = useTableWrapper()

const PropertySource = ref<Array<{ label: string; value: string }>>(sourceType.filter(item => isNoCommunity || (!isNoCommunity && item.value !== 'rule')))

type SourceType = 'device' | 'manual' | 'rule' | '';

type Emit = {
  (e: 'update:value', data: Record<string, any>): void;
};


const showReset = computed(() => {
  return myValue.value === 'rule' && props.target === 'device' && props.isProduct
})

const props = defineProps({
  value: {
    type: Object,
    default: () => {
    },
  },
  noEdit: {
    type: Array,
    default: () => [],
  },
  target: {
    type: String,
    default: undefined,
  },
  productNoEdit: {
    type: Array,
    default: []
  },
  record: {
    type: Object,
    default: () => ({})
  },
  disabled: {
    type: Boolean,
    default: false
  },
  isProduct: {
    type: Boolean,
    default: false
  }
});
provide('target', props.target)

const emit = defineEmits<Emit>();

const formItemContext = Form.useInjectFormItemContext();

const myValue = ref<SourceType>('');
const type = ref<string>('');
const virtualRuleRef = ref<any>(null);
const modalVisible = ref(false)
const expands = ref(props.value || {})
const dataSource = inject<Ref<any[]>>('metadataSource')

// const disabled = computed(() => {
//     // if (props.target === 'device') {
//     //     return true;
//     // }
//     return props.noEdit?.length
//         ? props.noEdit.includes(props.record.id) && props?.target === 'device'
//         : false;
// });

const updateValue = (data: any) => {
  // console.log('updateValue',{
  //   ...(props.value || {}),
  //   ...data,
  // })
  emit('update:value', {
    ...(props.value || {}),
    ...data,
  });
  formItemContext.onFieldChange();
};

const onChange = (keys: SourceType) => {
  myValue.value = keys;
  updateValue({
    source: keys,
    type: keys === 'manual' ? ['write'] : ['report'],
  });
};

const confirm = async () => {
  const data = await virtualRuleRef?.value.onSave()
  if (data) {
    updateValue({
      ...expands.value,
      source: myValue.value,
      ...data,
    });
    modalVisible.value = false
  }
};
//重置规则
// const resetRules = async() =>{
//     let res:any =  await queryProductVirtualProperty(instanceStore.current?.productId,props.value.id)
//     if(res && res.status === 200 && res.result.rule){
//         const data:any = {}
//         data.virtualRule = res.result.rule
//         data.virtualRule.triggerProperties = res.result.triggerProperties
//         data.type = type.value
//         updateValue({
//             source:myValue.value,
//             ...data
//         })
//     }
// }
const resetRules = async () => {
  let res: any = await resetRule(instanceStore.current?.productId, instanceStore.current?.id, [props.record.id])
  if (res.status === 200) {
    onlyMessage($t('components.Source.418270-4'))
  }
}
const cancel = () => {
  myValue.value = props.value?.source || '';
  type.value = props.value?.type || [];
}

const handleSearch = async () => {
  if (isNoCommunity && myValue.value === 'rule') {
    let resp: any = undefined;
    if (props.target === 'product') {
      resp = await queryProductVirtualProperty(
        productStore.current?.id,
        props.record.id,
      );
    } else {
      resp = await queryDeviceVirtualProperty(
        instanceStore.current?.productId,
        instanceStore.current?.id,
        props.record.id,
      );
    }
    if (resp && resp.status === 200 && resp.result) {
      const _triggerProperties = props.value?.virtualRule?.triggerProperties?.length ? props.value?.virtualRule?.triggerProperties : resp.result.triggerProperties
      updateValue({
        source: myValue.value,
        virtualRule: {
          triggerProperties: _triggerProperties?.length ? _triggerProperties : ['*'],
          ...resp.result.rule
        }
      });
    }
  }
};

watch(
  () => JSON.stringify(props.value),
  () => {
    if (!props.value?.source) {
      myValue.value = 'device';
    } else {
      myValue.value = props.value?.source || '';
    }
    expands.value = props.value
    type.value = props.value?.type || [];
  },
  {immediate: true},
);

</script>

<style scoped>
.metadata-source {
  display: flex;
  align-items: center;
}
</style>
