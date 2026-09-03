<template>
  <div
    class="top-card"
    :style="style"
  >
    <a-spin :spinning="loading">
      <div class="top-card-content">
        <div class="content-left">
          <div class="content-left-title">
            <a-space size="small">
              <span>{{ config.topTitle }}</span>
              <a-tooltip
                v-if="config.tooltip"
                placement="top"
              >
                <template #title>
                  <span>{{ config.tooltip }}</span>
                </template>
                <AIcon type="QuestionCircleOutlined" />
              </a-tooltip>
            </a-space>
          </div>
          <div class="content-left-value">{{ data.primary }}</div>
          <div
            v-if="error"
            class="content-status error"
          >
            {{ error }}
          </div>
        </div>
        <div class="content-right">
          <img
            v-if="config.img"
            :src="config.img"
            alt=""
          />
          <div
            v-else
            class="image-placeholder"
          >
            无图片
          </div>
        </div>
      </div>
      <div
        v-if="showFooter"
        class="top-card-footer"
      >
        <a-space>
          <span>{{ config.bottomLeftTitle }}</span>
          <a-badge
            v-if="config.bottomLeftStatus && config.bottomLeftStatus !== 'disabled'"
            :status="config.bottomLeftStatus"
          />
          <div class="footer-item-value">{{ data.secondary }}</div>
        </a-space>
        <a-space>
          <span>{{ config.bottomRightTitle }}</span>
          <a-badge
            v-if="config.bottomRightStatus && config.bottomRightStatus !== 'disabled'"
            :status="config.bottomRightStatus"
          />
          <div class="footer-item-value">{{ data.tertiary }}</div>
        </a-space>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import type { DashboardCardStyle, ImageMetricConfig, ImageMetricData } from '../shared'

withDefaults(
  defineProps<{
    config: ImageMetricConfig
    data: ImageMetricData
    loading?: boolean
    error?: string
    showFooter?: boolean
    style?: DashboardCardStyle
  }>(),
  {
    loading: false,
    error: '',
    showFooter: true,
    style: () => ({})
  }
)
</script>

<style scoped lang="less">
.top-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-sizing: border-box;
}

.top-card-content {
  display: flex;
  justify-content: space-between;
  flex: 1;
  min-height: 0;
}

.content-left {
  flex: 1;
  min-width: 0;
}

.content-left-title {
  color: rgba(0, 0, 0, 0.64);
}

.content-left-value {
  padding: 12px 0;
  color: #323130;
  font-weight: 700;
  font-size: 36px;
  line-height: 1.2;
}

.content-status {
  font-size: 12px;
}

.content-status.error {
  color: #ff4d4f;
}

.content-right {
  width: 92px;
  height: 92px;
  margin-left: 12px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.content-right img,
.image-placeholder {
  width: 92px;
  height: 92px;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.35);
  background: #fafafa;
  border-radius: 8px;
}

.top-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.footer-item-value {
  color: #323130;
  font-weight: 700;
  font-size: 16px;
}
</style>
