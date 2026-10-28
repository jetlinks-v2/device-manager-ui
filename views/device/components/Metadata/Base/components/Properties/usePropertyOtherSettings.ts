import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { omit, cloneDeep } from 'lodash-es'
import { useProductStore } from '../../../../../../../store/product'
import { useInstanceStore } from '../../../../../../../store/instance'
import { getMetadataConfig, getMetadataDeviceConfig } from '../../../../../../../api/product'
import { useTableWrapper } from '../../../../../../../components/Metadata/context'
import { useMetrics } from './hooks'

interface MetadataSetting {
  property: string
  type?: { type?: string; trueText?: string; trueValue?: unknown; falseText?: string; falseValue?: unknown; elements?: Array<{ text: string; value: unknown }> }
}
interface MetadataSettingGroup { properties: MetadataSetting[] }

/** Owns legacy metadata settings; property rules save independently through the shared editor. */
export function usePropertyOtherSettings(props: Readonly<Record<string, any>>, emit: (event: 'update:value' | 'save', value?: Record<string, any>) => void) {
  const { t: $t } = useI18n()
  const type = inject('_metadataType')

  const productStore = useProductStore()
  const deviceStore = useInstanceStore()
  const tableWrapperRef = useTableWrapper()

  const { metrics, metricsQuery, metricsUpdate } = useMetrics(props)

  const activeKey = ref()
  const metricsRef = ref<any>()
  const myValue = ref(props.value)
  const visible = ref(false)
  const modalVisible = ref(false)

  const config = ref<any>([])
  const configValue = ref(props.value || {})

  const typeMap: Record<string, string> = {
    properties: 'property',
    functions: 'function',
    events: 'event',
    tags: 'tag'
  }

  const showContent = computed(() => props.isProduct
    ? showKeyProperty.value
    : (showKeyProperty.value || showMetrics.value || config.value.length > 0) && props.id)

  const showMetrics = computed(() => {
    return [
      'int',
      'long',
      'float',
      'double',
      'string',
      'boolean',
      'date'
    ].includes(props.type as any)
  })

  // 产品和已独立编辑的设备物模型共用关键属性配置，设备概览只读取当前有效物模型。
  const showKeyProperty = computed(() => {
    return props.metadataType === 'properties'
  })

  const booleanOptions = ref([
    { label: $t('Properties.OtherSetting.237457-22'), value: 'false' },
    { label: $t('Properties.OtherSetting.237457-23'), value: 'true' }
  ])

  const columns = ref([
    {
      title: $t('Properties.OtherSetting.237457-24'),
      dataIndex: 'name',
      width: 150,
      ellipsis: true
    },
    {
      title: $t('Properties.OtherSetting.237457-25'),
      dataIndex: 'type',
      width: 150
    },
    {
      title: $t('Properties.OtherSetting.237457-26'),
      dataIndex: 'value'
    }
  ])

  const popContainer = (e: HTMLElement) => {
    return e
  }

  const getConfig = async () => {
    const id =
      type === 'product' ? productStore.current?.id : deviceStore.current.id

    if (!props.id || !id || !props.type) return

    if (props.type === 'boolean') {
      const booleanValue = props.record.valueType
      booleanOptions.value[0] = {
        label: booleanValue.falseText || $t('Properties.OtherSetting.237457-22'),
        value: booleanValue.falseValue || 'false'
      }
      booleanOptions.value[1] = {
        label: booleanValue.trueText || $t('Properties.OtherSetting.237457-23'),
        value: booleanValue.trueValue || 'true'
      }
    }

    const params: any = {
      deviceId: id,
      metadata: {
        id: props.id,
        type: typeMap[props.metadataType],
        dataType: props.type
      }
    }
    if (!(props.isProduct && props.target === 'device')) {
      const resp =
        type === 'product'
          ? await getMetadataConfig(params)
          : await getMetadataDeviceConfig(params)
      if (resp.success) {
        config.value = resp.result
        if (resp.result.length && !configValue.value) {
          resp.result.forEach((a: MetadataSettingGroup) => {
            if (a.properties) {
              a.properties.forEach((b: MetadataSetting) => {
                configValue.value[b.property] = undefined
              })
            }
          })
        }
      }
    }
    if (config.value.length > 0) {
      activeKey.value = ['store_0']
    } else if (showKeyProperty.value) {
      activeKey.value = ['overview']
    } else if (showMetrics.value) {
      activeKey.value = ['metrics']
    }
    visible.value = true
  }

  const confirm = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let metrics: any
        metrics = await metricsRef.value?.getData()

        const expands = {
          ...(configValue.value || {})
        }

        if (metrics) {
          expands.metrics = metrics
          if (props.target === 'device') {
            // 保存指标
            await metricsUpdate(metrics)
          }
        }

        expands.otherEdit = true
        emit('update:value', {
          ...props.value,
          ...expands
        })
        emit('save')
        modalVisible.value = false
        resolve(true)
      } catch (err) {
        reject(false)
      }
    })
  }

  //获取下拉选择
  const getOptions = (item: MetadataSettingGroup, index: number) => {
    if (item.properties[index].type?.type === 'boolean') {
      return [
        {
          label: item.properties[index].type?.trueText,
          value: item.properties[index].type?.trueValue
        },
        {
          label: item.properties[index].type?.falseText,
          value: item.properties[index].type?.falseValue
        }
      ]
    } else {
      return (item.properties[index].type?.elements || []).map((a) => ({
        label: a.text,
        value: a.value
      }))
    }
  }

  //判断设备接入配置项是否跟物模型字段冲突
  const conflictData = computed(() => {
    let arr: any = []
    if (props.metadataType === 'properties') {
      arr = ['groupId', 'groupName', 'source', 'type', 'virtualRule']
    }
    if (props.metadataType === 'events') {
      arr = ['level']
    }
    return [...arr, 'metrics']
  })

  const _disabled = (_property: any) => {
    return conflictData.value.includes(_property)
  }

  watch(
    () => modalVisible.value,
    async () => {
      if (modalVisible.value) {
        configValue.value = omit(props.value, [
          'source',
          'type',
          'metrics',
          'required'
        ])
        getConfig()
        if (showMetrics.value) {
          metricsQuery()
        }
      }
    },
    { immediate: true }
  )

  const cancel = () => {
    myValue.value = cloneDeep(props.value)
  }

  watch(
    () => JSON.stringify(props.value),
    () => {
      myValue.value = cloneDeep(props.value)
    },
    { immediate: true }
  )
  return { modalVisible, confirm, cancel, showContent, activeKey, visible, config, columns, _disabled, popContainer,
    conflictData, configValue, tableWrapperRef, getOptions, showMetrics, metricsRef, booleanOptions, metrics, showKeyProperty }
}
