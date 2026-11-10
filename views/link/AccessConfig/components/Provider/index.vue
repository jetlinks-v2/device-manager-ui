<template>
  <a-config-provider :auto-insert-space-in-button="false">
  <div class="gateway-provider">
    <section
      v-for="group in groups"
      :key="group.title"
      class="gateway-provider__group"
    >
      <h3 class="gateway-provider__heading">{{ group.title }}</h3>
      <a-row :gutter="[16, 16]">
        <a-col
          v-for="item in group.list"
          :key="item.id"
          :xs="24"
          :md="12"
          :xl="12"
        >
          <a-card
            hoverable
            size="small"
            class="gateway-provider__card"
            @click="emit('onClick', item)"
          >
            <a-flex
              align="center"
              :gap="16"
            >
              <img class="gateway-provider__icon" :src="BackMap.get(item.id)" alt="" />
              <div class="gateway-provider__text">
                <strong>{{ item.name }}</strong>
                <a-tooltip :title="item.description">
                  <a-typography-paragraph
                    type="secondary"
                    :ellipsis="{ rows: 2 }"
                    :content="item.description || '—'"
                  />
                </a-tooltip>
              </div>
              <a-button type="primary" size="small" @click.stop="emit('onClick', item)">{{ $t('GatewayEditor.access') }}</a-button>
            </a-flex>
          </a-card>
        </a-col>
      </a-row>
    </section>
    <CloudEmpty
      v-if="!groups.length"
      :search-name="$t('GatewayEditor.method')"
    />
  </div>
  </a-config-provider>
</template>
<script setup lang="ts" name="AccessConfigProvider">
import { computed } from 'vue'
import { BackMap } from '../../data'
interface Provider { id: string; name: string; description?: string; type?: string }
const props = withDefaults(defineProps<{ dataSource?: { title: string; list: Provider[] }[] }>(), { dataSource: () => [] })
const emit = defineEmits<{ onClick: [provider: Provider] }>()
const order = ['mqtt-server-gateway', 'composite-device-gateway', 'websocket-server', 'coap-server-gateway',
  'plugin_gateway', 'tcp-server-gateway', 'child-device', 'http-server-gateway', 'udp-device-gateway', 'mqtt-client-gateway',
  'media-plugin', 'fixed-media', 'onvif', 'gb28181-2016', 'OneNet-platform', 'Ctwing', 'OneNet']
const rank = (id: string) => { const index = order.indexOf(id); return index < 0 ? order.length : index }
const groups = computed(() => props.dataSource.map(group => ({ ...group,
  list: [...group.list].sort((a, b) => rank(a.id) - rank(b.id)),
})).filter(group => group.list.length))
</script>
<style scoped>
.gateway-provider { max-height: min(560px, calc(100vh - 160px)); overflow-y: auto; overflow-x: hidden; padding: 0 var(--space-2); }
.gateway-provider__group { margin-bottom: var(--space-6); }
.gateway-provider__heading { font-size: var(--fs-14); font-weight: 600; border-left: 3px solid var(--primary-color); padding-left: var(--space-2); margin-bottom: var(--space-3); }
.gateway-provider__card { height: 100%; border-radius: var(--r-3); }
.gateway-provider__card:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
.gateway-provider__icon { display: block; flex: 0 0 5rem; width: 5rem; height: 5rem; object-fit: contain; }
.gateway-provider__text { flex: 1; min-width: 0; }
.gateway-provider__text strong { display: block; margin-bottom: var(--space-2); font-weight: var(--chrome-label-font-weight); }
.gateway-provider__text .ant-typography { font-size: var(--fs-12); line-height: 1.5;  margin-bottom: 0; }
</style>
