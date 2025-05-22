<template>
  <div class="ant-card-hoverable card-box">
    <!-- <a-spin :spinning="loading"> -->
    <div class="card-container">
      <div class="header">
        <div class="title">
          <j-ellipsis>{{ data.name }}</j-ellipsis>
          <div class="title-desc">
            <j-ellipsis>{{ data.id }}</j-ellipsis>
          </div>
        </div>
        <div class="extra" @clicks.stop>
          <a-space :size="16">
            <template v-for="i in actions" :key="i.key">
              <a-tooltip
                  v-bind="i.tooltip"
                  v-if="i.key !== 'edit'"
              >
                <a-button
                    style="padding: 0;"
                    type="link"
                    :disabled="i.disabled"
                    @click.stop="i.onClick && i.onClick(data)"
                >
                  <AIcon
                      :type="i.icon"
                      style="color: #323130; font-size: 12px"
                  />
                </a-button>
              </a-tooltip>
              <j-permission-button
                  :disabled="i.disabled"
                  v-else
                  :popConfirm="i.popConfirm"
                  :tooltip="i.tooltip"
                  @click.stop="i.onClick && i.onClick(slotProps)"
                  type="link"
                  size="small"
                  style="padding: 0;"
              >
                <template #icon
                >
                  <AIcon :type="i.icon" style="color: #323130; font-size: 12px"
                  />
                </template>
              </j-permission-button>
            </template>
          </a-space>
        </div>
      </div>
      <div class="value">
        <ValueRender :data="data" :value="_props.data" type="card"/>
      </div>
      <div class="bottom">
        <div style="color: rgba(0, 0, 0, 0.65); font-size: 12px">
          {{ $t('BasicInfo.indev.028379-6') }}
        </div>
        <div class="time-value">
          {{ _props?.data?.timeString || '--' }}
        </div>
      </div>
    </div>
    <!-- </a-spin> -->
  </div>
</template>

<script lang="ts" setup>
import ValueRender from './ValueRender.vue';

const _props = defineProps({
  data: {
    type: Object,
    default: () => {
    },
  },
  actions: {
    type: Array,
    default: () => [],
  },
});
// const loading = ref<boolean>(true);

// watchEffect(() => {
//     if (_props.data) {
//         console.log(_props.data)
//         // loading.value = false;
//     }
// });
</script>

<style lang="less" scoped>
.card-box {
  background-color: rgba(0, 0, 0, 0.02);
  width: 100%;
  border: 1px solid #f0f0f0;
  padding: 16px;
  border-radius: 2px;

  .card-container {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 173px;
    gap: 10px;

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;

      .title {
        min-width: 0;
        flex: 1;
        font-weight: bold;
        font-size: 16px;

        &-desc {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.65);
        }
      }
    }

    .value {
      color: #323130;
      font-weight: 700;
      font-size: 24px;
      flex: 1;
      min-height: 0;
    }

    .bottom {
      .time-value {
        margin-top: 5px;
        font-size: 16px;
        color: #000;
      }
    }
  }
}
</style>
