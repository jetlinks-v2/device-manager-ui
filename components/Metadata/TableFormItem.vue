<template>
  <a-tooltip
    v-if="errorMap.visible"
    color="#ffffff"
    :get-popup-container="popContainer"
    :arrowPointAtCenter="true"
  >
    <template #title>
      <span style="color: #1d2129">{{errorMap.message}}</span>
    </template>
    <div class="table-form-error-target" ></div>
  </a-tooltip>
  <div :id="eventKey" style="position: relative" :class="{'edit-table-form-has-error': errorMap.message }">
    <slot></slot>
  </div>
</template>

<script setup name="TableFormItem">
import {useInjectError, useInjectForm, useTableWrapper} from "./context";
import {get, isArray } from 'lodash-es'
import {onBeforeUnmount, computed} from "vue";
import { useProvideFormItemContext } from 'ant-design-vue/es/form/FormItemContext'
import {TABLE_FORM_ITEM_ERROR} from "./consts";

const props = defineProps({
  name: {
    type: [String, Array],
    default: undefined
  },
  required: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['change'])

const tableWrapperRef = useTableWrapper()
const context = useInjectForm()
const globalErrorMessage = useInjectError()

let hideTimer

const eventKey = computed(() => {
  const names = isArray(props.name) ? props.name : [props.name]
  return names.join('-')
})

const errorMap = reactive({
  message: '',
  visible: false
})

const filedId = computed(() => {
  const names = isArray(props.name) ? props.name : [props.name]
  return names.join('_')
})

const filedName = computed(() => {
  const names = isArray(props.name) ? props.name : [props.name]
  const _rules = context.rules.value
  let tempKey = undefined

  for (const key of names) {
    if (key in _rules) {
      tempKey = key
    }
  }

  return tempKey
})

const filedValue = computed(() => {
  return get(context.dataSource.value, props.name)
})

provide(TABLE_FORM_ITEM_ERROR, errorMap)

const popContainer = (e) => {
  return e
}

const removeTimer = () => {
  if (hideTimer) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
}
const showErrorTip = (msg) => {
  removeTimer()
  errorMap.message = msg
  errorMap.visible = true
}

const hideErrorTip = () => {
  errorMap.visible = false
  removeTimer()
  hideTimer = setTimeout(() => {
    errorMap.message = ''
  }, 300)
}
const validateRules = () => {
  let index = 0
  if (isArray(props.name)) {
    index = props.name[0]
  }

  const promise = context.validateItem({ [filedName.value]: get(context.dataSource.value, props.name) }, index)
  promise.then(() => {
    hideErrorTip()
    context.removeFieldError(eventKey.value)
  }).catch(res => {
    const error = res?.filter(item => item.field === filedName.value) || []
    if (error.length === 0) {
      hideErrorTip()
      context.removeFieldError(eventKey.value)
    } else {
      removeTimer()
      errorMap.message = error[0]?.message || errorMap.message
      errorMap.visible = !!error.length
      context.addFieldError(eventKey.value, errorMap.message)
    }
    return errorMap.message
  })

  return promise
}

const onFieldBlur = () => {
  // validateRules()
}

const onFieldChange = () => {
  validateRules()
  emit('change')
}

watch(() => globalErrorMessage.value, (val) => {
  if (val[eventKey.value]) {
    showErrorTip(val[eventKey.value])
  } else {
    hideErrorTip()
  }
}, { immediate: true, deep: true})

useProvideFormItemContext({
  id: filedId,
  onFieldChange,
  onFieldBlur,
}, computed(() => get(context.dataSource.value, props.name)))

onBeforeUnmount(() => {
  hideErrorTip()
  // context.removeField(eventKey.value)
})

watch(() => [filedName.value, props.name], () => {
  context.addField(eventKey.value, {
    filedName: filedName.value,
    eventKey: eventKey.value,
    names: props.name,
    validateRules,
    showErrorTip
  })
}, { immediate: true })

</script>

<style scoped lang="less">
.table-form-error-target {
  position: absolute;
  right: 2px;
  top: -9px;
  border: 16px solid transparent;
  border-top-color: @error-color;
  border-right-width: 0;
  border-bottom-width: 0;
}
</style>

<style lang="less">
.edit-table-form-has-error {

  .select-no-value {
    .ant-select-selector {
      border-color: @error-color !important;
      &:focus {
        box-shadow: 0 0 0 2px var(--ant-error-color-outline) !important;
      }
    }
  }

  > input {
    border-color: @error-color !important;

    &:focus {
      box-shadow: 0 0 0 2px var(--ant-error-color-outline) !important;
    }
  }

  .table-form-required-aicon {
    color: @error-color;
  }
}
</style>
