<template>
  <PopoverModal
      v-model:visible="visible"
      :placement="placement"
      @ok="onOk"
      @cancel="onCancel"
  >
    <template #content>
      <div style="width: 250px">
        <a-form ref="formRef" :model="formData" layout="vertical">
          <Type v-model:value="formData.bodyType" name="bodyType"/>
          <a-form-item
              name="fileType"
              :rules="[{ required: true, message: $t('File.Type.998289-3') }]"
          >
            <template #label>
              <span>
                        {{$t('File.Type.998289-2')}}
                        <a-tooltip :title="$t('File.Type.998289-4')">
                            <AIcon
                                type="QuestionCircleOutlined"
                                style="margin-left: 2px"
                            />
                        </a-tooltip>
                    </span>
            </template>
            <a-auto-complete
                v-model:value="formData.fileType"
                :options="typeOptions"
                :dropdownStyle="{zIndex: 1999}"
                :getPopupContainer="(node) => tableWrapperRef || node"
            >
              <a-input :placeholder="$t('File.Type.998289-3')" maxLength="64"/>
            </a-auto-complete>
          </a-form-item>
        </a-form>
      </div>
    </template>
    <slot>
      <a-button type="link" :disabled="disabled" style="padding: 0">
        <template #icon>
          <AIcon type="EditOutlined" :class="{'table-form-required-aicon': !value}"/>
        </template>
      </a-button>
    </slot>
  </PopoverModal>
</template>

<script setup name="MetadataFile">
import Type from './Type.vue'
import {PopoverModal} from '../index'
import {Form} from "ant-design-vue";
import {useTableWrapper} from "@device/components/Metadata/context";

const emit = defineEmits(['update:value', 'confirm', 'cancel']);
const props = defineProps({
  value: {
    type: Object,
    default: () => ({bodyType: undefined, fileType: undefined}),
  },
  placement: {
    type: String,
    default: 'top',
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const formItemContext = Form.useInjectFormItemContext();
const tableWrapperRef = useTableWrapper()
const formRef = ref();
const formData = reactive({
  bodyType: undefined,
  fileType: undefined
});

const visible = ref(false)

const typeOptions = [
  {
    "value": "文档",
    "label": "文档",
    "options": [
      {"label": ".pdf", "value": ".pdf"},
      {"label": ".doc", "value": ".doc"},
      {"label": ".docx", "value": ".docx"},
      {"label": ".xls", "value": ".xls"},
      {"label": ".xlsx", "value": ".xlsx"},
      {"label": ".ppt", "value": ".ppt"},
      {"label": ".pptx", "value": ".pptx"},
      {"label": ".txt", "value": ".txt"},
      {"label": ".rtf", "value": ".rtf"},
      {"label": ".csv", "value": ".csv"},
      {"label": ".json", "value": ".json"},
      {"label": ".xml", "value": ".xml"},
      {"label": ".odt", "value": ".odt"},
      {"label": ".epub", "value": ".epub"}
    ]
  },
  {
    "value": "图像",
    "label": "图像",
    "options": [
      {"label": ".jpg", "value": ".jpg"},
      {"label": ".jpeg", "value": ".jpeg"},
      {"label": ".png", "value": ".png"},
      {"label": ".gif", "value": ".gif"},
      {"label": ".webp", "value": ".webp"},
      {"label": ".bmp", "value": ".bmp"},
      {"label": ".svg", "value": ".svg"},
      {"label": ".psd", "value": ".psd"},
      {"label": ".ai", "value": ".ai"},
      {"label": ".eps", "value": ".eps"}
    ]
  },
  {
    "value": "音频",
    "label": "音频",
    "options": [
      {"label": ".mp3", "value": ".mp3"},
      {"label": ".wav", "value": ".wav"},
      {"label": ".aac", "value": ".aac"},
      {"label": ".ogg", "value": ".ogg"},
      {"label": ".flac", "value": ".flac"},
      {"label": ".midi", "value": ".midi"}
    ]
  },
  {
    "value": "视频",
    "label": "视频",
    "options": [
      {"label": ".mp4", "value": ".mp4"},
      {"label": ".mov", "value": ".mov"},
      {"label": ".avi", "value": ".avi"},
      {"label": ".mkv", "value": ".mkv"},
      {"label": ".webm", "value": ".webm"},
      {"label": ".flv", "value": ".flv"},
      {"label": ".mpeg", "value": ".mpeg"}
    ]
  },
  {
    "value": "文件压缩",
    "label": "文件压缩",
    "options": [
      {"label": ".zip", "value": ".zip"},
      {"label": ".rar", "value": ".rar"},
      {"label": ".7z", "value": ".7z"},
      {"label": ".tar.gz", "value": ".tar.gz"}
    ]
  },
  {
    "value": "代码与编程",
    "label": "代码与编程",
    "options": [
      {"label": ".html", "value": ".html"},
      {"label": ".htm", "value": ".htm"},
      {"label": ".css", "value": ".css"},
      {"label": ".js", "value": ".js"},
      {"label": ".py", "value": ".py"},
      {"label": ".java", "value": ".java"},
      {"label": ".class", "value": ".class"}
    ]
  },
  {
    "value": "可执行文件",
    "label": "可执行文件",
    "options": [
      {"label": ".exe", "value": ".exe"},
      {"label": ".apk", "value": ".apk"},
      {"label": ".dmg", "value": ".dmg"},
      {"label": ".sh", "value": ".sh"}
    ]
  }
]


const onOk = async () => {
  const data = await formRef.value.validate()
  if (data) {
    visible.value = false
    const dt = {...props.value, ...formData}
    emit('update:value', dt)
    emit('onOk', dt)
    formItemContext.onFieldChange()
  }
}

const onCancel = () => {
  formRef.value?.resetFields();
  formData.bodyType = props.value.bodyType;
  formData.fileType = props.value.fileType;
  emit('cancel');
}

watch(
    () => props.value,
    () => {
      formData.bodyType = props.value.bodyType;
      formData.fileType = props.value.fileType;
    },
    {
      immediate: true,
      deep: true
    }
);
</script>

<style scoped>

</style>
