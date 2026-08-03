import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { uploadDevicePhoto_api } from '@device-manager-ui/api/device'

export function useIotDeviceImageUpload() {
  const { t: $t } = useI18n()
  const imagePreviewUrl = ref('')
  const imageFileName = ref('')
  const imageUrl = ref('')
  const selectedImageFile = ref<File | null>(null)
  let objectImagePreviewUrl = ''

  function revokeObjectPreview() {
    if (!objectImagePreviewUrl) return
    URL.revokeObjectURL(objectImagePreviewUrl)
    objectImagePreviewUrl = ''
  }

  function setExistingImage(url?: string, fileName = $t('IotDeviceList.currentDeviceImage')) {
    revokeObjectPreview()
    selectedImageFile.value = null
    imageUrl.value = url || ''
    imagePreviewUrl.value = imageUrl.value
    imageFileName.value = imageUrl.value ? fileName : ''
  }

  function handleImageBeforeUpload(file: File) {
    if (!file) {
      clearImage()
      return false
    }
    revokeObjectPreview()
    objectImagePreviewUrl = URL.createObjectURL(file)
    selectedImageFile.value = file
    imageFileName.value = file.name
    imagePreviewUrl.value = objectImagePreviewUrl
    imageUrl.value = ''
    return false
  }

  function clearImage() {
    revokeObjectPreview()
    selectedImageFile.value = null
    imagePreviewUrl.value = ''
    imageFileName.value = ''
    imageUrl.value = ''
  }

  async function resolveImageUrl() {
    if (!selectedImageFile.value) return imageUrl.value
    const accessUrl = await uploadDevicePhoto_api(selectedImageFile.value)
    imageUrl.value = accessUrl
    selectedImageFile.value = null
    revokeObjectPreview()
    imagePreviewUrl.value = accessUrl
    return accessUrl
  }

  return {
    imagePreviewUrl,
    imageFileName,
    imageUrl,
    handleImageBeforeUpload,
    clearImage,
    setExistingImage,
    resolveImageUrl,
  }
}
