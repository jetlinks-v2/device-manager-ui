<template>
  <GatewayGuide>
    <j-scrollbar height="500">
      <div class="doc">
        <h1>{{ $t('Cloud.OneNet.808542-12') }}</h1>
        <div>
          {{ $t('Cloud.OneNet.808542-13') }}
        </div>
        <div>
          {{ $t('Cloud.OneNet.808542-14') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img5"
          />
        </div>
        <div>
          {{ $t('Cloud.OneNet.808542-15') }}
        </div>
        <div>
          {{ $t('Cloud.OneNet.808542-16') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img6"
          />
          <div class="desc">{{ $t('Cloud.OneNet.808542-17') }}</div>
        </div>
        <div>
          {{ $t('Cloud.OneNet.808542-18') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img7"
          />
        </div>
        <h1>{{ $t('Cloud.OneNet.808542-19') }}</h1>
        <div>
          {{ $t('Cloud.OneNet.808542-20') }}
          <b>{{ $t('Cloud.OneNet.808542-21') }}</b>
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img8"
          />
        </div>
        <div>
          {{ $t('Cloud.OneNet.808542-22') }}
        </div>
        <div class="image">
          <a-image
            width="100%"
            :src="img9"
          />
        </div>
        <a-descriptions
          bordered
          size="small"
          :column="1"
          :labelStyle="{ width: '100px' }"
        >
          <a-descriptions-item :label="$t('Cloud.OneNet.808542-23')">
            {{ $t('Cloud.OneNet.808542-10') }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('Cloud.OneNet.808542-24')">
            {{ $t('Cloud.OneNet.808542-25') }}
            <div style="word-wrap: break-word">
              {{ `${origin}/api/one-net/${randomString()}/notify` }}
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="Token">
            {{ $t('Cloud.OneNet.808542-26') }}
          </a-descriptions-item>
          <a-descriptions-item label="AESKey">
            {{ $t('Cloud.OneNet.808542-27') }}
          </a-descriptions-item>
        </a-descriptions>

        <a-alert
          :message="$t('Cloud.OneNet.808542-28')"
          style="margin-top: 15px"
          type="warning"
        >
          <template #description>
            <span>
              {{ $t('Cloud.OneNet.808542-29') }}
              <span style="color: red">validate fail: validate token fail.</span>
            </span>
          </template>
        </a-alert>

        <h1>{{ $t('Cloud.OneNet.808542-30') }}</h1>

        <a-descriptions
          bordered
          size="small"
          :column="1"
          :labelStyle="{ width: '100px' }"
        >
          <a-descriptions-item :label="$t('Cloud.OneNet.808542-23')">
            {{ $t('Cloud.OneNet.808542-10') }}
          </a-descriptions-item>
          <a-descriptions-item label="apiKey">{{ $t('Cloud.OneNet.808542-31') }}</a-descriptions-item>
          <a-descriptions-item :label="$t('Cloud.OneNet.808542-6')">
            {{ $t('Cloud.OneNet.808542-32') }}
          </a-descriptions-item>
          <a-descriptions-item label="aesKey">
            {{ $t('Cloud.OneNet.808542-33') }}
          </a-descriptions-item>
        </a-descriptions>
        <h1>{{ $t('Cloud.OneNet.808542-34') }}</h1>
        <div>
          {{ $t('Cloud.OneNet.808542-35') }}
        </div>
      </div>
    </j-scrollbar>
  </GatewayGuide>
</template>
<script setup lang="ts">
import type { useOneNetEditor } from './useOneNetEditor';
import GatewayGuide from '../GatewayGuide.vue';
const viewProps = defineProps<{
    editor: ReturnType<typeof useOneNetEditor>;
}>();
const editor = viewProps.editor;
const {
  randomString, $t, origin, img5, img6, img7, img8, img9
} = editor;
</script>

<style scoped lang="less" src="./useOneNetEditor.less"></style>
