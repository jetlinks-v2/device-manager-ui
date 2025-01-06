const routerModules = import.meta.glob('./views/**/index.vue')
import { defineAsyncComponent } from 'vue';
import i18n from "@/locales";

const MODULE_CODE = 'device'

const getAsyncRoutesMap = () => {
    const modules = {}
    Object.keys(routerModules).forEach(item => {
        const code = item.replace('./views/', '').replace('/index.vue', '')
        const key = `${code}`
        // const key = `${MODULE_CODE}/${code}` // views下不存在多模块时
        modules[key] = routerModules[item]
    })

    return modules
}

const getExtraRoutesMap = () => {
    return {
        'device/Product': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail/:id',
                    name: i18n.global.t('device-manager-ui.index.106686-0'),
                    component: () => import('./views/device/Product/Detail/index.vue')
                }
            ]
        },
        'device/Instance': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail/:id',
                    name: i18n.global.t('device-manager-ui.index.106686-0'),
                    component: () => import('./views/device/Instance/Detail/index.vue')
                }
            ]
        },
        'link/AccessConfig': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail/:id',
                    name: i18n.global.t('device-manager-ui.index.106686-0'),
                    component: () => import('./views/link/AccessConfig/Detail/index.vue')
                }
            ]
        },
        'link/Certificate': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail/:id',
                    name: i18n.global.t('device-manager-ui.index.106686-0'),
                    component: () => import('./views/link/Certificate/Detail/index.vue')
                }
            ]
        },
        'link/Type': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail/:id',
                    name: i18n.global.t('device-manager-ui.index.106686-0'),
                    component: () => import('./views/link/Type/Detail/index.vue')
                }
            ]
        }
    }
}

const getComponents = () => {
    return {
        'department': [
            {
                name: 'product',
                label: 'Department.index.945805-0',
                component:  defineAsyncComponent(() => import('./views/department/product/index.vue'))
            },
            {
                name: 'device',
                label: 'Department.index.945805-1',
                component: defineAsyncComponent(() => import('./views/department/device/index.vue'))
            },
        ]
    }
}

const aliasName = 'device'

export default {
    getAsyncRoutesMap,
    getExtraRoutesMap,
    getComponents,
    aliasName
}
