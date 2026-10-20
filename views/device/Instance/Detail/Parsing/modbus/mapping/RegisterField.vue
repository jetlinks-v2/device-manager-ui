<template>

          <a-input
            v-model:value="record.registerStr"
            :placeholder="t('ModbusMapping.ui.addressPlaceholder')"
            size="small"
            @change="() => onRegisterStrChange(record)"
          />
          <div class="cell-hint">
            <template
              v-for="hint in [record.registerStr ? getRegisterHintData(record.registerStr) : null]"
              :key="0"
            >
              <RegisterHint v-if="hint" :hint="hint"><template v-if="isHoldingWordBitSlice(record.registerStr)">
                    <span class="reg-meta-sep">·</span>
                    <span class="mm-reg-mask-tail" @click.stop>
                      <a-tooltip
                        :title="t('ModbusMapping.ui.maskHint')"
                      >
                        <span class="mm-reg-mask-tail-lbl">{{ t('ModbusMapping.ui.maskWrite') }}</span>
                      </a-tooltip>
                      <a-switch
                        size="small"
                        class="mm-reg-mask-tail-sw"
                        :checked="record.useMaskWrite === true"
                        @update:checked="(v: boolean | string | number) => { record.useMaskWrite = v as boolean }"
                      />
                    </span>
                  </template></RegisterHint>
              <div v-else-if="record.registerStr" class="reg-hint-error">{{ t('ModbusMapping.ui.invalidAddress') }}</div>
              <div v-else class="reg-format-tip">{{ " " + t('ModbusMapping.ui.addressPrefix') + " " }}<code>{{ t('ModbusMapping.ui.unitAddressFormat') }}</code>{{ t('ModbusMapping.ui.examplePrefix') + " " }}<code>2:40001</code>{{ t('ModbusMapping.ui.defaultUnitPrefix') + " " }}<code>1</code>
              </div>
            </template>
          </div>

</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusMappingView } from '../useModbusMapping'
import type { ModbusSimpleMapping } from '../types'
import RegisterHint from './RegisterHint.vue'
const props = defineProps<{
  model: Pick<ModbusMappingView, 'onRegisterStrChange' | 'isHoldingWordBitSlice' | 'getRegisterHintData'>
  record: ModbusSimpleMapping
}>()
const model = props.model
const { onRegisterStrChange, isHoldingWordBitSlice, getRegisterHintData } = toRefs(model)
const { record } = toRefs(props)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./RegisterField.less" />
