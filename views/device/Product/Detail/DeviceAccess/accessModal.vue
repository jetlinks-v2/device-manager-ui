<template>

  <DefineEmptyCreate>
    <j-permission-button
        type="primary"
        @click="add"
        hasPermission="link/AccessConfig:add"
    >{{ $t('DeviceAccess.accessModal.132524-3') }}
    </j-permission-button
    >
  </DefineEmptyCreate>
  <a-modal v-bind="$attrs"
      :title="$t('DeviceAccess.accessModal.132524-0')"
      open
      width="1200px"
      :okText="$t('DeviceAccess.accessModal.132524-1')"
      :cancelText="$t('DeviceAccess.accessModal.132524-2')"
      :confirmLoading='loading'
      :maskClosable="false"
      @ok="submitData"
      @cancel="cancel"
  >
    <JProTable
        :columns="columns"
        :request="handleQuery"
        ref="tableRef"
        mode="CARD"
        :defaultParams="{
                ...temp,
                sorts: accessId ? [
                    { name: 'id', value: accessId },
                    { name: 'createTime', order: 'desc' },
                ] : [{ name: 'createTime', order: 'desc' }],
            }"
        :params="params"
        :gridColumns="[2]"
        :pagination="{
        defaultPageSize: 4,
        pageSizeOptions: ['4', '12', '24', '48'],
        showSizeChanger: true,
      }"
        style="padding: 0"
    >
      <template #emptyText>
        <CloudEmpty :search="params?.terms" :search-name="$t('Status.index.565893-14')">
          <EmptyCreateButton />
        </CloudEmpty>
      </template>
	    <template #headerLeftRender>
		    <ConditionFilter
			    :columns="columns"
			    target="deviceModal"
			    @search="handleSearch"
			    type="simple"
			    style="padding: 0"
		    />
	    </template>
      <template #headerRightRender>
        <EmptyCreateButton />
      </template>
      <template #deviceType="slotProps">
        <div>{{ slotProps.deviceType.text }}</div>
      </template>
      <template #card="slotProps">
        <CardBox
            :value="slotProps"
            @click="handleClick"
            v-bind="slotProps"
            :active="selectedRowKeys.includes(slotProps.id)"
            :status="slotProps.state.value"
            :statusText="slotProps.state.text"
            :statusNames="{
                        enabled: 'processing',
                        disabled: 'error',
                    }"
        >
          <template #img>
            <slot name="img">
              <img :src="device.deviceAccess"/>
            </slot>
          </template>
          <template #content>
            <div style="height: 110px">
              <j-ellipsis style="width: calc(100% - 100px); margin-bottom: 18px"
              ><span style="font-weight: 600; font-size: 16px">
                  {{ slotProps.name }}
                </span></j-ellipsis
              >
              <template v-if="slotProps.provider !== 'composite-device-gateway'">
                <a-row>
                  <a-col :span="12" v-if="slotProps.channelInfo">
                    <div class="card-item-content-text">
                      <j-ellipsis>{{ slotProps.channelInfo?.name }}</j-ellipsis>
                    </div>
                    <j-ellipsis style="width: calc(100% - 20px)">
                      <div>
                        {{
                          slotProps.channelInfo?.addresses
                              ? slotProps.channelInfo
                                  ?.addresses[0].address
                              : ''
                        }}
                      </div>
                    </j-ellipsis>
                  </a-col>
                  <a-col :span="12">
                    <div class="card-item-content-text">{{ $t('DeviceAccess.accessModal.132524-4') }}</div>
                    <j-ellipsis style="width:calc(100%-20px)">
                      <div>{{ slotProps.protocolDetail?.name }}</div>
                    </j-ellipsis>
                  </a-col>
                </a-row>
              </template>
              <a-row>
                <a-col :span="24">
                  <j-ellipsis style="width: calc(100% - 50px)">
                    <div class="context-access">
                      {{
                        getDescription(
                            slotProps,
                        )
                      }}
                    </div>
                  </j-ellipsis>
                </a-col>
              </a-row>
            </div>
          </template>
        </CardBox>
      </template>
      <template #state="slotProps">
        <a-badge
            :text="slotProps.state.text"
            :status="slotProps.state"
            :statusNames='{
            "enabled": "processing",
            "disabled": "error",
          }'
        />
      </template>
      <template #id="slotProps">
        <a>{{ slotProps.id }}</a>
      </template>
    </JProTable>
  </a-modal>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import type { PropType } from 'vue'
import { device } from '../../../../../assets'
import type { AccessSelection } from './accessState'
import { useProductAccessSelector } from './hooks/useProductAccessSelector'

defineOptions({ name: 'accessModal' })

const props = defineProps({
  productId: { type: String, default: undefined },
  accessId: { type: String, default: undefined },
  deviceType: { type: String, default: undefined },
  providersList: { type: Array as PropType<{ id: string; description?: string }[]>, default: () => [] },
})
const emit = defineEmits<{
  (event: 'submit', data: AccessSelection): void
  (event: 'cancel'): void
}>()
const {
  tableRef, loading, params, selectedRowKeys, temp, columns, getDescription,
  handleQuery, submitData, handleClick, cancel, handleSearch, add,
} = useProductAccessSelector(props, emit)
const [DefineEmptyCreate, EmptyCreateButton] = createReusableTemplate()
</script>
