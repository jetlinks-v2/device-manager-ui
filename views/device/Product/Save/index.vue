<!-- 新增、编辑产品 -->
<template>
    <a-modal
        :title="props.title"
        :maskClosable="false"
        destroy-on-close
        v-model:visible="visible"
        @ok="submitData"
        @cancel="close"
        okText="确定"
        cancelText="取消"
        width="650px"
        :confirmLoading="loading"
    >
        <div style="margin-top: 10px">
            <a-form
                layout="vertical"
                :model="form"
                :rules="rules"
                ref="formRef"
            >
                <a-row type="flex">
                    <a-col flex="180px">
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
                    <a-col flex="auto">
                        <a-form-item name="id" :validateFirst="true">
                            <template #label>
                                <span>ID</span>
                                <a-tooltip
                                    title="若不填写，系统将自动生成唯一ID"
                                >
                                    <AIcon
                                        type="QuestionCircleOutlined"
                                        style="margin-left: 2px"
                                    />
                                </a-tooltip>
                            </template>
                            <a-input
                                v-model:value="form.id"
                                placeholder="请输入ID"
                                :disabled="idDisabled"
                            />
                        </a-form-item>
                        <a-form-item label="名称" name="name">
                            <a-input
                                v-model:value="form.name"
                                placeholder="请输入名称"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>
                <a-form-item label="产品分类" name="classifiedId">
                    <a-tree-select
                        showSearch
                        v-model:value="form.classifiedId"
                        placeholder="请选择产品分类"
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
                <a-form-item label="设备类型" name="deviceType">
                    <j-card-select
                        v-model:value="form.deviceType"
                        :options="deviceList"
                        :disabled="productStore.detail?.accessId ? true : false"
                        @change="changeDeviceType"
                    >
                        <template #title="item">
                            <span>{{ item.title }}</span>
                            <a-tooltip :title="item.option.tooltip"
                                ><AIcon
                                    type="QuestionCircleOutlined"
                                    style="margin-left: 2px"
                                />
                            </a-tooltip>
                        </template>
                    </j-card-select>
                </a-form-item>
                <a-form-item label="说明" name="description">
                    <a-textarea
                        :maxlength="200"
                        showCount
                        :auto-size="{ minRows: 4, maxRows: 5 }"
                        v-model:value="form.describe"
                        placeholder="请输入说明"
                    />
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
    <DialogTips ref="dialogRef" />
</template>

<script lang="ts" setup>
import { category, queryProductId, addProduct, editProduct } from '../../../../api/product';
import { Form } from 'ant-design-vue';
import DialogTips from '../DialogTips/index.vue';
import { useProductStore } from '../../../../store/product';
import { filterSelectNode, encodeQuery } from '@/utils';
import { onlyMessage } from '@jetlinks-web/utils'
import { isInput } from '@/utils/regular';
import type { Rule } from 'ant-design-vue/es/form';
import { device} from '../../../../assets'

const productStore = useProductStore();
const emit = defineEmits(['success']);

const props = defineProps({
    title: {
        type: String,
        defult: '',
    },
    isAdd: {
        type: Number,
        default: 0,
    },
});
const loading = ref<boolean>(false);
const dialogRef = ref();
const treeList = ref<Record<string, any>[]>([]);
const visible = ref<boolean>(false);
const formRef = ref();
const idDisabled = ref<boolean>(false);
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
        label: '直连设备',
        value: 'device',
        iconUrl: device.deviceType1,
        tooltip: '直连物联网平台的设备',
    },
    {
        label: '网关子设备',
        value: 'childrenDevice',
        iconUrl: device.deviceType2,
        tooltip: '作为网关的子设备，由网关代理连接到物联网平台',
    },
    {
        label: '网关设备',
        value: 'gateway',
        iconUrl: device.deviceType3,
        tooltip: '能挂载子设备与平台进行通信的设备',
    },
]);

const form = reactive({
    id: undefined,
    name: '',
    classifiedId: undefined,
    classifiedName: '',
    deviceType: '',
    describe: undefined,
    photoUrl: device.deviceProduct,
});
/**
 * 校验id
 */
const validateInput = async (_rule: Rule, value: string) => {
    if (value) {
        if (!isInput(value)) {
            return Promise.reject('请输入英文或者数字或者-或者_');
        } else {
            if (props.isAdd === 1) {
                const res = await queryProductId(value);
                if (res.success && res.result) {
                    return Promise.reject('ID重复');
                } else {
                    return Promise.resolve();
                }
            }
        }
    } else {
        return Promise.resolve();
    }
};
/**
 * 校验是否选择设备类型
 */
const validateDeviceType = async (_rule: Rule, value: string) => {
    if (!value) {
        return Promise.reject('请选择设备类型');
    } else {
        return Promise.resolve();
    }
};
const rules = reactive({
    id: [
        { validator: validateInput, trigger: 'blur' },
        { max: 64, message: '最多可输入64位字符', trigger: 'change' },
    ],
    name: [
        { required: true, message: '请输入名称', trigger: 'blur' },
        { max: 64, message: '最多可输入64位字符', trigger: 'change' },
    ],
    deviceType: [
        {
            required: true,
            validator: validateDeviceType,
            trigger: 'blur',
        },
    ],
    description: [
        { max: 200, message: '最多可输入200位字符', trigger: 'blur' },
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
const show = (data: any) => {
    if (props.isAdd === 2) {
        productStore.refresh(data.id);
        form.name = data.name;
        form.classifiedId = data.classifiedId;
        form.classifiedName = data.classifiedName;
        form.photoUrl = data.photoUrl || photoValue.value;
        form.deviceType = data.deviceType.value;
        form.describe = data.describe;
        form.id = data.id;
        idDisabled.value = true;
    } else if (props.isAdd === 1) {
        productStore.reSet();
        form.name = '';
        form.classifiedId = undefined;
        form.classifiedName = '';
        form.photoUrl = device.deviceProduct;
        form.deviceType = '';
        form.describe = undefined;
        form.id = undefined;
        idDisabled.value = false;
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
                if (form.id === '') {
                    form.id = undefined;
                }
                const res = await addProduct(form).finally(()=>{
                    loading.value = false
                });
                if (res.status === 200) {
                    onlyMessage('保存成功！');
                    visible.value = false;
                    emit('success');
                    dialogRef.value.show(res.result.id);
                } else {
                    onlyMessage('操作失败', 'error');
                }
            } else if (props.isAdd === 2) {
                // 编辑
                form.classifiedId
                    ? form.classifiedId
                    : (form.classifiedId = ''); // 产品分类不选传空字符串
                form.classifiedName
                    ? form.classifiedName
                    : (form.classifiedName = '');
                const res = await editProduct(form).finally(() => {
                  loading.value = false
                });
                if (res.status === 200) {
                    onlyMessage('保存成功！');
                    emit('success');
                    visible.value = false;
                } else {
                    onlyMessage('操作失败', 'error');
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
.card-style {
    position: relative;
    top: 19px;
}
.upload-image-warp-logo {
    display: flex;
    justify-content: flex-start;
    .upload-image-border-logo {
        position: relative;
        overflow: hidden;
        border: 1px dashed #d9d9d9;
        transition: all 0.3s;
        width: 160px;
        height: 150px;
        &:hover {
            border: 1px dashed #1890ff;
            display: flex;
        }
        .upload-image-content-logo {
            align-items: center;
            justify-content: center;
            position: relative;
            display: flex;
            flex-direction: column;
            width: 160px;
            height: 150px;
            padding: 8px;
            background-color: rgba(0, 0, 0, 0.06);
            cursor: pointer;
            .loading-logo {
                position: absolute;
                top: 50%;
            }
            .loading-icon {
                position: absolute;
            }
            .upload-image {
                width: 100%;
                height: 100%;
                background-repeat: no-repeat;
                background-position: 50%;
                background-size: cover;
            }
            .upload-image-icon {
                width: 100%;
                height: 100%;
                background-repeat: no-repeat;
                background-position: 50%;
                background-size: inherit;
            }
            .upload-image-mask {
                align-items: center;
                justify-content: center;
                position: absolute;
                top: 0;
                left: 0;
                display: none;
                width: 100%;
                height: 100%;
                color: #fff;
                font-size: 16px;
                background-color: rgba(0, 0, 0, 0.35);
            }
            &:hover .upload-image-mask {
                display: flex;
            }
        }
    }
}
.button-style {
    background-color: #fff;
    height: 66px;
    overflow: hidden;
    .card-content {
        width: 100%;
        .img-style {
            position: relative;
            top: 16px;
        }
        .checked-icon {
            position: absolute;
            right: -22px;
            bottom: -22px;
            z-index: 2;

            width: 44px;
            height: 44px;
            color: #fff;
            background-color: @primary-color-active;
            transform: rotate(-45deg);

            > div {
                position: relative;
                height: 100%;
                transform: rotate(45deg);

                > span {
                    position: absolute;
                    top: 6px;
                    left: 6px;
                    font-size: 12px;
                }
            }
        }
        &.checked {
            position: relative;
            color: @primary-color-active;
            border-color: @primary-color-active;

            > .checked-icon {
                display: block;
            }
        }
    }
}
</style>
