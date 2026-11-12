<template>
  <a-form
    ref="formRef2"
    layout="vertical"
    name="dynamic_form_nest_item"
    :model="dynamicValidateForm"
  >
    <div
      v-for="(cluster, index) in dynamicValidateForm.cluster"
      :key="cluster.id"
    >
      <a-collapse v-model:activeKey="activeKey">
        <a-collapse-panel
          :key="cluster.id"
          :header="
            cluster.clusterNodeId ? cluster.clusterNodeId : $t('Media.GB28181.666483-16', [index + 1])
          "
        >
          <template #extra>
            <span
              @click="removeCluster(cluster)"
              class="delete-btn"
            >
              {{ $t('Media.GB28181.666483-17') }}
            </span>
          </template>
          <a-row :gutter="[24, 24]">
            <a-col :xs="24" :md="12">
              <a-form-item
                :label="$t('Media.GB28181.666483-18')"
                :name="['cluster', index, 'clusterNodeId']"
                :rules="{
                  required: true,
                  message: $t('Media.GB28181.666483-19')
                }"
              >
                <a-select
                  v-model:value="cluster.clusterNodeId"
                  :placeholder="$t('Media.GB28181.666483-19')"
                  allowClear
                  show-search
                  :filter-option="filterOption"
                >
                  <a-select-option
                    v-for="i in getClusterNodeIds(cluster.clusterNodeId)"
                    :value="i.value"
                  >
                    {{ i.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item
                :name="['cluster', index, 'host']"
                :rules="{
                  required: true,
                  message: $t('Media.GB28181.666483-20')
                }"
              >
                <template #label>
                  {{ $t('Media.GB28181.666483-10') }}
                  <a-tooltip :title="$t('Media.GB28181.666483-21')">
                    <AIcon
                      type="QuestionCircleOutlined"
                      style="margin-left: 2px"
                    />
                  </a-tooltip>
                </template>
                <a-select
                  v-model:value="cluster.host"
                  :options="sipMap.get(cluster.clusterNodeId)?.sipListOption || []"
                  :placeholder="$t('Media.GB28181.666483-22')"
                  allowClear
                  show-search
                  :filter-option="filterOption"
                  style="width: 100%"
                  @change="handleChangeForm2Sip(index)"
                ></a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item
                :name="['cluster', index, 'port']"
                :rules="{
                  required: true,
                  message: $t('Media.GB28181.666483-12')
                }"
              >
                <div class="form-label"></div>
                <a-select
                  v-model:value="cluster.port"
                  :placeholder="$t('Media.GB28181.666483-12')"
                  allowClear
                  show-search
                  :filter-option="filterOption"
                >
                  <a-select-option
                    v-for="i in getSipListOption(
                      sipMap.get(cluster.clusterNodeId)?.sipListIndex || [],
                      cluster.port
                    )"
                    :value="i.value"
                  >
                    {{ i.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item
                :name="['cluster', index, 'publicHost']"
                :validateFirst="true"
                :rules="[
                  {
                    required: true,
                    message: $t('Media.GB28181.666483-23')
                  },
                  {
                    validator: validateUrl,
                    trigger: 'change'
                  }
                ]"
              >
                <template #label>
                  {{ $t('Media.GB28181.666483-13') }}
                  <a-tooltip :title="$t('Media.GB28181.666483-24')">
                    <AIcon
                      type="QuestionCircleOutlined"
                      style="margin-left: 2px"
                    />
                  </a-tooltip>
                </template>
                <a-input
                  style="width: 100%"
                  v-model:value="cluster.publicHost"
                  :placeholder="$t('Media.GB28181.666483-14')"
                  allowClear
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item
                :name="['cluster', index, 'publicPort']"
                :rules="[
                  {
                    required: true,
                    message: $t('Media.GB28181.666483-15')
                  }
                ]"
              >
                <div class="form-label"></div>

                <a-input-number
                  style="width: 100%"
                  :placeholder="$t('Media.GB28181.666483-15')"
                  v-model:value="cluster.publicPort"
                  :min="1"
                  :max="65535"
                  :precision="0"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-collapse-panel>
      </a-collapse>
    </div>
    <a-form-item>
      <a-button
        style="margin-top: 10px"
        type="primary"
        block
        ghost
        @click="addCluster"
      >
        <AIcon type="PlusOutlined" />
        {{ $t('Media.GB28181.666483-25') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>
<script setup lang="ts">
import type { useGb28181Editor } from './useGb28181Editor';
const viewProps = defineProps<{
    editor: ReturnType<typeof useGb28181Editor>;
}>();
const editor = viewProps.editor;
const {
  $t, id, activeKey, formRef2, sipListOption, sipListIndex, sipMap, dynamicValidateForm, rules, validateUrl,
  removeCluster, addCluster, filterOption, handleChangeForm2Sip, getClusterNodeIds, getSipListOption
} = editor;
</script>

<style scoped lang="less" src="./useGb28181Editor.less"></style>
