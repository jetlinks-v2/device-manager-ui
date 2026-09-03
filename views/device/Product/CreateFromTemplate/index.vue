<!-- 按模板创建产品弹窗 - 分步骤 -->
<template>
  <a-modal
    :title="$t('Product.index.660348-35') || '按模板新增'"
    open
    width="1200px"
    :maskClosable="false"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <!-- 步骤条 -->
    <a-steps :current="currentStep" @change="handleStepChange">
      <a-step>
        <template #title>选择模板</template>
      </a-step>
      <a-step>
        <template #title>填写信息</template>
      </a-step>
    </a-steps>
    <a-divider style="margin-bottom: 0px" />

    <!-- 步骤内容 -->
    <div class="steps-content">
      <!-- 第一步：选择模板 -->
      <div v-if="currentStep === 0" class="choose-template">
        <div class="choose-template__left">
          <a-select
            v-model:value="tagCategoryId"
            placeholder="请选择标签分类"
            :options="tagCategoryOptions"
            style="width: 100%; margin-bottom: 12px"
            allow-clear
            @change="onTagCategoryChange"
          />

          <a-tree
            :tree-data="tagTree"
            :fieldNames="{ title: 'name', key: 'key', children: 'children' }"
            :selectedKeys="selectedTagId ? [selectedTagId] : []"
            blockNode
            defaultExpandAll
            @select="onTagSelect"
          />
        </div>

        <div class="choose-template__right">
          <pro-search
            :columns="searchColumns"
            target="templateModal"
            @search="handleSearch"
            type="simple"
            style="padding: 0; margin-bottom: 12px"
          />
          <j-pro-table
            ref="tableRef"
            mode="TABLE"
            :columns="templateColumns"
            :request="queryTemplateList"
            :defaultParams="{
              sorts: [{ name: 'createTime', order: 'desc' }],
            }"
            :params="params"
            :rowSelection="rowSelection"
          >
            <template #description="slotProps">
              <j-ellipsis>{{ slotProps.description || slotProps.describe || '-' }}</j-ellipsis>
            </template>
          </j-pro-table>
        </div>
      </div>

      <!-- 第二步：填写产品信息 -->
      <div v-else-if="currentStep === 1" class="product-form">
        <a-form
          layout="vertical"
          :model="productForm"
          :rules="rules"
          ref="formRef"
        >
          <a-row type="flex">
            <a-col flex="180px">
              <a-form-item name="photoUrl">
                <pro-upload
                  v-model="productForm.photoUrl"
                  :accept="imageTypes.toString()"
                />
              </a-form-item>
            </a-col>
            <a-col flex="auto">
              <a-form-item name="id" :validateFirst="true">
                <template #label>
                  <span>ID</span>
                  <a-tooltip :title="$t('Save.index.912481-2')">
                    <AIcon
                      type="QuestionCircleOutlined"
                      style="margin-left: 2px"
                    />
                  </a-tooltip>
                </template>
                <a-input
                  v-model:value="productForm.id"
                  :placeholder="$t('Save.index.912481-3')"
                />
              </a-form-item>
              <a-form-item :label="$t('Save.index.912481-4')" name="name">
                <a-input
                  v-model:value="productForm.name"
                  :placeholder="$t('Save.index.912481-5')"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item :label="$t('Save.index.912481-8')" name="deviceType">
              <j-card-select
                  v-model:value="productForm.deviceType"
                  :options="deviceList"
                  @change="changeDeviceType"
              >
                  <template #itemRender="{node}">
                      <div class="select-item">
                          <div>
                              <span>{{ node.label }}</span>
                              <a-tooltip :title="node.tooltip"
                                  ><AIcon
                                      type="QuestionCircleOutlined"
                                      style="margin-left: 2px"
                                  />
                              </a-tooltip>
                          </div>
                          <img :src="node.iconUrl" alt="">
                      </div>
                  </template>
              </j-card-select>
          </a-form-item>
          <a-form-item :label="$t('Save.index.912481-9')" name="describe">
            <a-textarea
              :maxlength="200"
              showCount
              :auto-size="{ minRows: 4, maxRows: 5 }"
              v-model:value="productForm.describe"
              :placeholder="$t('Save.index.912481-10')"
            />
          </a-form-item>
        </a-form>
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="steps-action">
        <a-button v-if="currentStep === 0" @click="handleCancel">
          {{ $t('Save.index.912481-1') || '取消' }}
        </a-button>
        <a-button v-else @click="handlePrev">
          {{ '上一步' }}
        </a-button>
        <a-button
          type="primary"
          v-if="currentStep < 1"
          @click="handleNext"
        >
          {{ '下一步' }}
        </a-button>
        <a-button
          type="primary"
          v-else
          @click="handleOk"
          :loading="loading"
        >
          {{ $t('Save.index.912481-0') || '确定' }}
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, computed } from 'vue'
import { queryTemplateList, getTemplateDetail } from '../../../../api/template'
import { queryTagCategoryNoPaging, queryTagTree } from '../../../../api/tag'
import { category, getProviders, queryGatewayList, queryProductId, addProduct } from '../../../../api/product'
import { device } from '../../../../assets'
import { onlyMessage, accessConfigTypeFilter } from '@jetlinks-web-core/utils/comm'
import { isInput } from '@device-manager-ui/utils/utils'
import type { TemplateItem } from '../../Template/typings'
import type { Rule } from 'ant-design-vue/es/form'
import { accessType } from '../../data'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

type Emit = {
  (e: 'success'): void
  (e: 'cancel'): void
}

const emit = defineEmits<Emit>()

const loading = ref(false)
const currentStep = ref(0)
const tableRef = ref()
const formRef = ref()

const tagCategoryId = ref<string>()
const tagCategoryOptions = ref<{ label: string; value: string }[]>([])
const tagTree = ref<any[]>([])
// a-tree 的 key 通常要求 string | number，这里统一用 string
const selectedTagId = ref<string>()

const params = ref<Record<string, any>>({
  pageSize: 4,
  terms: [
    {
      column: 'state',
      termType: 'eq',
      value: 'enabled'
    }
  ],
})

// 搜索表单产生的 terms（不包含 state/tag-bind，由我们统一合并）
const searchTerms = ref<any[]>([])

const buildTerms = () => {
  const base = [
    {
      column: 'state',
      termType: 'eq',
      value: 'enabled',
    },
  ]

  // const tagBind = selectedTagId.value
  //   ? [
  //       {
  //         column: 'id$tag-bind',
  //         value: [
  //           { column: 'tagId', termType: 'eq', value: selectedTagId.value },
  //           { column: 'targetType', termType: 'eq', value: 'product-template' },
  //         ],
  //       },
  //     ]
  //   : []

    const tagBind = selectedTagId.value
    ? [
        {
          column: 'id$tag-bind',
          value: [
            { column: 'tagId$common-tag-child', value: [selectedTagId.value] },
            { column: 'targetType', termType: 'eq', value: 'product-template' },
          ],
        },
      ]
    : []

  return [...base, ...(searchTerms.value || []), ...tagBind]
}

const reloadTable = () => {
  params.value.terms = buildTerms()
  tableRef.value?.reload?.()
}

const clearTagSelection = () => {
  tagTree.value = []
  selectedTagId.value = undefined
  normalizeSelectedTagId()
}

const applyTemplateTagFilter = (tagId?: string) => {
  selectedTagId.value = tagId ? String(tagId) : undefined
  normalizeSelectedTagId()
  reloadTable()
}

const handleSearch = (e: any) => {
  searchTerms.value = e?.terms || []
  reloadTable()
}

const onTagSelect = (keys: any) => {
  const key = Array.isArray(keys) ? keys[0] : keys
  selectedTagId.value = key ? String(key) : undefined
  normalizeSelectedTagId()
  reloadTable()
}

const onTagCategoryChange = async () => {
  if (!tagCategoryId.value) {
    clearTagSelection()
    reloadTable()
    return
  }
  selectedTagId.value = undefined
  await loadTagTree()
  selectFirstTagInTree()
}

// (旧的 selectFirstTagInTree/loadTagCategories/fillTreeKey/normalizeSelectedTagId/loadTagTree 已移除，避免重复定义与递归触发)

const selectFirstTagInTree = () => {
  const first = tagTree.value?.[0]
  if (!first?.id) {
    selectedTagId.value = undefined
    normalizeSelectedTagId()
    reloadTable()
    return
  }
  selectedTagId.value = String(first.id)
  normalizeSelectedTagId()
  reloadTable()
}

const loadTagCategories = async () => {
  const res: any = await queryTagCategoryNoPaging({ paging: false, sorts: [{ name: 'sortIndex', order: 'asc' }] })
  if (res.status === 200) {
    const list = res.result || []
    tagCategoryOptions.value = list.map((i: any) => ({ label: i.name, value: i.id }))

    // 初始化：默认选择第一个标签分类，并加载对应标签树
    if (!tagCategoryId.value && tagCategoryOptions.value.length) {
      tagCategoryId.value = tagCategoryOptions.value[0].value
      await loadTagTree()
      selectFirstTagInTree()
    }
  }
}

const fillTreeKey = (arr: any[]) => {
  ;(arr || []).forEach((n: any) => {
    n.id = String(n.id)
    n.key = String(n.id)
    if (n.value !== undefined && n.value !== null) {
      n.value = n.key
    }
    if (n.children?.length) fillTreeKey(n.children)
  })
}

const normalizeSelectedTagId = () => {
  if (selectedTagId.value !== undefined && selectedTagId.value !== null) {
    selectedTagId.value = String(selectedTagId.value)
  }
}

const loadTagTree = async () => {
  if (!tagCategoryId.value) {
    tagTree.value = []
    return
  }
  const res: any = await queryTagTree({ terms: [{ column: 'categoryId', value: tagCategoryId.value }] })
  if (res.status === 200) {
    tagTree.value = res.result || []
    fillTreeKey(tagTree.value)
  }
}


// 初始化加载放到 show() 中，避免模块加载时机不一致
// loadTagCategories()

const deviceList = ref([
    {
        label: $t('Save.index.912481-11'),
        value: 'device',
        iconUrl: device.deviceType1,
        tooltip: $t('Save.index.912481-12'),
    },
    {
        label: $t('Save.index.912481-13'),
        value: 'childrenDevice',
        iconUrl: device.deviceType2,
        tooltip: $t('Save.index.912481-14'),
    },
    {
        label: $t('Save.index.912481-15'),
        value: 'gateway',
        iconUrl: device.deviceType3,
        tooltip: $t('Save.index.912481-16'),
    },
]);

const changeDeviceType = (value: Array<string>) => {
    productForm.deviceType = value[0];
};

const selectedTemplate = ref<TemplateItem>()

// j-pro-table 的 rowSelection 对 ref 解包不稳定，这里用 computed 确保传入的是普通对象
const rowSelection = computed(() => ({
  selectedRowKeys: selectedTemplate.value?.id ? [selectedTemplate.value.id] : [],
  onChange: (keys: string[], rows: any[]) => {
    if (rows && rows.length) {
      selectedTemplate.value = rows[0]
      return
    }
    if (!keys || keys.length === 0) {
      selectedTemplate.value = undefined
    }
  },
  type: 'radio',
}))

const typeList = ref([])

const imageTypes = reactive([
  'image/jpeg',
  'image/png',
  'image/jfif',
  'image/pjp',
])

// 产品表单
const productForm = reactive({
  id: undefined,
  name: '',
  photoUrl: device.deviceProduct,
  deviceType: '',
  describe: undefined,
})

/**
 * 校验id
 */
const validateInput = async (_rule: Rule, value: string) => {
  if (value) {
    if (!isInput(value)) {
      return Promise.reject($t('Save.index.912481-17'))
    } else {
      const res = await queryProductId(value)
      if (res.success && res.result) {
        return Promise.reject($t('Save.index.912481-18'))
      } else {
        return Promise.resolve()
      }
    }
  } else {
    return Promise.resolve()
  }
}

const rules = reactive({
  id: [
    { validator: validateInput, trigger: 'blur' },
    { max: 64, message: $t('Save.index.912481-20'), trigger: 'change' },
  ],
  name: [
    { required: true, message: $t('Save.index.912481-5'), trigger: 'blur' },
    { max: 64, message: $t('Save.index.912481-20'), trigger: 'change' },
  ],
  describe: [
    { max: 200, message: $t('Save.index.912481-21'), trigger: 'blur' },
  ],
})

// 右侧列表搜索栏
const searchColumns = [
  {
    title: $t('Product.index.660348-28') || '名称',
    dataIndex: 'name',
    key: 'name',
    search: { type: 'string' },
  },
  {
    title: $t('Product.index.660348-33') || '产品分类',
    key: 'classifiedId',
    dataIndex: 'classifiedId',
    search: {
      type: 'treeSelect',
      options: async () => {
        return new Promise((res) => {
          category({ paging: false }).then((resp) => {
            res(resp.result)
          })
        })
      },
    },
  },
  {
    title: $t('Product.index.660348-29') || '网关类型',
    key: 'accessProvider',
    dataIndex: 'accessProvider',
    search: {
      type: 'select',
      options: async () => {
        return new Promise((resolve) => {
          getProviders().then((resp: any) => {
            const data = resp.result || []
            resolve(
              accessConfigTypeFilter(data).filter((i: any) => {
                return accessType.includes(i.value)
              }),
            )
          })
        })
      },
    },
  },
  {
    title: $t('Product.index.660348-5') || '接入方式',
    key: 'accessId',
    dataIndex: 'accessId',
    search: {
      type: 'select',
      options: async () => {
        return new Promise((res) => {
          queryGatewayList({ paging: false }).then((resp: any) => {
            typeList.value = []
            typeList.value = resp.result.map((item: any) => ({
              label: item.name,
              value: item.id,
            }))
            res(typeList.value)
          })
        })
      },
    },
  },
]

const templateColumns = [
  {
    title: $t('Product.index.660348-28') || '名称',
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    scopedSlots: true,
  },
  {
    title: $t('Product.index.660348-33') || '产品分类',
    dataIndex: 'classifiedName',
    key: 'classifiedName',
    ellipsis: true,
  },
  {
    title: $t('Product.index.660348-5') || '接入方式',
    dataIndex: 'accessName',
    key: 'accessName',
    ellipsis: true,
  },
  {
    title: '说明',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    scopedSlots: true,
  },
]

// (旧的 handleSearch 已移除，避免重复定义)

/**
 * 选择模板
 */
const handleSelectTemplate = (data: TemplateItem) => {
  selectedTemplate.value = { ...data }
}

/**
 * 步骤切换
 */
const handleStepChange = (step: number) => {
  if (step === 0) {
    currentStep.value = 0
  } else if (step === 1) {
    handleNext()
  }
}

/**
 * 下一步
 */
const handleNext = () => {
  if (currentStep.value === 0) {
    if (!selectedTemplate.value) {
      onlyMessage($t('template.message.selectTemplate') || '请选择一个模板', 'error')
      return
    }
    currentStep.value = 1
  }
}

/**
 * 上一步
 */
const handlePrev = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

/**
 * 确定
 */
const handleOk = async () => {
  if (currentStep.value === 1) {
    try {
      await formRef.value.validate()
      loading.value = true

      let templateDetail: any = selectedTemplate.value
      if (selectedTemplate.value?.id) {
        const detailResp: any = await getTemplateDetail(selectedTemplate.value.id).catch(() => undefined)
        if (detailResp?.success && detailResp?.result) {
          templateDetail = {
            ...selectedTemplate.value,
            ...detailResp.result,
          }
        }
      }

      // 组合产品数据：模板数据 + 用户填写的数据
      const productData = {
        id: productForm.id || undefined,
        name: productForm.name,
        photoUrl: productForm.photoUrl,
        describe: productForm.describe,
        deviceType: productForm.deviceType,
        // 从模板继承的数据
        templateId: templateDetail?.id,
        classifiedId: templateDetail?.classifiedId,
        classifiedName: templateDetail?.classifiedName,
        accessId: templateDetail?.accessId,
        accessName: templateDetail?.accessName,
        accessProvider: templateDetail?.accessProvider,
        messageProtocol: templateDetail?.messageProtocol,
        transportProtocol: templateDetail?.transportProtocol,
        protocolName: templateDetail?.protocolName,
        metadata: templateDetail?.metadata,
        configuration: templateDetail?.configuration,
        storePolicy: templateDetail?.storePolicy,
      }

      const res = await addProduct(productData)
      loading.value = false

      if (res.success) {
        onlyMessage($t('Save.index.912481-22') || '保存成功！')
        emit('success')
      } else {
        onlyMessage($t('Save.index.912481-23') || '操作失败', 'error')
      }
    } catch (error) {
      loading.value = false
    }
  }
}

/**
 * 取消
 */
const handleCancel = () => {
  emit('cancel')
}

/**
 * 显示弹窗
 */
const show = async () => {
  currentStep.value = 0
  selectedTemplate.value = undefined
  selectedTagId.value = undefined
  tagCategoryId.value = undefined
  tagTree.value = []

  productForm.id = undefined
  productForm.name = ''
  productForm.photoUrl = device.deviceProduct
  productForm.describe = undefined

  // 按顺序：标签分类 -> 标签树 -> 模板列表
  await loadTagCategories()
  // loadTagCategories 内部会在初始化时调用 loadTagTree + selectFirstTagInTree(触发模板过滤)

  // 若分类列表为空，则不加 tag-bind 条件，直接加载模板
  if (!tagCategoryId.value) {
    applyTemplateTagFilter(undefined)
  }
}

defineExpose({
  show
})
</script>

<style lang="less" scoped>
.steps-content {
  width: 100%;
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
  margin-top: 16px;
}

.select-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.choose-template {
  display: flex;
  gap: 16px;
}

.choose-template__left {
  width: 280px;
  border-right: 1px solid #f0f0f0;
  padding-right: 16px;
}

.choose-template__right {
  flex: 1;
  min-width: 0;
}

.context-access {
  color: #8c8c8c;
  font-size: 12px;
  margin-top: 8px;
}

.product-form {
  padding: 20px;
}

.steps-action {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
