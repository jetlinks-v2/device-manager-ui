<template>
  <GatewayGuide>
    <j-scrollbar height="500">
      <div class="doc">
        <h1>{{ $t('Cloud.Ctwing.076179-7') }}</h1>
        <div>
          {{ $t('Cloud.Ctwing.076179-8') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img1"
          />
        </div>
        <div>
          {{ $t('Cloud.Ctwing.076179-9') }}
          <!-- <div
                                    class="url"
                                    style="word-wrap: break-word"
                                >
                                    {{
                                        `${origin}/api/ctwing/${randomString()}/notify`
                                    }}
                                </div> -->
        </div>
        <div>
          {{ $t('Cloud.Ctwing.076179-10') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img2"
          />
        </div>
        <div>
          {{ $t('Cloud.Ctwing.076179-11') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img3"
          />
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img4"
          />
        </div>
        <a-descriptions
          bordered
          size="small"
          :column="1"
          :labelStyle="{ width: '100px' }"
        >
          <a-descriptions-item :label="$t('Cloud.Ctwing.076179-12')">
            {{ $t('Cloud.Ctwing.076179-5') }}
          </a-descriptions-item>
          <a-descriptions-item label="IMEI">{{ $t('Cloud.Ctwing.076179-13') }}</a-descriptions-item>
          <a-descriptions-item label="SN">
            {{ $t('Cloud.Ctwing.076179-14') }}
          </a-descriptions-item>
          <a-descriptions-item label="IMSI">
            {{ $t('Cloud.Ctwing.076179-15') }}
          </a-descriptions-item>
          <a-descriptions-item label="PSK">
            {{ $t('Cloud.Ctwing.076179-16') }}
          </a-descriptions-item>
        </a-descriptions>
        <div class="overLength">
          {{ $t('Cloud.Ctwing.076179-17') }} {{ `${origin}/api/ctwing/${randomString()}/notify`
          }}{{ $t('Cloud.Ctwing.076179-18') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img5"
          />
        </div>
        <div>
          {{ $t('Cloud.Ctwing.076179-19') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img6"
          />
        </div>
        <h1>
          {{ $t('Cloud.Ctwing.076179-20') }}
        </h1>
        <div>
          {{ $t('Cloud.Ctwing.076179-21') }}
        </div>
      </div>
    </j-scrollbar>
  </GatewayGuide>
</template>
<script setup lang="ts">
import type { useCtwingEditor } from './useCtwingEditor';
import GatewayGuide from '../GatewayGuide.vue';
const viewProps = defineProps<{
    editor: ReturnType<typeof useCtwingEditor>;
}>();
const editor = viewProps.editor;
const {
  randomString, $t, origin, img1, img2, img3, img4, img5, img6
} = editor;
</script>

<style scoped lang="less" src="./useCtwingEditor.less"></style>
