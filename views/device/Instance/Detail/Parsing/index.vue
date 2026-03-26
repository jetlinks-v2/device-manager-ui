
<template>
  <div class="parsing">
    <div class="parsing-type-bar">
      <div class="parsing-type-bar-left">
        <a-dropdown trigger="click" placement="bottomLeft">
          <button type="button" class="parsing-type-trigger">
            <span class="parsing-type-trigger-text">{{ currentTypeLabel }}</span>
            <AIcon type="DownOutlined" class="parsing-type-trigger-caret" />
          </button>
          <template #overlay>
            <a-menu :selected-keys="[ruleType]" class="parsing-type-menu" @click="onRuleTypeMenuClick">
              <a-menu-item key="javascript">脚本解析</a-menu-item>
              <a-menu-item key="modbus">Modbus 映射</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <span class="parsing-type-desc">{{ currentTypeDesc }}</span>
      </div>
      <div class="parsing-type-bar-actions">
        <a-space :size="8">
          <j-permission-button
            size="small"
            hasPermission="device/Instance:update"
            :loading="parsingReloading"
            @click="onTopReload"
          >
            <ReloadOutlined />
            重新加载
          </j-permission-button>
          <j-permission-button
            v-if="ruleType === 'javascript'"
            size="small"
            type="primary"
            hasPermission="device/Instance:update"
            :loading="scriptCodecRef?.savingConfig"
            @click="onScriptSave"
          >
            <SaveOutlined />
            保存配置
          </j-permission-button>
          <j-permission-button
            v-else
            size="small"
            type="primary"
            hasPermission="device/Instance:update"
            :loading="modbusMappingRef?.saving"
            @click="onModbusSave"
          >
            <SaveOutlined />
            保存配置
          </j-permission-button>
        </a-space>
      </div>
    </div>

    <div class="parsing-body">
      <ScriptTransparentCodec
        v-if="ruleType === 'javascript'"
        ref="scriptCodecRef"
        :codec="codecState"
        @updated="getDeviceCode"
      />
      <div v-else-if="ruleType === 'modbus'" class="parsing-modbus-fill">
        <ModbusMapping
          ref="modbusMappingRef"
          :thing-id="instanceStore.current?.id"
          :product-id="instanceStore.current?.productId"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="Parsing">
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue';
import { useInstanceStore } from '../../../../../store/instance';
import ModbusMapping from './ModbusMapping.vue';
import ScriptTransparentCodec from './ScriptTransparentCodec.vue';
import { deviceCode } from '../../../../../api/instance';

const instanceStore = useInstanceStore();

const modbusMappingRef = ref<InstanceType<typeof ModbusMapping> | null>(null);
const scriptCodecRef = ref<InstanceType<typeof ScriptTransparentCodec> | null>(null);

const parsingReloading = ref(false);

async function onTopReload() {
  parsingReloading.value = true;
  try {
    if (ruleType.value === 'modbus') {
      await modbusMappingRef.value?.loadConfig();
    } else {
      await getDeviceCode();
    }
  } finally {
    parsingReloading.value = false;
  }
}

function onModbusSave() {
  modbusMappingRef.value?.saveConfig();
}

function onScriptSave() {
  scriptCodecRef.value?.saveCodec();
}

/** 与透明消息编解码配置 provider 一致：jsr223 / modbus */
const ruleType = ref<'javascript' | 'modbus'>('javascript');
const codecState = ref<Record<string, any> | null>(null);

/** 面向使用人员的说明（不涉及实现细节） */
const TYPE_DESC: Record<'javascript' | 'modbus', string> = {
  javascript: '自行编写解析规则，按设备实际上报格式把数据转成平台能识别的测点数据。',
  modbus: '在表格中配置寄存器地址与设备测点的对应关系，适用于常见 Modbus 仪表与网关。',
};

const TYPE_LABEL: Record<'javascript' | 'modbus', string> = {
  javascript: '脚本解析',
  modbus: 'Modbus 映射',
};

const currentTypeLabel = computed(() => TYPE_LABEL[ruleType.value]);
const currentTypeDesc = computed(() => TYPE_DESC[ruleType.value]);

function onRuleTypeMenuClick(info: { key: string | number }) {
  const k = String(info.key);
  if (k === 'javascript' || k === 'modbus') {
    ruleType.value = k;
  }
}

const getDeviceCode = async () => {
  const res: any = await deviceCode(instanceStore.current.productId, instanceStore.current.id);
  if (res.status === 200) {
    codecState.value = res.result ?? null;
    ruleType.value = res.result?.provider === 'modbus' ? 'modbus' : 'javascript';
  }
};

watch(
  () => instanceStore.current?.id,
  () => {
    if (instanceStore.current?.id) {
      getDeviceCode();
    }
  },
  { immediate: true },
);
</script>

<style scoped lang="less">
.parsing {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.parsing-type-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 6px;
  padding: 2px 0 8px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.parsing-type-bar-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  flex: 1;
  min-width: 0;
}

.parsing-type-bar-actions {
  flex-shrink: 0;

  :deep(.anticon) {
    margin-inline-end: 6px;
  }
}

.parsing-type-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 2px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1.4;
  transition: color 0.15s ease, background 0.15s ease;
}

.parsing-type-trigger-text {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.parsing-type-trigger:hover .parsing-type-trigger-text {
  color: #415ed1;
}

.parsing-type-trigger-caret {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  transition: color 0.15s ease;
}

.parsing-type-trigger:hover .parsing-type-trigger-caret {
  color: #415ed1;
}

.parsing-type-trigger:focus-visible {
  outline: 2px solid rgba(65, 94, 209, 0.35);
  outline-offset: 1px;
}

.parsing-type-menu {
  min-width: 132px;
}

.parsing-type-desc {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.45);
  min-width: 0;
}

.parsing-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.parsing-modbus-fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
