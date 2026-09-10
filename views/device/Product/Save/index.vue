<!-- 新增、编辑产品 -->
<template>
    <a-modal
        :maskClosable="false"
        destroy-on-close
        v-model:open="visible"
        @ok="submitData"
        @cancel="close"
        :okText="$t('Save.index.912481-0')"
        :cancelText="$t('Save.index.912481-1')"
        width="960px"
        :confirmLoading="loading"
    >
        <template #title>
            <header class="product-save__title">
                <span class="product-save__title-icon">
                    <AIcon :type="props.isAdd === 2 ? 'EditOutlined' : 'PlusOutlined'" aria-hidden="true" />
                </span>
                <h3>{{ props.title }}</h3>
            </header>
        </template>
        <div class="product-save">
            <a-form
                class="product-save__form"
                layout="vertical"
                :model="form"
                :rules="rules"
                ref="formRef"
            >
                <section class="product-save__identity">
                    <a-row :gutter="24">
                        <a-col :xs="24" :sm="6">
                            <a-form-item name="photoUrl">
                                <pro-upload
                                    v-model="form.photoUrl"
                                    :accept="
                                        imageTypes && imageTypes.length
                                            ? imageTypes.toString()
                                            : ''
                                    "
                                />
                            </a-form-item>
                        </a-col>
                        <a-col :xs="24" :sm="18">
                            <a-form-item :label="$t('Save.index.912481-4')" name="name">
                                <I18nTextField
                                    v-model:value="form.name"
                                    v-model:i18nMessages="form.i18nMessages"
                                    field="name"
                                    :label="$t('Save.index.912481-4')"
                                    :i18n-max-length="64"
                                    :placeholder="$t('Save.index.912481-5')"
                                />
                            </a-form-item>
                            <a-form-item :label="$t('Save.index.912481-6')" name="classifiedId">
                                <a-tree-select
                                    showSearch
                                    v-model:value="form.classifiedId"
                                    :placeholder="$t('Save.index.912481-7')"
                                    :tree-data="treeList"
                                    @change="valueChange"
                                    allow-clear
                                    :fieldNames="{
                                        label: 'name',
                                        value: 'id',
                                        children: 'children',
                                    }"
                                    :filterTreeNode="
                                        (v, option) => filterSelectNode(v, option, 'name')
                                    "
                                >
                                    <template> </template>
                                </a-tree-select>
                            </a-form-item>
                        </a-col>
                    </a-row>
                </section>

                <section class="product-save__fields">
                    <a-form-item class="product-save__field product-save__field--full product-save__device-type" :label="$t('Save.index.912481-8')" name="deviceType">
                        <j-card-select
                            v-model:value="form.deviceType"
                            :column="3"
                            :options="deviceList"
                            :disabled="productStore.detail?.accessId ? true : false"
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
                    <a-form-item class="product-save__field" :label="$t('Save.index.912481-24')" name="manufacturer">
                        <I18nTextField
                            v-model:value="form.manufacturer"
                            v-model:i18nMessages="form.i18nMessages"
                            field="manufacturer"
                            :label="$t('Save.index.912481-24')"
                            :i18n-max-length="64"
                            :placeholder="$t('Save.index.912481-25')"
                        />
                    </a-form-item>
                    <a-form-item class="product-save__field" :label="$t('Save.index.912481-26')" name="model">
                        <I18nTextField
                            v-model:value="form.model"
                            v-model:i18nMessages="form.i18nMessages"
                            field="model"
                            :label="$t('Save.index.912481-26')"
                            :i18n-max-length="64"
                            :placeholder="$t('Save.index.912481-27')"
                        />
                    </a-form-item>
                    <a-form-item class="product-save__field product-save__field--full product-save__description" :label="$t('Save.index.912481-9')" name="describe">
                        <I18nTextField
                            :maxlength="200"
                            showCount
                            :auto-size="{ minRows: 4, maxRows: 5 }"
                            v-model:value="form.describe"
                            v-model:i18nMessages="form.i18nMessages"
                            field="describe"
                            :label="$t('Save.index.912481-9')"
                            :placeholder="$t('Save.index.912481-10')"
                            textarea
                        />
                    </a-form-item>
                </section>
            </a-form>
        </div>
    </a-modal>
    <DialogTips ref="dialogRef" />
</template>

<script lang="ts" setup>
import { category, addProduct, editProduct } from '@device-manager-ui/api/product';
import { Form } from 'ant-design-vue';
import DialogTips from '../DialogTips/index.vue';
import { useProductStore } from '@device-manager-ui/store/product';
import { filterSelectNode, encodeQuery } from '@jetlinks-web-core/utils';
import { onlyMessage } from '@jetlinks-web/utils'
import type { Rule } from 'ant-design-vue/es/form';
import { device } from '@device-manager-ui/assets';
import { useI18n } from 'vue-i18n';
import { omit } from 'lodash-es';
import { ensureVisualizationDashboardProject } from '@device-manager-ui/utils/dashboardProject';
import I18nTextField from '@device-manager-ui/components/I18n/I18nTextField.vue';
import { getI18nText } from '@device-manager-ui/utils/i18n';

const { t: $t } = useI18n();

const productStore = useProductStore();
const emit = defineEmits(['success']);

const props = defineProps({
    title: {
        type: String,
        default: '',
    },
    isAdd: {
        type: Number,
        default: 0,
    }
});
const loading = ref<boolean>(false);
const dialogRef = ref();
const treeList = ref<Record<string, any>[]>([]);
const visible = ref<boolean>(false);
const formRef = ref();
const useForm = Form.useForm;
const photoValue = ref(device.deviceProduct);
const imageTypes = reactive([
    'image/jpeg',
    'image/png',
    // 'image/jpg',
    'image/jfif',
    'image/pjp',
    // 'image/pjpeg',
]);
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

const form = reactive({
    id: undefined,
    name: '',
    classifiedId: undefined,
    classifiedName: '',
    deviceType: '',
    manufacturer: '',
    model: '',
    describe: undefined,
    photoUrl: device.deviceProduct,
    type: 'custom',
    masterProductId: undefined,
    edgeMasterId: undefined,
    metadata: undefined,
    i18nMessages: {} as Record<string, Record<string, string>>,
});
/**
 * 校验是否选择设备类型
 */
const validateDeviceType = async (_rule: Rule, value: string) => {
    if (!value) {
        return Promise.reject($t('Save.index.912481-19'));
    } else {
        return Promise.resolve();
    }
};

const rules = reactive({
    name: [
        { required: true, message: $t('Save.index.912481-5'), trigger: 'blur' },
        { max: 64, message: $t('Save.index.912481-20'), trigger: 'change' },
    ],
    deviceType: [
        {
            required: true,
            validator: validateDeviceType,
        },
    ],
    manufacturer: [
        { max: 64, message: $t('Save.index.912481-20'), trigger: 'change' },
    ],
    model: [
        { max: 64, message: $t('Save.index.912481-20'), trigger: 'change' },
    ],
    describe: [
        { max: 200, message: $t('Save.index.912481-21'), trigger: 'blur' },
    ],
});

const valueChange = (value: string, label: string) => {
    form.classifiedName = label[0];
};

/**
 * 查询产品分类
 */
const queryProductTree = async () => {
    category(encodeQuery({ sorts: { sortIndex: 'asc' } })).then((resp) => {
        if (resp.status === 200) {
            treeList.value = resp.result;
            treeList.value = dealProductTree(treeList.value);
        }
    });
};
/**
 * 处理产品分类key
 */
const dealProductTree = (arr: any) => {
    return arr.map((element: any) => {
        element.key = element.id;
        if (element.children) {
            element.children = dealProductTree(element.children);
        }
        return element;
    });
};
/**
 * 显示弹窗
 */
const show = async (data: any) => {
    if (props.isAdd === 2) {
        await productStore.refresh(data.id);
        const detail = productStore.current;
        form.name = data.name;
        form.classifiedId = data.classifiedId || undefined;
        form.classifiedName = data.classifiedName;
        form.photoUrl = data.photoUrl || photoValue.value;
        form.deviceType = data.deviceType.value;
        // 列表行可能不包含品牌和型号，编辑时以完整详情为准并兼容服务端的本地化展示字段。
        form.manufacturer = getI18nText(detail, 'manufacturer') || getI18nText(data, 'manufacturer');
        form.model = getI18nText(detail, 'model') || getI18nText(data, 'model');
        form.describe = data.describe;
        form.i18nMessages = detail.i18nMessages || data.i18nMessages || {};
        form.id = data.id;
        // 旧模板产品编辑时保留来源数据，但当前弹窗不再提供模板或云端选择入口。
        form.type = 'custom';
        form.masterProductId = data.masterProductId;
        form.edgeMasterId = data.edgeMasterId;
        form.metadata = data.metadata;
    } else if (props.isAdd === 1) {
        productStore.reSet();
        form.name = '';
        form.classifiedId = undefined;
        form.classifiedName = '';
        form.photoUrl = device.deviceProduct;
        form.deviceType = '';
        form.manufacturer = '';
        form.model = '';
        form.describe = undefined;
        form.i18nMessages = {};
        form.id = undefined;
        form.type = 'custom';
    }
    visible.value = true;
};

/**
 * 关闭弹窗
 */
const close = () => {
    visible.value = false;
};
const { resetFields, validate, validateInfos, clearValidate } = useForm(
    form,
    rules,
);
const ensureProductDashboardProject = async (productId: string) => {
    try {
        await ensureVisualizationDashboardProject({
            entityId: productId,
            projectName: String(form.name || ''),
            groupId: productId,
            groupName: String(form.name || ''),
            configuration: {
                initDataConfigured: true,
                productDashboard: true,
                productId,
            },
        });
    } catch (e) {
        console.warn($t('device.ProductSave.101005-0'), e);
        onlyMessage($t('device.ProductSave.101005-1'), 'warning');
    }
};
/**
 * 提交表单数据
 */
const submitData = () => {
    formRef.value
        .validate()
        .then(async () => {
            // 新增
          loading.value = true
            if (props.isAdd === 1) {
                const res = await addProduct(omit(toRaw(form), "type")).finally(()=>{
                    loading.value = false
                });
                if (res.success) {
                    // 新增产品成功后，同步创建产品仪表盘项目（失败不阻断）
                    if (res.result?.id) {
                        await ensureProductDashboardProject(String(res.result.id));
                    }
                    onlyMessage($t('Save.index.912481-22'));
                    visible.value = false;
                    emit('success');
                    dialogRef.value.show(res.result.id);
                } else {
                    onlyMessage($t('Save.index.912481-23'), 'error');
                }
            } else if (props.isAdd === 2) {
                // 编辑
                form.classifiedId = form.classifiedId || ''
                form.classifiedName = form.classifiedName || ''
                const res = await editProduct(form).finally(() => {
                  loading.value = false
                });
                if (res.success) {
                    onlyMessage($t('Save.index.912481-22'));
                    emit('success');
                    visible.value = false;
                } else {
                    onlyMessage($t('Save.index.912481-23'), 'error');
                }
            }
        })
        .catch((err: any) => {});
};
/**
 * 初始化
 */
queryProductTree();

const changeDeviceType = (value: Array<string>) => {
    form.deviceType = value[0];
};

defineExpose({
    show: show,
});
</script>
<style scoped lang="less">
.product-save {
    &__title {
        display: flex;
        align-items: center;
        gap: var(--space-3);

        h3 {
            margin: 0;
            color: var(--jet-theme-text);
            font-size: var(--fs-h3);
            font-weight: 700;
        }
    }

    &__title-icon {
        display: inline-grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--jet-theme-radius);
        background: var(--jet-theme-primary-soft);
        color: var(--jet-theme-primary);

        :deep(svg) {
            width: 1rem;
            height: 1rem;
        }
    }

    &__form {
        display: grid;
        gap: var(--space-4);
    }

    &__identity {
        :deep(.ant-form-item) {
            margin-bottom: var(--space-3);
        }
    }

    &__fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
    }

    &__field {
        margin-bottom: 0;
        min-width: 0;
    }

    &__field--full {
        grid-column: 1 / -1;
    }

    &__device-type {
        :deep(.j-card-select .j-card-select-item) {
            min-height: 4.75rem;
            border-radius: var(--radius-jet-md);
        }
    }
}

@media (width <= 33.75rem) {
    .product-save {
        &__fields {
            grid-template-columns: 1fr;
        }

        &__field--full {
            grid-column: auto;
        }
    }
}
.select-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;

    > div {
        min-width: 0;
    }

    span {
        white-space: nowrap;
    }
}
</style>
