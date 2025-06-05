<template>
  <a-modal
      visible
      :title="$t('Save.SelectDevices.386303-1')"
      :ok-text="$t('Save.SelectDevices.386303-2')"
      :cancel-text="$t('Save.SelectDevices.386303-3')"
      :visible="true"
      width="1000px"
      @cancel="handleCancel"
      @ok="handleOk"
  >
    <div class="tab">
      <div @click="activeKey = item.key" v-for="item in tabList" :key="item.key" class="tab-item" :class="{'active': item.key === activeKey }">
        <h3>{{item.tab}}</h3>
        <div class="desc"><j-ellipsis>{{item.desc}}</j-ellipsis></div>
      </div>
    </div>
    <div style="height: 500px; margin-top: 16px; display: flex; flex-direction: column">
      <component :is="tabObj[activeKey]" :productId="productId" ref="componentRef" :data="data" :key="activeKey" />
    </div>
  </a-modal>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
import Self from './Self.vue';
import All from './All.vue';
import Org from './Org.vue';

const { t: $t } = useI18n();
const emit = defineEmits(['save', 'close']);

const props = defineProps({
  data: {
    type: Object,
    default: () => ({})
  },
  productId: {
    type: String,
    default: '',
  },
});
const activeKey = ref('Self')
const componentRef = ref();

const tabObj = {
  'Self': Self,
  'All': All,
  'Org': Org
}

const tabList = [
  {
    key: 'Self',
    tab: $t('Save.SelectDevices.386303-12'),
    desc: $t('Save.SelectDevices.386303-13')
  },
  {
    key: 'All',
    tab: $t('Save.SelectDevices.386303-14'),
    desc: $t('Save.SelectDevices.386303-15')
  },
  {
    key: 'Org',
    tab: $t('Save.SelectDevices.386303-16'),
    desc: $t('Save.SelectDevices.386303-17')
  }
]

const handleOk = async () => {
  const resp = await componentRef.value?.onSave?.()
  if(resp){
    emit('save', resp, activeKey.value)
  }
};

const handleCancel = () => {
  emit('close')
};

watch(
    () => props.data,
    (val) => {
      if(val && val.length > 0){
        if(val?.[0]?.column === 'id$dim-assets'){
          activeKey.value = 'Org'
        } else if(val?.[0]?.column === 'id'){
          activeKey.value = 'Self'
        } else {
          activeKey.value = 'All'
        }
      } else {
        activeKey.value = 'Self'
      }
    },
    {
      immediate: true,
      deep: true,
    }
);
</script>

<style lang="less" scoped>
.tab {
  display: flex;
  gap: 24px;

  .tab-item {
    border-top: 4px solid lightgrey;
    width: 210px;
    padding: 12px;
    cursor: pointer;

    .desc {
      font-size: 12px;
      color: rgba(0, 0, 0, .7);
    }
  }

  .active {
    border-color: @primary-color;
    background-color: @primary-1;
  }
}
</style>
