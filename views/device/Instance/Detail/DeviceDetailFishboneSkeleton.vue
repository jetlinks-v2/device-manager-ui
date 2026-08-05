<template>
  <!-- 标题栏：对齐 device-detail-name-wrap + device-detail-meta（名称/状态一行，ID/产品第二行） -->
  <div v-if="mode === 'title'" class="ddb-fb ddb-fb--title">
    <div class="ddb-fb__spine ddb-fb__spine--title" aria-hidden="true" />
    <div class="ddb-fb__title-main">
      <div class="ddb-fb__title-block">
        <!-- 第一行：头像 + 设备名 + 编辑占位 + 状态（同 .device-detail-name-wrap） -->
        <div class="ddb-fb__name-row">
          <div class="ddb-sk ddb-sk--avatar" />
          <div class="ddb-sk ddb-sk--name" />
          <div class="ddb-sk ddb-sk--edit-btn" />
          <span class="ddb-fb__sep" aria-hidden="true">·</span>
          <div class="ddb-sk ddb-sk--status" />
        </div>
        <!-- 第二行：ID 标签 + 设备 ID + 产品（同 .device-detail-meta，12px / line-height 1.35） -->
        <div class="ddb-fb__meta-row">
          <div class="ddb-sk ddb-sk--meta-label" />
          <div class="ddb-sk ddb-sk--meta-id" />
          <span class="ddb-fb__sep" aria-hidden="true">·</span>
          <div class="ddb-sk ddb-sk--meta-product" />
        </div>
      </div>
    </div>
  </div>

  <!-- 内容区：对齐「运行状态」.property-box — 左 200px 搜索+纵向 Tab，右为筛选+卡片栅格 -->
  <div v-else class="ddb-fb ddb-fb--page">
    <div class="ddb-fb__run-left">
      <div class="ddb-sk ddb-sk--search" />
      <div class="ddb-fb__run-tabs" aria-hidden="true">
        <div
          v-for="i in 6"
          :key="'tab' + i"
          class="ddb-fb__run-tab-row"
          :class="{ 'is-active': i === 1 }"
        >
          <div
            class="ddb-sk ddb-sk--tab-line"
            :style="{ width: tabLineWidths[i - 1] + '%' }"
          />
        </div>
      </div>
    </div>
    <div class="ddb-fb__run-right">
      <div class="ddb-fb__run-toolbar">
        <div class="ddb-sk ddb-sk--segment" />
        <div class="ddb-sk ddb-sk--search-wide" />
      </div>
      <div class="ddb-fb__run-grid">
        <div v-for="i in 8" :key="'c' + i" class="ddb-fb__run-card">
          <div class="ddb-sk ddb-sk--line ddb-sk--w-70" />
          <div class="ddb-sk ddb-sk--line" />
          <div class="ddb-sk ddb-sk--line ddb-sk--w-50" />
          <div class="ddb-fb__run-card-foot">
            <div class="ddb-sk ddb-sk--pill-sm" />
            <div class="ddb-sk ddb-sk--pill-sm" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** title：页头标题区骨架；page：与运行状态 Tab 同构的左右分栏骨架 */
    mode?: 'title' | 'page'
  }>(),
  {
    mode: 'page'
  }
)

/** 左侧纵向 Tab 文案区宽度变化，贴近真实 Tab 标签长短 */
const tabLineWidths = [78, 62, 88, 55, 70, 48]
</script>

<style scoped lang="less">
@keyframes ddb-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.ddb-sk {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.06) 0%,
    rgba(0, 0, 0, 0.09) 50%,
    rgba(0, 0, 0, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: ddb-shimmer 1.35s ease-in-out infinite;
}

.ddb-sk--avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  flex-shrink: 0;
}

.ddb-sk--line {
  height: 12px;
  width: 100%;
}

.ddb-sk--w-45 {
  width: 45%;
  max-width: 280px;
}
.ddb-sk--w-30 {
  width: 30%;
  max-width: 120px;
}
.ddb-sk--w-20 {
  width: 20%;
  max-width: 80px;
}
.ddb-sk--w-50 {
  width: 50%;
}
.ddb-sk--w-55 {
  width: 55%;
}
.ddb-sk--w-60 {
  width: 60%;
}
.ddb-sk--w-70 {
  width: 70%;
}
.ddb-sk--w-85 {
  width: 85%;
}

.ddb-sk--mt {
  margin-top: 2px;
}

/* --- title：与 index.vue .device-detail-name-wrap / .device-detail-meta 尺寸一致 --- */
.ddb-fb--title {
  display: flex;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  width: 100%;
}

.ddb-fb__spine--title {
  width: 3px;
  border-radius: 2px;
  margin-right: 12px;
  background: linear-gradient(
    180deg,
    rgba(22, 119, 255, 0.35) 0%,
    rgba(22, 119, 255, 0.12) 50%,
    rgba(22, 119, 255, 0.28) 100%
  );
  flex-shrink: 0;
  align-self: stretch;
  /* 约 56px 头像行 + 2px meta margin + 第二行 ~14px */
  min-height: 74px;
}

.ddb-fb__title-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ddb-fb__title-block {
  width: 100%;
  min-width: 0;
}

/* 对应 .device-detail-name-wrap：gap 4px 8px，名称 max-width min(100%,480px) */
.ddb-fb__name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
  width: 100%;
}

/* 设备名称：单行省略区域，高度贴近 16~18px 标题字 + line-height 1.35 */
.ddb-sk--name {
  flex: 1 1 auto;
  min-width: 120px;
  max-width: min(100%, 480px);
  height: 22px;
  border-radius: 4px;
}

/* 与 .device-detail-name-action 小按钮接近 */
.ddb-sk--edit-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.ddb-fb__sep {
  opacity: 0.65;
  color: rgba(0, 0, 0, 0.35);
  user-select: none;
  line-height: 1;
  flex-shrink: 0;
}

/* 状态：「状态：」+ badge + 文案，约一行 14px .device-detail-status-text */
.ddb-sk--status {
  width: 148px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* 对应 .device-detail-meta：margin-top 2px; font-size 12px; gap 4px 6px */
.ddb-fb__meta-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 2px;
  min-width: 0;
  width: 100%;
}

/* 「ID」两字占位（12px 字） */
.ddb-sk--meta-label {
  width: 22px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* 设备 ID：可较长，与 .device-detail-meta__id-text 一致 */
.ddb-sk--meta-id {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(100%, 520px);
  height: 14px;
  border-radius: 3px;
}

/* 产品名：.device-detail-meta__product max-width 200px */
.ddb-sk--meta-product {
  width: min(160px, 100%);
  max-width: 200px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* --- page：与 Running/index.vue .property-box 一致 --- */
.ddb-fb--page {
  display: flex;
  align-items: stretch;
  height: 100%;
  min-height: 480px;
  width: 100%;
}

.ddb-fb__run-left {
  width: 200px;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ddb-sk--search {
  width: 200px;
  height: 32px;
  margin-bottom: 10px;
  flex-shrink: 0;
  border-radius: 6px;
}

.ddb-fb__run-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* 贴近 ant-tabs tab-position=left 的竖向列表 */
  padding: 4px 8px 4px 0;
}

.ddb-fb__run-tab-row {
  padding: 10px 12px;
  border-radius: 6px;
  min-height: 40px;
  display: flex;
  align-items: center;

  &.is-active {
    background: rgba(22, 119, 255, 0.06);
  }
}

.ddb-sk--tab-line {
  height: 11px;
  max-width: 100%;
}

.ddb-fb__run-right {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-left: 20px;
  box-sizing: border-box;
}

.ddb-fb__run-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.ddb-sk--segment {
  width: 180px;
  height: 32px;
  border-radius: 6px;
}

.ddb-sk--search-wide {
  width: 300px;
  height: 32px;
  max-width: 100%;
  border-radius: 6px;
}

/* 模拟 JProTable CARD + gridColumns 卡片区 */
.ddb-fb__run-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-content: start;
  padding-bottom: 16px;
  overflow: hidden;
}

@media (min-width: 1200px) {
  .ddb-fb__run-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 900px) and (max-width: 1199px) {
  .ddb-fb__run-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ddb-fb__run-card {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 112px;
}

.ddb-fb__run-card-foot {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.ddb-sk--pill-sm {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}
</style>
