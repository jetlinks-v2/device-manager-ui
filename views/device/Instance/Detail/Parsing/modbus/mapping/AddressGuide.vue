<template>
<div class="form-help modbus-addr-guide">
            <div class="guide-title">{{ t('ModbusMapping.ui.addressGuide') }}</div>
            <ul class="guide-list">
              <li><b>{{ t('ModbusMapping.ui.guideCoilLabel') }}</b> <code>00001</code>{{ " " + t('ModbusMapping.ui.guideReadPrefix') + " " }}<code>FC01</code>{{ t('ModbusMapping.ui.guideWriteCoilPrefix') + " " }}<code>FC05</code>{{ t('ModbusMapping.ui.guideWriteCoilsPrefix') + " " }}<code>FC15</code>{{ t('ModbusMapping.ui.punctuation1') }}<b>{{ t('ModbusMapping.ui.guideOneBit') }}</b>{{ t('ModbusMapping.ui.guideCoilPackingPrefix') }}<b>{{ t('ModbusMapping.ui.guideCoilPacking') }}</b>{{ t('ModbusMapping.ui.punctuation1') }}</li>
              <li><b>{{ t('ModbusMapping.ui.guideDiscreteLabel') }}</b> <code>10001</code>{{ " " + t('ModbusMapping.ui.guideReadOnlyPrefix') + " " }}<code>FC02</code>{{ t('ModbusMapping.ui.guideDiscreteSuffix') }}</li>
              <li><b>{{ t('ModbusMapping.ui.guideInputLabel') }}</b> <code>30001</code>{{ " " + t('ModbusMapping.ui.guideReadOnlyPrefix') + " " }}<code>FC04</code>{{ t('ModbusMapping.ui.punctuation1') }}<b>{{ t('ModbusMapping.ui.guideWordWidth') }}</b>{{ t('ModbusMapping.ui.guideInputSuffix') }}</li>
              <li><b>{{ t('ModbusMapping.ui.guideHoldingLabel') }}</b> <code>40001</code>{{ " " + t('ModbusMapping.ui.guideReadPrefix') + " " }}<code>FC03</code>{{ t('ModbusMapping.ui.guideWriteRegisterPrefix') + " " }}<code>FC06</code>{{ t('ModbusMapping.ui.guideWriteRegistersPrefix') + " " }}<code>0x10</code>{{ t('ModbusMapping.ui.guideMaskPrefix') + " " }}<code>0x16</code>{{ t('ModbusMapping.ui.guideHoldingSuffix') + " " }}<b>{{ t('ModbusMapping.ui.guideBitsPerAddress') }}</b>{{ t('ModbusMapping.ui.punctuation1') }}</li>
              <li><b>{{ t('ModbusMapping.ui.guideAddressConversion') }}</b>{{ t('ModbusMapping.ui.guideConversionFormula') }}<code>40001</code>{{ " " + t('ModbusMapping.ui.guideConversionExample') + " " }}<code>0</code>{{ t('ModbusMapping.ui.punctuation1') }}</li>
              <li><b>{{ t('ModbusMapping.ui.guideRangeLabel') }}</b>{{ t('ModbusMapping.ui.punctuation2') }}<code>40001-40002</code>{{ " " + t('ModbusMapping.ui.guideTwoWordsPrefix') }}<b>{{ t('ModbusMapping.ui.wordsSuffix', 2) }}</b>{{ t('ModbusMapping.ui.punctuation3') }}<code>00001-00008</code>{{ " " + t('ModbusMapping.ui.guideEightBitsPrefix') }}<b>{{ t('ModbusMapping.ui.bitsSuffix', 8) }}</b>{{ t('ModbusMapping.ui.punctuation1') }}<code>3_0-1</code>{{ " " + t('ModbusMapping.ui.guideEquivalentAnd') + " " }}<code>40001-40002</code>{{ " " + t('ModbusMapping.ui.guideEquivalentSuffix') }}</li>
              <li><b>{{ t('ModbusMapping.ui.slaveLabel') }}</b>{{ t('ModbusMapping.ui.guideSlavePrefix') + " " }}<code>2:40001</code>{{ t('ModbusMapping.ui.punctuation4') }}<code>2:3_0</code>{{ t('ModbusMapping.ui.punctuation1') }}</li>
              <li><b>{{ t('ModbusMapping.ui.guidePlcSoftware') }}</b>{{ t('ModbusMapping.ui.guidePlcSoftwareHint') }}</li>
            </ul>
            <div class="guide-foot">{{ t('ModbusMapping.ui.guideFilterHint') }}</div>
          </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
const props = defineProps<{}>()
const { t } = useI18n()
</script>
<style scoped lang="less" src="./AddressGuide.less" />
