<template>
  <a-form
    :model="formState"
    ref="formRef1"
    name="basic"
    autocomplete="off"
    layout="vertical"
  >
    <a-row :gutter="[24, 24]">
      <a-col :span="24">
        <a-form-item
          name="apiAddress"
          :rules="[
            {
              required: true
            }
          ]"
        >
          <template #label>
            {{ $t('Cloud.OneNet.808542-1') }}
            <a-tooltip :title="$t('Cloud.OneNet.808542-2')">
              <AIcon
                type="QuestionCircleOutlined"
                style="margin-left: 2px"
              />
            </a-tooltip>
          </template>
          <a-input v-model:value="formState.apiAddress" />
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="[24, 24]">
      <a-col :span="24">
        <a-form-item
          label="apiKey"
          name="apiKey"
          :rules="[
            {
              required: true,
              message: $t('Cloud.OneNet.808542-3')
            },
            {
              max: 64,
              message: $t('Cloud.OneNet.808542-4'),
              trigger: 'blur'
            }
          ]"
        >
          <a-input
            v-model:value="formState.apiKey"
            :placeholder="$t('Cloud.OneNet.808542-3')"
          />
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="[24, 24]">
      <a-col :span="12">
        <a-form-item
          name="validateToken"
          :rules="[
            {
              required: true,
              message: $t('Cloud.OneNet.808542-5')
            },
            {
              max: 64,
              message: $t('Cloud.OneNet.808542-4'),
              trigger: 'blur'
            }
          ]"
        >
          <template #label>
            {{ $t('Cloud.OneNet.808542-6') }}
            <a-tooltip :title="$t('Cloud.OneNet.808542-7')">
              <AIcon
                type="QuestionCircleOutlined"
                style="margin-left: 2px"
              />
            </a-tooltip>
          </template>
          <a-input
            v-model:value="formState.validateToken"
            :placeholder="$t('Cloud.OneNet.808542-5')"
          />
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item
          name="aesKey"
          :rules="[
            {
              max: 64,
              message: $t('Cloud.OneNet.808542-4'),
              trigger: 'blur'
            }
          ]"
        >
          <template #label>
            aesKey
            <a-tooltip :title="$t('Cloud.OneNet.808542-8')">
              <AIcon
                type="QuestionCircleOutlined"
                style="margin-left: 2px"
              />
            </a-tooltip>
          </template>
          <a-input
            v-model:value="formState.aesKey"
            :placeholder="$t('Cloud.OneNet.808542-9')"
          />
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="[24, 24]">
      <a-col :span="24">
        <a-form-item
          :label="$t('Cloud.OneNet.808542-10')"
          name="description"
        >
          <a-textarea
            :placeholder="$t('Cloud.OneNet.808542-11')"
            :rows="4"
            v-model:value="formState.description"
            show-count
            :maxlength="200"
          />
        </a-form-item>
      </a-col>
    </a-row>
  </a-form>
</template>
<script setup lang="ts">
import type { useOneNetEditor } from './useOneNetEditor';
const viewProps = defineProps<{
    editor: ReturnType<typeof useOneNetEditor>;
}>();
const editor = viewProps.editor;
const {
  $t, formRef1, formState
} = editor;
</script>

<style scoped lang="less" src="./useOneNetEditor.less"></style>
