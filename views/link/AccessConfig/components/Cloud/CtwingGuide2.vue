<template>
  <GatewayGuide>
    <div
      class="doc"
      style="height: 606px"
    >
      <TitleComponent :data="$t('Cloud.Ctwing.076179-29')" />
      <p>{{ $t('Cloud.Ctwing.076179-30') }}{{ provider.name }}</p>
      <p>
        {{ provider.description }}
      </p>
      <p>{{ $t('Cloud.Ctwing.076179-31') }}{{ protocolCurrent }}</p>
      <TitleComponent :data="$t('Cloud.Ctwing.076179-32')" />
      <p>
        {{ $t('Cloud.Ctwing.076179-33') }}{{ props?.provider?.id === 'OneNet' ? 'OneNet' : 'CTWing'
        }}{{ $t('Cloud.Ctwing.076179-34') }}
      </p>
      <p>
        {{ $t('Cloud.Ctwing.076179-35') }}
        {{ props?.provider?.id === 'OneNet' ? 'OneNet' : $t('Cloud.Ctwing.076179-36') }}
      </p>
      <p>
        {{ $t('Cloud.Ctwing.076179-37') }}
      </p>
    </div>
  </GatewayGuide>
</template>
<script setup lang="ts">
import { toRefs } from 'vue';
import type { useCtwingEditor } from './useCtwingEditor';
import GatewayGuide from '../GatewayGuide.vue';
const viewProps = defineProps<{
    editor: ReturnType<typeof useCtwingEditor>;
}>();
const editor = viewProps.editor;
const {
  $t, id, protocolCurrent, props
} = editor;
const { provider, data } = toRefs(editor.props);
</script>

<style scoped lang="less" src="./useCtwingEditor.less"></style>
