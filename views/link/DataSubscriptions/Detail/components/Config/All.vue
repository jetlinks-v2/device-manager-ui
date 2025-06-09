<template>
  <div class="all-content">
    <img :src="dataSubscriptions.allIconImg" :width="126" />
    <div class="desc">
      {{ data.type !== 'device' ?
        $t('DataSubscriptions.Detail.index.697323-30') :
        $t('DataSubscriptions.Detail.index.697323-31')
      }}
    </div>
  </div>
</template>

<script setup>
import {dataSubscriptions} from '@device/assets/data-subscriptions'
import {useI18n} from "vue-i18n";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({type: 'device'}),
  },
})
const {t: $t} = useI18n();
</script>

<style lang="less" scoped>
.all-content {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  height: 100%;

  img {
    margin-bottom: 16px;
  }
}
.desc {
  color: #777777;
  width: 40%;
  text-align: center;
  line-height: 24px;
}
</style>
