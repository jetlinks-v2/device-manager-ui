const routerModules = import.meta.glob('./views/**/index.vue')

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
                    url: '/detail:id',
                    name: '详情信息',
                    component: () => import('./views/device/Product/Detail/index.vue')
                }
            ]
        },
        'device/Instance': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail:id',
                    name: '详情信息',
                    component: () => import('./views/device/Instance/Detail/index.vue')
                }
            ]
        },
        'link/AccessConfig': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail:id',
                    name: '详情信息',
                    component: () => import('./views/link/AccessConfig/Detail/index.vue')
                }
            ]
        },
        'link/Certificate': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail:id',
                    name: '详情信息',
                    component: () => import('./views/link/Certificate/Detail/index.vue')
                }
            ]
        },
        'link/Type': {
            children: [
                {
                    code: 'Detail',
                    url: '/detail:id',
                    name: '详情信息',
                    component: () => import('./views/link/Type/Detail/index.vue')
                }
            ]
        }
    }
}

const aliasName = 'device'

export default {
    getAsyncRoutesMap,
    getExtraRoutesMap,
    aliasName
}
