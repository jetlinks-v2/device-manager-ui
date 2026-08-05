<template>
  <a-modal
    :maskClosable="false"
    width="680px"
    :open="true"
    :title="$t('Detail.index.957187-41')"
    @ok="handleOk"
    @cancel="handleCancel"
    :confirmLoading="loading"
  >
    <div class="photo-save">
      <div
        class="photo-save__cropper-wrap"
        @wheel.prevent
      >
        <vue-cropper
          ref="cropperRef"
          :img="previewSrc"
          :fixed="false"
          :fixed-box="false"
          :auto-crop="true"
          :auto-crop-width="240"
          :auto-crop-height="240"
          :can-scale="true"
          :can-move-box="true"
          :can-move="true"
          outputType="jpg"
        />
      </div>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watchEffect } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'
import { modifyByDeviceId } from '../../../../api/instance'
import { device } from '../../../../assets'
import { fileUpload } from '@jetlinks-web-core/api/comm'
import 'vue-cropper/dist/index.css'
import { VueCropper } from 'vue-cropper'

const { t: $t } = useI18n()

const emit = defineEmits(['close', 'save'])

const props = defineProps({
  data: {
    type: Object,
    default: undefined
  },
  /**
   * 当外部直接选择了新图片时，优先使用此 src 作为裁剪输入
   */
  imageSrc: {
    type: String,
    default: undefined
  }
})

const loading = ref(false)
const imageError = ref(false)

const modelRef = reactive({
  photoUrl: ''
})

watchEffect(() => {
  const photo =
    props.imageSrc ||
    props.data?.photoUrl ||
    props.data?.devicePhotoUrl ||
    device.deviceCard
  modelRef.photoUrl = photo
  imageError.value = false
})

const previewSrc = computed(() => {
  return imageError.value ? device.deviceCard : modelRef.photoUrl || device.deviceCard
})

const handleCancel = () => {
  emit('close')
}

watchEffect(() => {
  const src = modelRef.photoUrl
  if (!src) return
  // 预加载一次，确保图片不可访问时可以回退默认图
  const img = new Image()
  img.onload = () => {
    imageError.value = false
  }
  img.onerror = () => {
    imageError.value = true
  }
  img.src = src
})

const cropperRef = ref<any>(null)

const handleOk = async () => {
  const deviceId = props.data?.id
  if (!deviceId) {
    emit('close')
    return
  }

  loading.value = true
  try {
    if (!cropperRef.value) {
      loading.value = false
      return
    }

    cropperRef.value.getCropBlob(async (data: Blob) => {
      try {
        const formData = new FormData()
        formData.append('file', data, new Date().getTime() + '.jpg')
        const uploadResp = await fileUpload(formData)

        if (uploadResp?.success) {
          // fileUpload 通常返回 accessUrl（可直接展示）和 id（file 资源标识）
          const photoUrl =
            uploadResp.result?.accessUrl || uploadResp.result?.id || modelRef.photoUrl
          if (!photoUrl) return

          const putResp = await modifyByDeviceId(deviceId, { photoUrl })
          if (putResp?.success) {
            onlyMessage($t('Save.index.902471-16'))
            emit('save')
          }
        }
      } finally {
        loading.value = false
      }
    })
  } catch (e) {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.photo-save {
  padding: 8px 0;
}

.photo-save__cropper-wrap {
  height: 420px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  :deep(.cropper-container) {
    width: 100%;
  }
}

</style>
