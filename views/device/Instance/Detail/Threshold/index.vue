<template>
  <div class="threshold-page">
    <JProTable
      ref="tableRef"
      :columns="columns"
      :request="queryThresholdList"
      modeValue="CARD"
      :defaultParams="{
        sorts: [{ name: 'id', order: 'desc' }],
      }"
    >
      <template #headerLeftRender>
        <j-permission-button type="primary" @click="openCreate">
          <template #icon>
            <AIcon type="PlusOutlined" />
          </template>
          {{ $t('Threshold.index.000001-9') }}
        </j-permission-button>
      </template>
      <template #card="slotProps">
        <CardBox
          :value="slotProps"
          :actions="getActions(slotProps)"
          v-bind="slotProps"
          :status="slotProps.configured ? 1 : 0"
          :statusText="slotProps.configured ? $t('Threshold.index.000001-0') : $t('Threshold.index.000001-17')"
          :statusNames="{ 1: 'processing', 0: 'error' }"
        >
          <template #content>
            <j-ellipsis style="width: calc(100% - 16px); margin-bottom: 14px">
              <span style="font-weight: 600; font-size: 16px">
                {{ slotProps.propertyName || slotProps.propertyId }}
              </span>
            </j-ellipsis>
            <a-row>
              <a-col :span="12">
                <div class="card-item-content-text">{{ $t('Threshold.index.000001-1') }}</div>
                <j-ellipsis>{{ slotProps.propertyId }}</j-ellipsis>
              </a-col>
              <a-col :span="12">
                <div class="card-item-content-text">{{ $t('Threshold.index.000001-8') }}</div>
                <j-ellipsis>{{ slotProps.dataType || '-' }}</j-ellipsis>
              </a-col>
            </a-row>
            <a-row style="margin-top: 12px">
              <a-col :span="12">
                <div class="card-item-content-text">{{ $t('Properties.OtherSetting.237457-9') }}</div>
                <j-ellipsis>{{ thresholdText(slotProps) }}</j-ellipsis>
              </a-col>
              <a-col :span="12">
                <div class="card-item-content-text">{{ $t('Properties.OtherSetting.237457-13') }}</div>
                <j-ellipsis>{{ modeText(slotProps.mode) }}</j-ellipsis>
              </a-col>
            </a-row>
            <a-row style="margin-top: 12px">
              <a-col :span="12">
                <div class="card-item-content-text">{{ $t('Threshold.index.000001-14') }}</div>
                <j-ellipsis>{{ sourceText(slotProps.source) }}</j-ellipsis>
              </a-col>
            </a-row>
          </template>
          <template #actions="item">
            <j-permission-button :popConfirm="item.popConfirm" @click="item.onClick">
              <AIcon :type="item.icon" />
              <span>{{ item.text }}</span>
            </j-permission-button>
          </template>
        </CardBox>
      </template>
      <template #configured="slotProps">
        <j-badge-status
          :status="slotProps.configured ? 1 : 0"
          :statusNames="{ 1: 'processing', 0: 'error' }"
          :text="slotProps.configured ? $t('Threshold.index.000001-0') : $t('Threshold.index.000001-17')"
        />
      </template>
      <template #source="slotProps">
        {{ sourceText(slotProps.source) }}
      </template>
      <template #action="slotProps">
        <a-space>
          <template v-for="item in getActions(slotProps)" :key="item.key">
            <j-permission-button
              type="link"
              style="padding: 0; margin: 0"
              :danger="item.key === 'delete'"
              :popConfirm="item.popConfirm"
              @click="item.onClick"
            >
              <template #icon>
                <AIcon :type="item.icon" />
              </template>
            </j-permission-button>
          </template>
        </a-space>
      </template>
    </JProTable>

    <a-modal
      v-model:open="editor.visible"
      :title="$t('Threshold.index.000001-5')"
      :confirmLoading="editor.loading"
      @ok="saveThreshold"
    >
      <a-form ref="formRef" :model="editor.form" layout="vertical">
        <a-form-item
          :label="$t('Threshold.index.000001-1')"
          name="propertyId"
          :rules="[{ required: true, message: $t('Threshold.index.000001-10') }]"
        >
          <a-select
            v-if="editor.isCreate"
            v-model:value="editor.form.propertyId"
            :options="createPropertyOptions"
            :placeholder="$t('Threshold.index.000001-11')"
            show-search
            :filter-option="filterOption"
          />
          <a-input v-else v-model:value="editor.form.propertyId" disabled />
        </a-form-item>
        <a-form-item
          v-if="isNumberEditor"
          name="limit"
          :rules="[{ validator: validateLimit, trigger: 'change' }]"
        >
          <template #label>{{ $t('Threshold.index.000001-7') }}</template>
          <a-space>
            <a-input-number
              v-model:value="editor.form.lower"
              style="width: 180px"
              :placeholder="$t('Properties.OtherSetting.237457-10')"
            />
            <span>~</span>
            <a-input-number
              v-model:value="editor.form.upper"
              style="width: 180px"
              :placeholder="$t('Properties.OtherSetting.237457-11')"
            />
          </a-space>
        </a-form-item>
        <a-form-item v-if="isFileEditor" :label="$t('Properties.OtherSetting.237457-9')">
          <a-tag color="processing">{{ $t('Properties.OtherSetting.237457-30') }}</a-tag>
        </a-form-item>
        <a-form-item
          v-if="isNumberEditor"
          :label="$t('Properties.OtherSetting.237457-13')"
          name="mode"
          :rules="[{ required: true, message: $t('Properties.OtherSetting.237457-12') }]"
        >
          <j-card-select
            v-model:value="editor.form.mode"
            :showImage="false"
            :column="4"
            :options="modeOptions"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onlyMessage } from '@jetlinks-web/utils';
import { cloneDeep } from 'lodash-es';
import { useI18n } from 'vue-i18n';
import {
  deleteDeviceThreshold,
  queryDeviceThresholdList,
  queryProductThresholdList,
  updateDeviceThreshold,
} from '../../../../../api/instance';
import { useInstanceStore } from '../../../../../store/instance';

const { t: $t } = useI18n();
const instanceStore = useInstanceStore();
const tableRef = ref();
const formRef = ref();

const columns = [
  { title: 'ID', dataIndex: 'propertyId', key: 'propertyId' },
  { title: $t('Threshold.index.000001-8'), dataIndex: 'propertyName', key: 'propertyName' },
  { title: $t('Threshold.index.000001-18'), dataIndex: 'configured', key: 'configured', scopedSlots: true, width: 120 },
  { title: $t('Threshold.index.000001-14'), dataIndex: 'source', key: 'source', width: 120 },
  { title: $t('Properties.OtherSetting.237457-13'), dataIndex: 'mode', key: 'mode' },
  { title: $t('Product.index.660348-11'), dataIndex: 'action', key: 'action', scopedSlots: true, width: 140 },
];

const modeOptions = [
  { label: $t('Properties.OtherSetting.237457-14'), value: 'ignore' },
  { label: $t('Properties.OtherSetting.237457-15'), value: 'device-record' },
  { label: $t('Properties.OtherSetting.237457-16'), value: 'device-alarm' },
  { label: $t('Properties.OtherSetting.237457-33'), value: 'record-alarm' },
];

const editor = reactive({
  visible: false,
  isCreate: false,
  loading: false,
  form: {
    propertyId: '',
    dataType: '',
    type: 'number-range',
    lower: undefined as number | undefined,
    upper: undefined as number | undefined,
    mode: 'ignore',
  },
});

const configuredPropertyIds = ref<string[]>([]);

const metadataRef = computed(() => {
  if (instanceStore.current?.metadata) {
    return JSON.parse(instanceStore.current.metadata);
  }
  if (instanceStore.current?.productMetadata) {
    return JSON.parse(instanceStore.current.productMetadata);
  }
  return {};
});

const propertyMap = computed(() => {
  const map = new Map<string, any>();
  (metadataRef.value?.properties || []).forEach((item: any) => {
    map.set(item.id, item);
  });
  return map;
});

const createPropertyOptions = computed(() => {
  const allowedType = ['int', 'long', 'float', 'double', 'file'];
  return (metadataRef.value?.properties || [])
    .filter((item: any) => allowedType.includes(item?.valueType?.type))
    .filter((item: any) => !configuredPropertyIds.value.includes(item.id))
    .map((item: any) => ({
      label: `${item.name} (${item.id})`,
      value: item.id,
    }));
});

const metadataProperties = computed(() => {
  const allowedType = ['int', 'long', 'float', 'double', 'file'];
  return (metadataRef.value?.properties || [])
    .filter((item: any) => allowedType.includes(item?.valueType?.type))
    .map((item: any) => ({
      propertyId: item.id,
      propertyName: item.name || item.id,
      dataType: item?.valueType?.type,
      configured: false,
      source: 'none',
      type: '',
      lower: undefined,
      upper: undefined,
      mode: undefined,
    }));
});

const normalizeRecord = (item: any, source: 'device' | 'product') => {
  const propertyId = item?.property || item?.propertyId || item?.id;
  const matcher = item?.configuration?.matcher || {};
  const processors = item?.configuration?.processors || [];
  const property = propertyMap.value.get(propertyId) || {};
  const modeProviders = processors.map((i: any) => i.provider);
  const mode =
    modeProviders.includes('device-record') && modeProviders.includes('device-alarm')
      ? 'record-alarm'
      : modeProviders[0];
  return {
    ...item,
    propertyId,
    propertyName: property?.name || propertyId,
    dataType: property?.valueType?.type,
    type: matcher?.provider,
    lower: matcher?.configuration?.min,
    upper: matcher?.configuration?.max,
    mode,
    source,
  };
};

const queryThresholdList = async (params: Record<string, any>) => {
  if (!instanceStore.current?.id || !instanceStore.current?.productId) {
    return {
      status: 200,
      result: {
        data: [],
        total: 0,
        pageIndex: params?.pageIndex || 0,
        pageSize: params?.pageSize || 12,
      },
    };
  }
  const allRows = metadataProperties.value;
  const pageSize = params?.pageSize || 12;
  const pageIndex = params?.pageIndex || 0;
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const pageRows = allRows.slice(start, end);
  const propertyIds = pageRows.map((item: any) => item.propertyId);

  if (!propertyIds.length) {
    return {
      status: 200,
      result: {
        data: [],
        total: allRows.length,
        pageIndex,
        pageSize,
      },
    };
  }

  const queryParams = {
    paging: false,
    sorts: [{ name: 'id', order: 'desc' }],
    terms: [
      {
        column: 'property',
        termType: 'in',
        value: propertyIds,
      },
    ],
  };

  const [deviceResp, productResp] = await Promise.all([
    queryDeviceThresholdList(
      instanceStore.current.productId,
      instanceStore.current.id,
      queryParams,
    ),
    queryProductThresholdList(instanceStore.current.productId, queryParams),
  ]);

  const deviceList = Array.isArray(deviceResp?.result)
    ? deviceResp.result
    : (deviceResp?.result?.data || []);
  const productList = Array.isArray(productResp?.result)
    ? productResp.result
    : (productResp?.result?.data || []);

  const productData = productList.map((item: any) =>
    normalizeRecord(item, 'product'),
  );
  const deviceData = deviceList.map((item: any) =>
    normalizeRecord(item, 'device'),
  );
  const productMap = new Map<string, any>();
  const deviceMap = new Map<string, any>();
  productData.forEach((item: any) => productMap.set(item.propertyId, item));
  deviceData.forEach((item: any) => deviceMap.set(item.propertyId, item));
  const data = pageRows.map((item: any) => {
    const deviceConfig = deviceMap.get(item.propertyId);
    if (deviceConfig) {
      return {
        ...item,
        ...deviceConfig,
        configured: true,
      };
    }
    const productConfig = productMap.get(item.propertyId);
    if (productConfig) {
      return {
        ...item,
        ...productConfig,
        configured: true,
      };
    }
    return item;
  });

  return {
    ...(deviceResp || {}),
    result: {
      ...(deviceResp?.result || {}),
      total: allRows.length,
      pageIndex,
      pageSize,
      data,
    },
  };
};

const modeText = (mode: string) => {
  return modeOptions.find((item) => item.value === mode)?.label || '-';
};

const thresholdText = (record: any) => {
  if (record.type === 'number-range') {
    return `${record.lower ?? '-'} ~ ${record.upper ?? '-'}`;
  }
  if (record.type === 'file-matcher') {
    return 'file-matcher';
  }
  return '-';
};

const sourceText = (source: string) => {
  if (source === 'device') {
    return $t('Threshold.index.000001-15');
  }
  if (source === 'product') {
    return $t('Threshold.index.000001-16');
  }
  return '-';
};

const openEdit = (record: any) => {
  editor.isCreate = false;
  editor.form = cloneDeep({
    propertyId: record.propertyId,
    dataType: record.dataType,
    type: record.type || 'number-range',
    lower: record.lower,
    upper: record.upper,
    mode: record.mode || 'ignore',
  });
  editor.visible = true;
};

const fetchConfiguredPropertyIds = async () => {
  try {
    const queryParams = {
      paging: false,
      sorts: [{ name: 'id', order: 'desc' }],
    };
    const [deviceResp, productResp] = await Promise.all([
      queryDeviceThresholdList(
        instanceStore.current.productId,
        instanceStore.current.id,
        queryParams,
      ),
      queryProductThresholdList(instanceStore.current.productId, queryParams),
    ]);
    const deviceList = Array.isArray(deviceResp?.result) ? deviceResp.result : (deviceResp?.result?.data || []);
    const productList = Array.isArray(productResp?.result) ? productResp.result : (productResp?.result?.data || []);
    const ids = [...deviceList, ...productList]
      .map((item: any) => item?.property || item?.propertyId || item?.id)
      .filter((id: string) => !!id);
    configuredPropertyIds.value = Array.from(new Set(ids));
  } catch (e) {
    configuredPropertyIds.value = [];
  }
};

const openCreate = () => {
  if (!instanceStore.current?.id || !instanceStore.current?.productId) return;
  fetchConfiguredPropertyIds().then(() => {
    if (!createPropertyOptions.value.length) {
      onlyMessage($t('Threshold.index.000001-13'), 'warning');
      return;
    }
    editor.isCreate = true;
    editor.form = {
      propertyId: '',
      dataType: '',
      type: 'number-range',
      lower: undefined,
      upper: undefined,
      mode: 'ignore',
    };
    editor.visible = true;
  });
};

const isNumberEditor = computed(() =>
  ['int', 'long', 'float', 'double'].includes(editor.form.dataType),
);

const isFileEditor = computed(() => editor.form.dataType === 'file');

const validateLimit = async () => {
  if (!isNumberEditor.value) {
    return Promise.resolve();
  }
  const lower = editor.form.lower;
  const upper = editor.form.upper;
  const invalidLower = lower === undefined || lower === null || Number.isNaN(Number(lower));
  const invalidUpper = upper === undefined || upper === null || Number.isNaN(Number(upper));
  if (invalidLower || invalidUpper) {
    return Promise.reject($t('Properties.OtherSetting.237457-8'));
  }
  if (Number(upper) < Number(lower)) {
    return Promise.reject($t('Properties.OtherSetting.237457-27'));
  }
  return Promise.resolve();
};

const buildPayload = () => {
  return {
    thingType: 'device',
    provider: 'simple',
    configuration: {
      matcher: {
        provider: isFileEditor.value ? 'file-matcher' : 'number-range',
        configuration:
          isFileEditor.value
            ? {}
            : {
                max: editor.form.upper,
                min: editor.form.lower,
                not: true,
              },
      },
      processors:
        isFileEditor.value
          ? [{ provider: 'file-storage', configuration: {} }]
          : editor.form.mode === 'record-alarm'
          ? [
              { provider: 'device-record', configuration: {} },
              { provider: 'device-alarm', configuration: {} },
            ]
          : [{ provider: editor.form.mode, configuration: {} }],
    },
  };
};

const saveThreshold = async () => {
  try {
    editor.loading = true;
    await formRef.value?.validate();
    const resp = await updateDeviceThreshold(
      instanceStore.current.productId,
      instanceStore.current.id,
      editor.form.propertyId,
      buildPayload(),
    );
    if (resp?.status === 200) {
      onlyMessage($t('Detail.index.957187-27'));
      editor.visible = false;
      editor.isCreate = false;
      tableRef.value?.reload();
    }
  } catch (error) {
  } finally {
    editor.loading = false;
  }
};

const removeThreshold = async (record: any) => {
  const resp = await deleteDeviceThreshold(
    instanceStore.current.productId,
    instanceStore.current.id,
    record.propertyId,
    undefined,
  );
  if (resp?.status === 200) {
    onlyMessage($t('Detail.index.957187-27'));
    tableRef.value?.reload();
  }
};

const getActions = (record: any) => {
  if (record.source === 'none') {
    return [
      {
        key: 'edit',
        text: $t('Threshold.index.000001-2'),
        icon: 'EditOutlined',
        onClick: () => openEdit(record),
      },
    ];
  }
  if (record.source === 'product') {
    return [
      {
        key: 'edit',
        text: $t('Threshold.index.000001-2'),
        icon: 'EditOutlined',
        onClick: () => openEdit(record),
      },
    ];
  }
  return [
    {
      key: 'edit',
      text: $t('Threshold.index.000001-2'),
      icon: 'EditOutlined',
      onClick: () => openEdit(record),
    },
    {
      key: 'delete',
      text: $t('Threshold.index.000001-4'),
      icon: 'DeleteOutlined',
      popConfirm: {
        title: $t('Threshold.index.000001-3'),
        onConfirm: () => removeThreshold(record),
      },
      onClick: () => undefined,
    },
  ];
};

watch(
  () => instanceStore.current?.id,
  (id) => {
    if (id) {
      tableRef.value?.reload();
    }
  },
  { immediate: true },
);

watch(
  () => editor.visible,
  (visible) => {
    if (!visible) {
      configuredPropertyIds.value = [];
    }
  },
);

watch(
  () => editor.form.propertyId,
  (id) => {
    if (!id || !editor.isCreate) return;
    const property = propertyMap.value.get(id) || {};
    const dataType = property?.valueType?.type || '';
    editor.form.dataType = dataType;
    if (isFileEditor.value) {
      editor.form.type = 'file-matcher';
      editor.form.mode = 'file-storage';
      editor.form.lower = undefined;
      editor.form.upper = undefined;
    } else {
      editor.form.type = 'number-range';
      editor.form.mode = 'ignore';
    }
  },
);

const filterOption = (input: string, option: any) =>
  String(option?.label || '')
    .toLowerCase()
    .includes(input.toLowerCase());
</script>

<style scoped lang="less">
.threshold-page {
  :deep(.ant-pro-table-card-list) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(320px, 1fr));
    gap: 16px;
  }

  :deep(.ant-pro-table-card-list > *) {
    margin: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  @media (max-width: 1680px) {
    :deep(.ant-pro-table-card-list) {
      grid-template-columns: repeat(2, minmax(320px, 1fr));
    }
  }

  @media (max-width: 1200px) {
    :deep(.ant-pro-table-card-list) {
      grid-template-columns: 1fr;
    }
  }
}
</style>
