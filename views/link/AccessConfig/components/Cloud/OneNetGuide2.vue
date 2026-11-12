<template>
  <GatewayGuide>
    <div
      class="doc"
      style="height: 606px"
    >
      <TitleComponent :data="$t('Cloud.OneNet.808542-43')" />
      <p>{{ $t('Cloud.OneNet.808542-44') }}{{ provider.name }}</p>
      <p>
        {{ provider.description }}
      </p>
      <p>{{ $t('Cloud.OneNet.808542-45') }}{{ procotolCurrent }}</p>
      <TitleComponent :data="$t('Cloud.OneNet.808542-46')" />
      <p>
        {{ $t('Cloud.OneNet.808542-47')
        }}{{ ['OneNet', 'OneNet-platform'].includes(props?.provider?.id) ? 'OneNet' : 'CTWing'
        }}{{ $t('Cloud.OneNet.808542-48') }}
      </p>
      <p>
        {{ $t('Cloud.OneNet.808542-49') }}
        {{
          ['OneNet', 'OneNet-platform'].includes(props?.provider?.id)
            ? 'OneNet'
            : $t('Cloud.OneNet.808542-50')
        }}
      </p>
      <p>
        {{ $t('Cloud.OneNet.808542-51') }}
      </p>
    </div>
  </GatewayGuide>
</template>
<script setup lang="ts">
import { toRefs } from 'vue';
import type { useOneNetEditor } from './useOneNetEditor';
import GatewayGuide from '../GatewayGuide.vue';
const viewProps = defineProps<{
    editor: ReturnType<typeof useOneNetEditor>;
}>();
const editor = viewProps.editor;
const {
  $t, id, procotolCurrent, props
} = editor;
const { provider, data } = toRefs(editor.props);
</script>

<style scoped lang="less" src="./useOneNetEditor.less"></style>
