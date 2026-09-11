<template>
  <j-page-container class="product-page">
    <FullPage transparentBackground>
      <EqualHeightColumns class="product-page__layout" left-width="15rem" right-width="1fr">
        <template #left>
          <ProductCategoryTree
            class="product-page__category-tree"
            :tree-data="categoryTree"
            :active-id="selectedCategoryId"
            :loading="categoryLoading"
            :can-add="canAddCategory"
            :can-update="canUpdateCategory"
            :can-delete="canDeleteCategory"
            @select="handleCategorySelect"
            @select-unclassified="handleUnclassifiedCategorySelect"
            @add-root="openAddRootCategory"
            @add-child="openAddChildCategory"
            @edit="openEditCategory"
            @delete="confirmDeleteCategory"
          />
        </template>
        <template #right>
          <ContentPanel class="product-page__main">
            <a-flex class="product-page__toolbar" :gap="16" align="center" wrap="wrap">
              <ConditionFilter
                class="product-page__search"
                :fields="filterFields"
                :common-fields="commonFilterFields"
                :model-value="filterTerms"
                :placeholder="$t('IotDeviceList.filter.conditionPlaceholder')"
                @update:model-value="handleFilterTermsUpdate"
                @change="handleFilterSearch"
              />
              <a-space class="product-page__actions">
                <j-permission-button
                  type="primary"
                  key="add"
                  @click="add"
                  hasPermission="device/Product:add"
                >
                  <template #icon><AIcon type="PlusOutlined" /></template>
                  {{ $t("Product.index.660348-0") }}
                </j-permission-button>
                <BatchDropdown key="batch" :actions="batchActions" />
              </a-space>
            </a-flex>
            <JProTable
              :columns="columns"
              :request="queryProductList"
              class="pro-table__no-padding"
              ref="tableRef"
              :defaultParams="{
                sorts: [{ name: 'createTime', order: 'desc' }],
              }"
              mode="TABLE"
              :params="tableParams"
            >
              <template #deviceType="slotProps">
                <div>{{ slotProps.deviceType?.text || '-' }}</div>
              </template>
              <template #state="slotProps">
                <j-badge-status
                  :text="slotProps.state === 1 ? $t('Product.index.660348-2') : $t('Product.index.660348-3')"
                  :status="slotProps.state"
                  :statusNames="{ 1: 'processing', 0: 'error' }"
                />
              </template>
              <template #name="slotProps">
                <a
                  class="product-page__name-cell"
                  href=""
                  @click.prevent="handleView(slotProps.id)"
                >
                  <IconBadge
                    :image="slotProps.photoUrl"
                    icon="AppstoreOutlined"
                    :size="40"
                    :inner-size="32"
                    :alt="getI18nText(slotProps, 'name')"
                  />
                  <span class="product-page__name-body">
                    <j-ellipsis class="product-page__name-title">{{ getI18nText(slotProps, 'name') }}</j-ellipsis>
                    <small>{{ slotProps.id }}</small>
                  </span>
                </a>
              </template>
              <template #classifiedName="slotProps">
                {{ getI18nText(slotProps, 'classifiedName') || '-' }}
              </template>
              <template #brandModel="slotProps">
                {{ getBrandModel(slotProps) }}
              </template>
              <template #action="slotProps">
                <a-space :size="4">
                  <template v-for="i in getActions(slotProps)" :key="i.key">
                    <j-permission-button
                      type="link"
                      size="small"
                      :disabled="i.disabled"
                      :popConfirm="i.popConfirm"
                      :hasPermission="i.permission || i.key === 'view' ? true : 'device/Product:' + i.key"
                      :tooltip="{ ...i.tooltip }"
                      :danger="i.key === 'delete'"
                      @click="i.onClick"
                    >
                      {{ i.text }}
                    </j-permission-button>
                  </template>
                </a-space>
              </template>
            </JProTable>
          </ContentPanel>
        </template>
      </EqualHeightColumns>
    </FullPage>
    <Save ref="saveRef" :isAdd="isAdd" :title="title" @success="refresh" />
    <ModifyModal
      ref="categoryModalRef"
      :title="categoryTitle"
      :isAdd="categoryModalMode"
      :isChild="categoryModalChildMode"
      @refresh="handleCategoryChanged"
    />
    <SyncCache v-if="syncCacheVisible" :params="tableParams" @success="refresh" @close="syncCacheVisible = false" />
  </j-page-container>
</template>

<script setup lang="ts">
import { onlyMessage } from "@jetlinks-web/utils";
import {
  getProviders,
  queryOrgThree,
  queryGatewayList,
  queryProductList,
  _deploy,
  _undeploy,
  deleteProduct,
  updateDevice,
} from "../../../api/product";
import { downloadJson, accessConfigTypeFilter, isNoCommunity, mergeObjectArrays } from "@jetlinks-web-core/utils";
import { omit, cloneDeep } from "lodash-es";
import Save from "./Save/index.vue";
import SyncCache from "./components/SyncCache.vue";
import ProductCategoryTree, { type ProductCategoryTreeNode } from "./components/ProductCategoryTree.vue";
import ModifyModal from "../Category/components/modifyModal/index.vue";
import { queryTree, deleteTree } from "../../../api/category";
import { useMenuStore, useAuthStore } from "@jetlinks-web-core/store";
import { useRouterParams } from "@jetlinks-web/hooks";
import { accessType } from "../data";
import { useI18n } from "vue-i18n";
import { Modal } from "ant-design-vue";
import ConditionFilter, {
  buildQueryFilter,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter';
import { useTermOptions } from '@jetlinks-web/components/es/Search/hooks/useTermOptions'
import BatchDropdown from "@jetlinks-web-core/components/BatchDropdown/index.vue";
import { IconBadge } from '@jetlinks-web-core/components'
import { getI18nText } from '../../../utils/i18n'

const { t: $t } = useI18n();

const menuStory = useMenuStore();
const authStore = useAuthStore();
const isAdd = ref<number>(0);
const title = ref<string>("");
const productSearchParams = ref<Record<string, any>>({});
const filterTerms = ref<ConditionFilterTerm[]>([]);
const submittedFilterTerms = ref<ConditionFilterTerm[]>([]);
const selectedCategoryId = ref<string>();
const categoryTree = ref<ProductCategoryTreeNode[]>([]);
const categoryLoading = ref(false);
const productUnclassifiedScopeId = '__product-unclassified__';
const { termOptions: dimAssetsTermOptions } = useTermOptions({ pick: ['eq']})

const columns = [
  {
    title: $t("Product.index.660348-7"),
    dataIndex: "name",
    key: "name",
    scopedSlots: true,
    width: 240,
    ellipsis: true,
  },
  {
    title: $t("Product.index.660348-36"),
    dataIndex: "classifiedName",
    key: "classifiedName",
    scopedSlots: true,
    width: 180,
    ellipsis: true,
  },
  {
    title: $t("Product.index.660348-40"),
    dataIndex: "brandModel",
    key: "brandModel",
    scopedSlots: true,
    ellipsis: true,
    width: 180,
  },
  {
    title: $t("Product.index.660348-9"),
    dataIndex: "state",
    key: "state",
    scopedSlots: true,
    ellipsis: true,
    width: 90,
  },
  {
    title: $t("Product.index.660348-4"),
    dataIndex: "deviceType",
    key: "deviceType",
    scopedSlots: true,
    ellipsis: true,
    width: 120,
  },
  {
    title: $t("Product.index.660348-11"),
    key: "action",
    fixed: "right",
    width: 250,
    scopedSlots: true,
    ellipsis: true,
  },
];
const hasDepartmentMenu = menuStory.hasMenu('system/Department');
const currentForm = ref({});
const syncCacheVisible = ref(false)
const categoryModalRef = ref();
const categoryModalMode = ref(0);
const categoryModalChildMode = ref(0);
const categoryTitle = ref('');
const canAddCategory = computed(() => authStore.hasPermission('device/Product:category-add'));
const canUpdateCategory = computed(() => authStore.hasPermission('device/Product:category-update'));
const canDeleteCategory = computed(() => authStore.hasPermission('device/Product:category-delete'));

const tableParams = computed(() => {
  const params = cloneDeep(productSearchParams.value);
  if (!selectedCategoryId.value) {
    return params;
  }

  // 选择父分类时同时查询全部下级分类，保证树节点与列表筛选的范围一致。
  const categoryTerm = selectedCategoryId.value === productUnclassifiedScopeId
    ? { column: 'classifiedId', termType: 'isnull', value: 1 }
    : {
        column: 'classifiedId',
        termType: 'in',
        value: collectCategoryScopeIds(categoryTree.value, selectedCategoryId.value),
      };

  return {
    ...params,
    terms: [
      ...(params.terms || []),
      {
        terms: [categoryTerm],
      },
    ],
  };
});

// 产品管理入口同时服务私有化与运行时，不能按 SaaS 编译标识隐藏导入和缓存同步能力。
const batchActions = computed(() => {
  return [
    {
      key: 'import',
      text: $t("Product.index.660348-1"),
      icon: 'UploadOutlined',
      permission: 'device/Product:import',
      onClick: () => {
        // 触发文件选择
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            beforeUpload(file);
          }
        };
        input.click();
      }
    },
    {
      key: 'syncCache',
      text: $t('Product.index.660348-41'),
      icon: 'SyncOutlined',
      permission: 'device/Product:update',
      onClick: () => {
        syncCacheVisible.value = true;
      }
    },
  ]
});

const getActions = (data: Partial<Record<string, any>>): any[] => {
  if (!data) {
    return [];
  }
  const parentGetActions = inject('getActions', {}).getActions;
  const parentActions = parentGetActions?.(data);
  let actions = [
    {
      key: "view",
      text: $t("Product.index.660348-12"),
      tooltip: {
        title: $t("Product.index.660348-12"),
      },
      icon: "EyeOutlined",
      onClick: () => {
        handleView(data.id);
      },
    },
    {
      key: "update",
      text: $t("Product.index.660348-13"),
      tooltip: {
        title: $t("Product.index.660348-13"),
      },
      icon: "EditOutlined",
      onClick: () => {
        title.value = $t("Product.index.660348-13");
        isAdd.value = 2;
        nextTick(() => {
          saveRef.value.show(data);
        });
      },
    },
    {
      key: "export",
      text: $t("Product.index.660348-14"),
      tooltip: {
        title: $t("Product.index.660348-14"),
      },

      icon: "icon-xiazai",
      onClick: () => {
        const extra = omit(data, [
          "transportProtocol",
          "protocolName",
          "accessId",
          "accessName",
          "accessProvider",
          "messageProtocol",
        ]);
        downloadJson(extra, data.name + $t("Product.index.660348-15"));
      },
    },
    {
      key: "action",
      text:
        data.state !== 0
          ? $t("Product.index.660348-3")
          : $t("Product.index.660348-16"),
      tooltip: {
        title:
          data.state !== 0
            ? $t("Product.index.660348-3")
            : $t("Product.index.660348-16"),
      },
      icon: data.state !== 0 ? "StopOutlined" : "CheckCircleOutlined",
      popConfirm: {
        title: `确认${data.state !== 0 ? $t("Product.index.660348-3") : $t("Product.index.660348-16")}?`,
        onConfirm: () => {
          let response = undefined;
          if (data.state !== 0) {
            response = _undeploy(data.id);
          } else {
            response = _deploy(data.id);
          }
          response.then((res) => {
            if (res && res.status === 200) {
              onlyMessage($t("Product.index.660348-18"));
              tableRef.value?.reload();
            } else {
              onlyMessage($t("Product.index.660348-19"), "error");
            }
          });
          return response;
        },
      },
    },
    {
      key: "delete",
      text: $t("Product.index.660348-20"),
      disabled: data.state !== 0,
      tooltip: {
        title:
          data.state !== 0
            ? $t("Product.index.660348-21")
            : $t("Product.index.660348-20"),
      },
      popConfirm: {
        title: $t("Product.index.660348-22"),
        onConfirm: () => {
          const response = deleteProduct(data.id);
          response.then((resp) => {
            if (resp.status === 200) {
              onlyMessage($t("Product.index.660348-18"));
              tableRef.value?.reload();
            } else {
              onlyMessage($t("Product.index.660348-19"), "error");
            }
          });
          return response;
        },
      },
      icon: "DeleteOutlined",
    },
  ];
  if (parentActions && parentActions.length > 0) {
    actions = mergeObjectArrays(actions, parentActions)
  }
  return actions;
};

/**
 * 新增
 */
const add = () => {
  isAdd.value = 1;
  title.value = $t("Product.index.660348-0");
  nextTick(() => {
    saveRef.value.show(currentForm.value);
  });
};

/**
 * 导入
 */
const beforeUpload = (file: any) => {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = async (result) => {
    const text = result.target?.result as string;
    // console.log(text);
    if (!file.type.includes("json")) {
      onlyMessage($t("Product.index.660348-23"), "error");
      return false;
    }
    if (!text) {
      onlyMessage($t("Product.index.660348-24"), "error");
      return false;
    }
    const data = JSON.parse(text);
    // 设置导入的产品状态为未发布
    data.state = 0;
    if (Array.isArray(data)) {
      onlyMessage($t("Product.index.660348-25"), "error");
      return false;
    }
    delete data.state;
    if (!data?.name) {
      data.name = $t("Product.index.660348-15") + Date.now();
    }
    if (!data?.deviceType || JSON.stringify(data?.deviceType) === "{}") {
      onlyMessage($t("Product.index.660348-26"), "error");
      return false;
    }
    const res = await updateDevice(data);
    if (res.status === 200) {
      onlyMessage($t("Product.index.660348-27"));
      tableRef.value?.reload();
    }
    return true;
  };
  return false;
};
/**
 * 查看
 */
const handleView = (id: string) => {
  menuStory.jumpPage("device/Product/Detail", { params: { id } });
};

/**
 * 刷新数据
 */
const refresh = () => {
  tableRef.value?.reload();
};

const getBrandModel = (product: Record<string, any>) => {
  const manufacturer = getI18nText(product, 'manufacturer');
  const model = getI18nText(product, 'model');
  return [manufacturer, model].filter(Boolean).join(' / ') || '-';
};

const normalizeCategoryTree = (nodes: Record<string, any>[] = []): ProductCategoryTreeNode[] => {
  return nodes.map((node) => ({
    ...node,
    children: normalizeCategoryTree(node.children || node._children || []),
  }));
};

const hasCategory = (nodes: ProductCategoryTreeNode[], id?: string): boolean => {
  if (!id) {
    return false;
  }
  return nodes.some((node) => node.id === id || hasCategory(node.children || [], id));
};

const collectCategoryScopeIds = (nodes: ProductCategoryTreeNode[], id: string): string[] => {
  const collectNodeIds = (node: ProductCategoryTreeNode): string[] => [
    node.id,
    ...(node.children || []).flatMap(collectNodeIds),
  ];
  const findScopeIds = (items: ProductCategoryTreeNode[]): string[] | undefined => {
    for (const node of items) {
      if (node.id === id) {
        return collectNodeIds(node);
      }

      const descendantIds = findScopeIds(node.children || []);
      if (descendantIds) {
        return descendantIds;
      }
    }
  };

  // 分类树刷新与列表查询可能在同一时刻发生，保留当前节点避免短暂丢失筛选条件。
  return findScopeIds(nodes) || [id];
};

const refreshCategoryTree = async () => {
  categoryLoading.value = true;
  try {
    const response = await queryTree({
      paging: false,
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    });
    if (response.status === 200) {
      categoryTree.value = normalizeCategoryTree(response.result || []);
      if (
        selectedCategoryId.value !== productUnclassifiedScopeId
        && !hasCategory(categoryTree.value, selectedCategoryId.value)
      ) {
        selectedCategoryId.value = undefined;
      }
    }
  } finally {
    categoryLoading.value = false;
  }
};

const handleCategorySelect = (id?: string) => {
  selectedCategoryId.value = id;
  refresh();
};

const handleUnclassifiedCategorySelect = () => {
  selectedCategoryId.value = productUnclassifiedScopeId;
  refresh();
};

const openAddRootCategory = () => {
  categoryTitle.value = $t('Category.index.779033-15');
  categoryModalMode.value = 0;
  categoryModalChildMode.value = 3;
  nextTick(() => categoryModalRef.value?.show({}));
};

const openAddChildCategory = (category: ProductCategoryTreeNode) => {
  categoryTitle.value = $t('Category.index.779033-8');
  categoryModalMode.value = 0;
  categoryModalChildMode.value = category.children?.length ? 1 : 2;
  nextTick(() => categoryModalRef.value?.show(category));
};

const openEditCategory = (category: ProductCategoryTreeNode) => {
  categoryTitle.value = $t('Category.index.779033-6');
  categoryModalMode.value = 2;
  categoryModalChildMode.value = 0;
  nextTick(() => categoryModalRef.value?.show(category));
};

const confirmDeleteCategory = (category: ProductCategoryTreeNode) => {
  Modal.confirm({
    title: $t('Category.index.779033-10'),
    okText: $t('modifyModal.index.177674-0'),
    cancelText: $t('Category.index.779033-12'),
    onOk: async () => {
      const response = await deleteTree(category.id);
      if (response.status === 200) {
        onlyMessage($t('Category.index.779033-13'));
        await handleCategoryChanged();
      } else {
        onlyMessage($t('Category.index.779033-14'), 'error');
      }
    },
  });
};

const handleCategoryChanged = async () => {
  await refreshCategoryTree();
  refresh();
};

// 筛选
const typeList = ref([]);
const tableRef = ref<Record<string, any>>({});
const query = reactive({
  columns: [
    {
      title: $t("Product.index.660348-28"),
      dataIndex: "name",
      key: "name",
      search: {
        first: true,
        type: "string",
      },
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      search: {
        type: "string",
        defaultTermType: "eq",
      },
    },
    {
      title: $t("Product.index.660348-29"),
      key: "accessProvider",
      dataIndex: "accessProvider",
      search: {
        type: "select",
        options: async () => {
          return new Promise((resolve) => {
            getProviders().then((resp: any) => {
              const data = resp.result || [];
              resolve(
                accessConfigTypeFilter(data).filter((i: any) => {
                  return accessType.includes(i.value);
                }),
              );
            });
          });
        },
      },
    },
    {
      title: $t("Product.index.660348-5"),
      key: "accessId",
      dataIndex: "accessId",
      search: {
        type: "select",
        options: async () => {
          return new Promise((res) => {
            queryGatewayList({
              paging: false,
            }).then((resp: any) => {
              typeList.value = [];
              typeList.value = resp.result.map((item: any) => ({
                label: item.name,
                value: item.id,
              }));
              res(typeList.value);
            });
          });
        },
      },
    },
    {
      title: $t("Product.index.660348-4"),
      key: "deviceType",
      dataIndex: "deviceType",
      search: {
        type: "select",
        options: [
          {
            label: $t("Product.index.660348-30"),
            value: "device",
          },
          {
            label: $t("Product.index.660348-31"),
            value: "childrenDevice",
          },
          {
            label: $t("Product.index.660348-32"),
            value: "gateway",
          },
        ],
      },
    },
    {
      title: $t("Product.index.660348-9"),
      key: "state",
      dataIndex: "state",
      search: {
        type: "select",
        options: [
          {
            label: $t("Product.index.660348-2"),
            value: 1,
          },
          {
            label: $t("Product.index.660348-3"),
            value: 0,
          },
        ],
      },
    },
    {
      title: $t("Product.index.660348-10"),
      key: "describe",
      dataIndex: "describe",
      search: {
        type: "string",
      },
    },
    {
      title: $t("Product.index.660348-11"),
      key: "action",
      fixed: "right",
      width: 250,
      scopedSlots: true,
    },
  ],
});
const filterFields = computed<ConditionFilterField[]>(() =>
  query.columns.filter((column) => column.search),
);
const commonFilterFields = ['name', 'id', 'deviceType', 'accessProvider', 'state'];
const saveRef = ref();

/**
 * 兼容 ConditionFilter 直接条件与嵌套分组两种输出，保留产品列表已有的后端字段转换。
 */
const normalizeProductSearchTerm = (term: any): any => {
  if (Array.isArray(term?.terms)) {
    return {
      ...term,
      terms: term.terms.map(normalizeProductSearchTerm),
    };
  }

  if (term?.column === "id$dev-instance") {
    return {
      column: "id$dev-instance",
      options: ["productId"],
      value: term.value,
      type: term.type,
    };
  }

  if (term?.column === "id$dim-assets") {
    const value = term.value;
    term = {
      ...term,
      column: "id",
      termType: "dim-assets",
      value: {
        assetType: "product",
        targets: [
          {
            type: "org",
            id: value,
          },
        ],
      },
    };
  }

  if (term?.column === "accessProvider") {
    if (term.value === "collector-gateway") {
      term.termType = term.termType === "eq" ? "in" : "nin";
      term.value = ["opc-ua", "modbus-tcp", "collector-gateway"];
    } else if (
      Array.isArray(term.value) &&
      term.value.includes("collector-gateway")
    ) {
      term.value = ["opc-ua", "modbus-tcp", ...term.value];
    }
  }

  return term;
};

const applyProductSearch = (e: Record<string, any>) => {
  const newTerms = cloneDeep(e);
  if (newTerms.terms?.length) {
    // 产品列表的旧查询链路以顶层条件分组为边界；ConditionFilter 会输出直接条件。
    // 统一包成一个分组后，保留 like 的 % 通配符及组内 and/or 语义，兼容既有产品查询解析。
    newTerms.terms = [
      {
        terms: newTerms.terms.map(normalizeProductSearchTerm),
      },
    ];
  }

  productSearchParams.value = newTerms;
};

const handleFilterTermsUpdate = (terms: ConditionFilterTerm[] = []) => {
  filterTerms.value = terms;
};

const handleFilterSearch = (payload?: { terms?: ConditionFilterTerm[] }) => {
  submittedFilterTerms.value = payload?.terms || filterTerms.value;
  applyProductSearch(buildQueryFilter(submittedFilterTerms.value, filterFields.value));
};
const routerParams = useRouterParams();

onMounted(() => {
  if (routerParams.params.value?.save) {
    add();
  }
  if (routerParams.params.value?.resourceId) {
    setTimeout(() => {
      productSearchParams.value = {
        terms: [
          {
            column: "id$in-res-quick$product",
            value: [routerParams.params.value.resourceId],
          },
        ],
      };
    });
  }
  if (isNoCommunity && hasDepartmentMenu) {
    query.columns.splice(query.columns.length - 2, 0, {
      title: $t("Product.index.660348-34"),
      key: "id$dim-assets",
      dataIndex: "id$dim-assets",
      search: {
        first: true,
        type: "treeSelect",
        termOptions: dimAssetsTermOptions,
        options: async () => {
          return new Promise((res) => {
            queryOrgThree({ paging: false }).then((resp: any) => {
              const formatValue = (list: any[]) => {
                const _list: any[] = [];
                list.forEach((item) => {
                  if (item.children) {
                    item.children = formatValue(item.children);
                  }
                  _list.push({
                    ...item,
                    value: JSON.stringify({
                      assetType: "product",
                      targets: [
                        {
                          type: "org",
                          id: item.id,
                        },
                      ],
                    }),
                  });
                });
                return _list;
              };
              res(formatValue(resp.result));
            });
          });
        },
      },
    });
  }
  refreshCategoryTree();
});
</script>

<style lang="less" scoped>
.product-page {
  &__layout {
    height: 100%;
    min-height: 0;
  }

  &__main {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    // 产品表格随内容自然撑高，由页面最外层承接纵向滚动。
    overflow: visible;
  }

  &__toolbar {
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  &__search {
    flex: 0 1 28rem;
    max-width: 28rem;
    min-width: 0;
  }

  &__actions {
    flex: 0 0 auto;
  }

  &__name-cell {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    color: inherit;
    text-decoration: none;

    &:hover {
      .product-page__name-title {
        color: var(--jet-theme-primary);
      }
    }
  }

  &__name-body {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: var(--space-1);
  }

  &__name-title {
    color: var(--color-jet-text-primary);
    font-weight: 500;
    transition: color 0.2s ease;

    :deep(.j-ellipsis-content) {
      display: block;
    }
  }

  &__name-body > small {
    color: var(--color-jet-text-secondary);
    font-size: var(--fs-12);
  }
}

@media (max-width: 48rem) {
  .product-page {
    &__layout {
      min-height: auto;
      height: auto;
    }

    &__category-tree {
      height: auto;
    }

    &__search {
      min-width: 100%;
    }
  }
}
</style>
