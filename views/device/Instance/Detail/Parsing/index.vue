
<template>
  <div class="parsing">
    <div v-if="parsingInitializing" class="parsing-loading-wrap">
      <a-spin size="large" tip="加载解析配置中…" />
    </div>
    <template v-else>
    <div class="parsing-type-bar">
      <div class="parsing-type-bar-left">
        <a-dropdown v-if="parsingCodecMenuItems.length > 1" trigger="click" placement="bottomLeft">
          <button type="button" class="parsing-type-trigger">
            <span class="parsing-type-trigger-text">{{ currentTypeLabel }}</span>
            <AIcon type="DownOutlined" class="parsing-type-trigger-caret" />
          </button>
          <template #overlay>
            <a-menu :selected-keys="[ruleType]" class="parsing-type-menu" @click="onRuleTypeMenuClick">
              <a-menu-item v-for="opt in parsingCodecMenuItems" :key="opt.ruleKey">
                {{ opt.label }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <div v-else class="parsing-type-trigger parsing-type-trigger-static">
          <span class="parsing-type-trigger-text">{{ currentTypeLabel }}</span>
        </div>
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
    </template>
  </div>
</template>

<script setup lang="ts" name="Parsing">
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue';
import { isSaaS } from '@jetlinks-web-core/utils/consts';
import { useInstanceStore } from '../../../../../store/instance';
import ModbusMapping from './ModbusMapping.vue';
import ScriptTransparentCodec from './ScriptTransparentCodec.vue';
import { deviceCode, getTransparentCodecSupports } from '../../../../../api/instance';

const instanceStore = useInstanceStore();

const modbusMappingRef = ref<InstanceType<typeof ModbusMapping> | null>(null);
const scriptCodecRef = ref<InstanceType<typeof ScriptTransparentCodec> | null>(null);

const parsingReloading = ref(false);
/** 首次进入：等拉取透明编解码配置后再渲染类型与表单，避免先显示默认「脚本解析」再切换 */
const parsingInitializing = ref(true);

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

/** 与透明消息编解码配置 provider 一致：jsr223 → 脚本页、modbus → Modbus 页 */
const ruleType = ref<'javascript' | 'modbus'>(isSaaS ? 'modbus' : 'javascript');
const codecState = ref<Record<string, any> | null>(null);

/** 后端 provider id → 本页已实现的解析方式（仅展示有对应 UI 的项） */
const PROVIDER_UI_RULE: Record<string, 'javascript' | 'modbus'> = {
  jsr223: 'javascript',
  modbus: 'modbus',
};

/** 面向使用人员的说明（不涉及实现细节） */
const TYPE_DESC: Record<'javascript' | 'modbus', string> = {
  javascript: '自行编写解析规则，按设备实际上报格式把数据转成平台能识别的测点数据。',
  modbus: '在表格中配置寄存器地址与设备测点的对应关系，适用于常见 Modbus 仪表与网关。',
};

const TYPE_LABEL: Record<'javascript' | 'modbus', string> = {
  javascript: '脚本解析',
  modbus: 'Modbus 映射',
};

/** 仅按后端返回的 provider id 过滤；展示名一律用前端 TYPE_LABEL */
const parsingCodecSupports = ref<Array<{ id: string }>>([]);

const parsingCodecMenuItems = computed(() =>
  parsingCodecSupports.value.map((s) => {
    const ruleKey = PROVIDER_UI_RULE[s.id]!;
    return {
      ruleKey,
      label: TYPE_LABEL[ruleKey],
    };
  }),
);

function providerToRuleType(provider: string | undefined): 'javascript' | 'modbus' {
  if (isSaaS) {
    return 'modbus';
  }
  return provider === 'modbus' ? 'modbus' : 'javascript';
}

function pickRuleTypeFromProvider(
  provider: string | undefined,
  supports: Array<{ id: string }>,
): 'javascript' | 'modbus' {
  const preferred = providerToRuleType(provider);
  const allowedIds = new Set(supports.map((s) => s.id));
  const preferredProvider = preferred === 'modbus' ? 'modbus' : 'jsr223';
  if (allowedIds.has(preferredProvider)) {
    return preferred;
  }
  const first = supports[0]?.id;
  if (first && PROVIDER_UI_RULE[first]) {
    return PROVIDER_UI_RULE[first];
  }
  return 'javascript';
}

async function loadCodecSupports() {
  try {
    const res: any = await getTransparentCodecSupports();
    const raw = res.status === 200 && Array.isArray(res.result) ? res.result : [];
    const filtered = raw
      .filter((s: any) => s?.id && PROVIDER_UI_RULE[s.id] && (!isSaaS || s.id === 'modbus'))
      .map((s: any) => ({ id: String(s.id) }));
    parsingCodecSupports.value =
      filtered.length > 0
        ? filtered
        : (isSaaS ? [{ id: 'modbus' }] : [{ id: 'jsr223' }, { id: 'modbus' }]);
  } catch {
    parsingCodecSupports.value = isSaaS ? [{ id: 'modbus' }] : [{ id: 'jsr223' }, { id: 'modbus' }];
  }
}

const currentTypeLabel = computed(() => TYPE_LABEL[ruleType.value]);
const currentTypeDesc = computed(() => TYPE_DESC[ruleType.value]);

function onRuleTypeMenuClick(info: { key: string | number }) {
  const k = String(info.key);
  if (k === 'javascript' || k === 'modbus') {
    ruleType.value = k;
  }
}

const getDeviceCode = async () => {
  const pid = instanceStore.current?.productId;
  const did = instanceStore.current?.id;
  if (!pid || !did) {
    codecState.value = null;
    ruleType.value = isSaaS ? 'modbus' : pickRuleTypeFromProvider(undefined, parsingCodecSupports.value);
    return;
  }
  const res: any = await deviceCode(pid, did);
  if (res.status === 200) {
    codecState.value = res.result ?? null;
    ruleType.value = pickRuleTypeFromProvider(res.result?.provider, parsingCodecSupports.value);
  }
};

async function loadParsingConfig() {
  if (!instanceStore.current?.id || !instanceStore.current?.productId) {
    codecState.value = null;
    ruleType.value = isSaaS ? 'modbus' : 'javascript';
    parsingInitializing.value = false;
    return;
  }
  parsingInitializing.value = true;
  try {
    await loadCodecSupports();
    await getDeviceCode();
  } finally {
    parsingInitializing.value = false;
  }
}

watch(
  () => [instanceStore.current?.id, instanceStore.current?.productId] as const,
  () => loadParsingConfig(),
  { immediate: true },
);
</script>

<style scoped lang="less">
.parsing {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.parsing-loading-wrap {
  flex: 1;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 4px;
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

.parsing-type-trigger-static {
  cursor: default;
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
