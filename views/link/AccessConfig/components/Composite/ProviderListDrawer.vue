<template>
  <a-drawer
    visible
    :title="$t('Composite.index.636069-2')"
    width="600px"
    :maskClosable="false"
    @close="emit('close')"
  >
    <div class="provider-list">
      <CardBox
        v-for="item in otherProvider"
        :key="item.id"
        :showStatus="false"
      >
        <template #content>
          <div class="provider-content">
            <a-space>
              <div class="images">
                <img :src="BackMap.get(item.id)" />
              </div>
              <div>
                <h2>
                  {{ item.name }}
                </h2>
                <span>
                  {{ item.description }}
                </span>
              </div>
            </a-space>
            <div>
              <a-button type="primary" @click="handleClick(item)">
                {{ $t('provider.index.8501947-0') }}
              </a-button>
            </div>
          </div>
        </template>
      </CardBox>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { BackMap } from '../../data'
import { randomString } from '@jetlinks-web/utils'

const props = defineProps({
  otherProvider: {
    type: Array,
    default: () => ([])
  }
})

const emit = defineEmits(['close', 'save'])

const handleClick = (item) => {
  const sourceId = `accessConfig_${randomString()}`
  const tab = window.open(`${origin}/#/iot/link/accessConfig/detail/:id?view=false&provider=${JSON.stringify(item)}&sourceId=${sourceId}`)
  if(tab) {
    tab.onTabSaveSuccess = (_sourceId: string, _data: any) => {
      if(sourceId === _sourceId) {
        emit('save', _data)
      }
    }
  }
}
</script>

<style scoped lang="less">
.provider-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  .provider-content {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
}
</style>