<template>
  <a-form
    :model="formState"
    ref="formRef1"
    name="basic"
    autocomplete="off"
    layout="vertical"
  >
    <a-row :gutter="[24, 24]">
      <a-col :xs="24" :md="12">
        <a-form-item
          :label="$t('Media.GB28181.666483-1')"
          name="domain"
          :rules="[
            {
              required: true,
              message: $t('Media.GB28181.666483-2')
            },
            {
              max: 64,
              message: $t('Media.GB28181.666483-3'),
              trigger: 'blur'
            }
          ]"
        >
          <a-input
            v-model:value="formState.domain"
            :placeholder="$t('Media.GB28181.666483-2')"
          />
        </a-form-item>
      </a-col>
      <a-col :xs="24" :md="12">
        <a-form-item
          label="SIP ID"
          name="sipId"
          :rules="[
            {
              required: true,
              message: $t('Media.GB28181.666483-4')
            },
            {
              max: 64,
              message: $t('Media.GB28181.666483-3'),
              trigger: 'blur'
            }
          ]"
        >
          <a-input
            v-model:value="formState.sipId"
            :placeholder="$t('Media.GB28181.666483-4')"
          />
        </a-form-item>
      </a-col>
    </a-row>

    <a-form-item
      name="shareCluster"
      :rules="[
        {
          required: true,
          message: $t('Media.GB28181.666483-5')
        }
      ]"
    >
      <template #label>
        {{ $t('Media.GB28181.666483-6') }}
        <a-tooltip :title="$t('Media.GB28181.666483-7')">
          <AIcon
            type="QuestionCircleOutlined"
            style="margin-left: 2px"
          />
        </a-tooltip>
      </template>
      <a-radio-group v-model:value="formState.shareCluster">
        <a-radio :value="true">{{ $t('Media.GB28181.666483-8') }}</a-radio>
        <a-radio :value="false">{{ $t('Media.GB28181.666483-9') }}</a-radio>
      </a-radio-group>
    </a-form-item>
    <div
      v-if="formState.shareCluster"
      class="form-item1"
    >
      <a-row :gutter="[24, 24]">
        <a-col :span="6">
          <a-form-item
            :label="$t('Media.GB28181.666483-10')"
            :name="['hostPort', 'host']"
            :rules="[
              {
                required: true,
                message: $t('Media.GB28181.666483-11')
              }
            ]"
          >
            <a-select
              v-model:value="formState.hostPort.host"
              style="width: 105%"
              :disabled="true"
              show-search
              :filter-option="filterOption"
            >
              <a-select-option value="0.0.0.0">0.0.0.0</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item
            :name="['hostPort', 'port']"
            :rules="[
              {
                required: true,
                message: $t('Media.GB28181.666483-12')
              }
            ]"
          >
            <div class="form-label"></div>
            <a-select
              v-model:value="formState.hostPort.port"
              :options="sipList"
              :placeholder="$t('Media.GB28181.666483-12')"
              allowClear
              show-search
              :filter-option="filterOption"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item
            :label="$t('Media.GB28181.666483-13')"
            :name="['hostPort', 'publicHost']"
            :rules="[
              {
                required: true,
                message: $t('Media.GB28181.666483-14')
              },
              {
                validator: validateUrl,
                trigger: 'change'
              }
            ]"
            :validateFirst="true"
          >
            <a-input
              style="width: 105%"
              v-model:value="formState.hostPort.publicHost"
              :max="65535"
              :min="1"
              :precision="0"
              :placeholder="$t('Media.GB28181.666483-14')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item
            :name="['hostPort', 'publicPort']"
            :rules="rules.publicPort"
            :validateFirst="true"
          >
            <div class="form-label"></div>

            <a-input-number
              style="width: 100%"
              :placeholder="$t('Media.GB28181.666483-15')"
              v-model:value="formState.hostPort.publicPort"
              :min="1"
              :max="65535"
              :precision="0"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </div>
  </a-form>
</template>
<script setup lang="ts">
import type { useGb28181Editor } from './useGb28181Editor';
const viewProps = defineProps<{
    editor: ReturnType<typeof useGb28181Editor>;
}>();
const editor = viewProps.editor;
const {
  $t, formRef1, formState, sipList, rules, validateUrl, filterOption
} = editor;
</script>

<style scoped lang="less" src="./useGb28181Editor.less"></style>
