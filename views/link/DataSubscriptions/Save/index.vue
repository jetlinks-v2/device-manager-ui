<template>
  <a-drawer :width="500" visible :title="$t('DataSubscriptions.Save.index.818621-0')" @close="emits('close')">
    <template v-if="!selectType">
      <div v-for="item in list" :key="item.provider" class="card-item" @click="onSelected(item.provider)"
           :class="{disabled: item.disabled}">
        <div class="card-item-left">
          <h3>{{ item.name }}</h3>
          <p>{{ item.description }}</p>
        </div>
        <div class="card-item-img">
          <img :src="item.img"/>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="alert">
        <AIcon type="InfoCircleFilled" style="color: #2F54EB;"/>
        <div>{{ $t('DataSubscriptions.Save.index.818621-1') }}</div>
        <div style="color: #1A1A1A">{{ list.find(i => i.provider === selectType)?.name }}</div>
        <a-button type="link" @click="onReload">{{ $t('DataSubscriptions.Save.index.818621-2') }}</a-button>
      </div>
      <a-form layout="vertical" :model="modelRef" ref="formRef">
        <a-form-item
            :label="$t('Save.index.902471-6')"
            name="name"
            :rules="[
                {
                    required: true,
                    message: $t('Save.index.902471-7'),
                },
                {
                    max: 64,
                    message: $t('Save.index.902471-3'),
                },
            ]"
        >
          <a-input
              v-model:value="modelRef.name"
              :placeholder="$t('Save.index.902471-7')"
          />
        </a-form-item>
        <a-form-item
            :label="$t('Save.index.902471-12')"
            name="description"
            :rules="[
                {
                    max: 200,
                    message: $t('Save.index.902471-13')
                },
            ]"
        >
          <a-textarea
              v-model:value="modelRef.description"
              :placeholder="$t('Save.index.902471-14')"
              showCount
              :maxlength="200"
          />
        </a-form-item>
      </a-form>
    </template>
    <template #footer v-if="!!selectType">
      <a-space>
        <a-button :loading="loading" @click="onSave" type="primary">{{ $t('Save.index.912481-0') }}</a-button>
        <a-button @click="emits('close')">{{ $t('Save.index.912481-1') }}</a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup>
import {dataSubscriptions} from '@device/assets/data-subscriptions';
import {useI18n} from "vue-i18n";
import {queryProviders, save} from "@device/api/link/dataSubscriptions";
import {providerImg} from "../data";
import {onlyMessage} from "@jetlinks-web/utils";

const props = defineProps({})
const emits = defineEmits(['close', 'save'])

const {t: $t} = useI18n();
const list = ref([])
const selectType = ref()
const formRef = ref()
const loading = ref()

const modelRef = reactive({
  name: undefined,
  description: undefined,
  providerInfo: undefined,
  provider: undefined
})
const onSelected = (id) => {
  if (id === 'more') return
  selectType.value = id
}

const onReload = () => {
  selectType.value = undefined
}

const onSave = async () => {
  const resp = await formRef.value.validate()
  if (resp) {
    const data = {
      ...modelRef,
      provider: selectType.value,
    }
    loading.value = true
    const response = await save(data).finally(() => {
      loading.value = false
    })
    if(response.success) {
      emits('save')
      onlyMessage($t('Product.index.660348-18'))
    }
  }
}

onMounted(() => {
  queryProviders().then(resp => {
    if (resp.success) {
      list.value = resp.result.map(item => ({
        ...item, img: providerImg[item.provider]
      }))
      list.value.push({
        provider: 'more',
        name: $t('DataSubscriptions.Save.index.818621-7'),
        description: $t('DataSubscriptions.Save.index.818621-8'),
        img: dataSubscriptions.moreImg,
        disabled: true
      })
    }
  })
})
</script>

<style lang="less" scoped>
.card-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F5F5F5;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 8px;
  cursor: pointer;
  gap: 16px;

  &.disabled {
    cursor: not-allowed;
  }

  &-left {
    flex: 1;

    h3 {
      color: #1A1A1A;
      font-size: 16px;
    }

    p {
      color: #777777;
    }
  }
}

.alert {
  background: #F5F5F5;
  border: 1px solid #CCCCCC;
  border-radius: 6px;
  padding: 4px 16px;
  gap: 8px;
  display: flex;
  align-items: center;
  color: #777777;
  margin-bottom: 16px;
}
</style>
