<template>
  <a-popover
    :placement="placement"
    trigger="click"
    :open="visible"
    :overlay-class-name="{
      [warpClassNames]: true,
      'metadata-table-popover-warp': true
    }"
    :overlayStyle="{
      'zIndex': 1070
    }"
    :getPopupContainer="getPopupContainer"
    @visibleChange="null"
  >
    <template #content>
      <div ref="popupContentRef">
        <template v-if="visible">
          <div :style="bodyStyle">
            <slot name="content"/>
          </div>
          <div class="footer">
            <a-space>
              <a-button v-if="showCancel" size="small" @click="cancel">{{ cancelText || $t('Popover.index.047673-0') }}</a-button>
              <a-button v-if="showOk" type="primary" size="small" @click="submit" :loading="confirmLoading">{{ $t('Popover.index.047673-1') }}</a-button>
            </a-space>
          </div>
        </template>
      </div>
    </template>
    <span @click="() => visibleChange(true)">
      <slot />
    </span>
  </a-popover>
</template>

<script setup>
import { useMask } from '../utils'
import {useTableFullScreen} from "../../context";
import {TABLE_WRAPPER} from "../../consts";

defineOptions({ name: 'MetadataPopover' })

const props = defineProps({
  placement: {
    type: String,
    default: 'top'
  },
  confirmLoading: {
    type: Boolean,
    default: false
  },
  showCancel: {
    type: Boolean,
    default: true
  },
  cancelText: {
    type: String,
    default: undefined
  },
  showOk: {
    type: Boolean,
    default: true
  },
  bodyStyle: {
    type: [String, Object],
    default: undefined
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['ok', 'cancel', 'update:visible'])

const fullScreen = useTableFullScreen()
const popupContentRef = ref()

// 避开表格祖先的变换和层叠上下文；原生全屏时弹层必须留在全屏元素内。
const getPopupContainer = () => document.fullscreenElement || document.body
// 弹层内的下拉选项跟随当前弹层，避免落回被遮罩覆盖的表格。
provide(TABLE_WRAPPER, popupContentRef)

const { warpClassNames, visibleChange, visible } = useMask(props.visible, {
  visibleChange(v) {
    emit('update:visible', v)
  }
})

const cancel = () => {
  emit('cancel')
  visibleChange(false)
}

const submit = async () => {
  emit('ok')
}

watch(() => props.visible, (newValue) => {
  visibleChange(newValue)
})

watch(() => fullScreen.value, (val) => {
  // Ant Design Vue 会缓存弹层容器；切换全屏时整体移动，保留其内部 Teleport 锚点。
  const popupContainer = document.querySelector(`.${warpClassNames}`)?.parentElement
  if (popupContainer) getPopupContainer().appendChild(popupContainer)
  if (!val) {
    cancel()
  }
})

</script>

<style scoped lang="less">
.footer {
  display: flex;
  flex-direction: row-reverse;
  margin-top: 8px;
}
</style>

<style lang="less">
.metadata-table-popover-warp {
  .ant-popover-arrow {
    display: none;
  }
}
</style>
