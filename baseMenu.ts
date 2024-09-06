export default [
    {
        code: 'iot',
        name: '物联网',
        owner: 'iot',
        id: '9c21f88182e7cc75cbdfa8e4b7844272',
        url: '/iot',
        icon: 'icon-wulianwang',
        sortIndex: 1,
        permissions: [],
        children: [
            {
                code: 'home',
                name: '首页',
                owner: 'iot',
                //parentId: '1',
                id: 'd56cfb0076ecc4ff2d8503b39b3dbf1c',
                url: '/iot/home',
                icon: 'icon-zhihuishequ',
                sortIndex: 1,
                showPage: ['dashboard', 'device-instance', 'device-product'],
                permissions: [
                    {
                        permission: 'device-product',
                        actions: ['query'],
                    },
                    {
                        permission: 'device-instance',
                        actions: ['query'],
                    },
                    {
                        permission: 'dashboard',
                        actions: ['query'],
                    },
                    {
                        permission: 'system_config',
                        actions: ['query'],
                    },
                    {
                        permission: 'open-api',
                        actions: ['query'],
                    },
                ],
                accessSupport: { text: "不支持", value: "unsupported" },
                supportDataAccess: false
            },
            {
                code: 'device',
                name: '设备管理',
                owner: 'iot',
                //parentId: '1',
                id: 'b6327c3ff01b49c9a7a96101606dc27a',
                url: '/iot/device',
                icon: 'icon-shebei',
                sortIndex: 3,
                permissions: [],
                showPage: [],
                children: [
                    {
                        code: 'device/DashBoard',
                        name: '仪表盘',
                        owner: 'iot',
                        //parentId: '1-3',
                        id: '68a02c9efa9fb4885c89b007f97d074d',
                        url: '/iot/device/DashBoard',
                        icon: 'icon-keshihua',
                        sortIndex: 1,
                        showPage: ['dashboard', 'device-product', 'device-instance'],
                        permissions: [
                            {
                                permission: 'device-product',
                                actions: ['query'],
                            },
                            {
                                permission: 'dashboard',
                                actions: ['query'],
                            },
                            {
                                permission: 'device-instance',
                                actions: ['query'],
                            },
                            {
                                permission: 'geo-manager',
                                actions: ['find-geo'],
                            },
                            {
                                permission: 'system_config',
                                actions: ['query'],
                            },
                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'device/Product',
                        name: '产品',
                        owner: 'iot',
                        //parentId: '1-3',
                        id: '8ddbb67de5f65514105d47b448bfd70e',
                        url: '/iot/device/Product',
                        icon: 'icon-chanpin',
                        sortIndex: 2,
                        assetType: 'product',
                        showPage: ['device-product'],
                        permissions: [
                            {
                                permission: 'transparent-codec',
                                actions: ['query', 'save'],
                            },
                            {
                                permission: 'network-config',
                                actions: ['query'],
                            },
                            {
                                permission: 'file',
                                actions: ['upload-static'],
                            },
                            {
                                permission: 'device-product',
                                actions: ['query'],
                            },
                            {
                                permission: 'device-category',
                                actions: ['query'],
                            },
                            {
                                permission: 'device-mapping',
                                actions: ['query', 'save'],
                            },
                            {
                                permission: 'device-instance',
                                actions: ['query'],
                            },
                        ],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-mapping',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['save'],
                                    },
                                ],
                            },
                            {
                                id: 'action',
                                name: '启/禁用',
                                permissions: [
                                    {
                                        permission: 'device-product',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'export',
                                name: '导出',
                                permissions: [
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'import',
                                name: '导入',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'device-product',
                                        actions: ['delete'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                ],
                            },
                        ],
                        accessSupport: { text: "支持", value: "support" },
                        supportDataAccess: true
                    },
                    {
                        code: 'device/Instance',
                        name: '设备',
                        owner: 'iot',
                        //parentId: '1-3',
                        id: '1b136e7e4e4e74bb24b91802e4cfcd2d',
                        url: '/iot/device/Instance',
                        icon: 'icon-shebei',
                        sortIndex: 3,
                        accessSupport: { text: "支持", value: "support" },
                        supportDataAccess: true,
                        assetType: 'device',
                        showPage: ['device-instance'],
                        permissions: [
                            {
                                permission: 'transparent-codec',
                                actions: ['query'],
                            },
                            {
                                permission: 'protocol-supports',
                                actions: ['query'],
                            },
                            {
                                permission: 'device-api',
                                actions: ['query-device-events'],
                            },
                            {
                                permission: 'things-collector',
                                actions: ['save', 'delete'],
                            },
                            {
                                permission: 'edge-operations',
                                actions: ['invoke'],
                            },
                            {
                                permission: 'device-gateway',
                                actions: ['query'],
                            },
                            {
                                permission: 'system_config',
                                actions: ['query'],
                            },
                        ],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'export',
                                name: '导出',
                                permissions: [
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query', 'export'],
                                    },
                                ],
                            },
                            {
                                id: 'import',
                                name: '导入',
                                permissions: [
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['import', 'query'],
                                    },
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                    {
                                        permission: 'visualization',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'organization',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-opt-api',
                                        actions: ['read-property', 'invoke-function', 'write-property'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'dictionary',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-category',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-mapping',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'media-server',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'dashboard',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'action',
                                name: '启/禁用',
                                permissions: [
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['enable', 'disable', 'query'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query', 'delete'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        code: 'device/Category',
                        name: '产品分类',
                        owner: 'iot',
                        //parentId: '1-3',
                        id: 'bc83f18659982abb9ac1a96362fc3372',
                        sortIndex: 4,
                        url: '/iot/device/Category',
                        icon: 'icon-chanpinfenlei',
                        accessSupport: { text: "支持", value: "support" },
                        supportDataAccess: true,
                        assetType: 'deviceCategory',
                        showPage: ['device-category'],
                        permissions: [],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'device-category',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'device-category',
                                        actions: ['query', 'delete'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'device-category',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'device-category',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                code: 'link',
                name: '运维管理',
                owner: 'iot',
                //parentId: '1',
                id: 'bd55cdc9d0c1700afe628f572f91c22e',
                url: '/iot/link',
                icon: 'icon-yunweiguanli-1',
                permissions: [],
                sortIndex: 4,
                children: [
                    {
                        code: 'link/DashBoard',
                        name: '仪表盘',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: '47bedff9df89ecc0f0ce896e53805f02',
                        sortIndex: 1,
                        url: '/iot/link/dashboard',
                        icon: 'icon-keshihua',
                        showPage: ['dashboard', 'network-config'],
                        permissions: [
                            {
                                permission: 'network-config',
                                actions: ['query'],
                            },
                            {
                                permission: 'dashboard',
                                actions: ['query'],
                            },
                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'link/AccessConfig',
                        name: '设备接入网关',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: '10e67b761ec1f4206fabf36fcf9d9b0b',
                        sortIndex: 2,
                        url: '/iot/link/accessConfig',
                        icon: 'icon-wangguanzishebei',
                        showPage: ['device-gateway'],
                        permissions: [],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'network-config',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query', 'delete'],
                                    },
                                ],
                            },
                            {
                                id: 'action',
                                name: '启/禁用',
                                permissions: [
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'opc-point',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'network-config',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'opc-client',
                                        actions: ['query', 'save', 'delete'],
                                    },
                                    {
                                        permission: 'opc-device-bind',
                                        actions: ['query', 'save', 'delete'],
                                    },
                                    {
                                        permission: 'gb28181-cascade',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'opc-point',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'certificate',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'network-config',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'media-gateway',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-gateway',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'opc-client',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'opc-device-bind',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'gb28181-cascade',
                                        actions: ['query'],
                                    },
                                ],
                            },
                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'link/Protocol',
                        name: '协议管理',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: 'cdd73c8cb02d1ae9af61ded7fc31e9c5',
                        sortIndex: 3,
                        url: '/iot/link/protocol',
                        icon: 'icon-tongzhiguanli',
                        showPage: ['protocol-supports'],
                        permissions: [],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query', 'delete'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                    {
                                        permission: 'system_config',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'protocol-supports',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'file',
                                        actions: ['upload-static'],
                                    },
                                    {
                                        permission: 'system_config',
                                        actions: ['query'],
                                    },
                                ],
                            },
                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'Log',
                        name: '日志管理',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: 'c340f8977e0d221da893715cab58ae8c',
                        sortIndex: 4,
                        url: '/iot/link/Log',
                        icon: 'icon-rizhifuwu',
                        showPage: ['system-logger', 'access-logger'],
                        permissions: [
                            {
                                permission: 'system-logger',
                                actions: ['query'],
                            },
                            {
                                permission: 'access-logger',
                                actions: ['self-data', 'query'],
                            },
                        ],
                        buttons: [],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'link/Type',
                        name: '网络组件',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: 'f99acd0b64f96209eb276236cfb427cb',
                        sortIndex: 5,
                        url: '/iot/link/type',
                        icon: 'icon-wangluozujian',
                        showPage: ['network-config'],
                        permissions: [],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'network-config',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'certificate',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'action',
                                name: '启/禁用',
                                permissions: [
                                    {
                                        permission: 'network-config',
                                        actions: ['query', 'save', 'action'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'network-config',
                                        actions: ['query', 'delete'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'network-config',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'certificate',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'network-config',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'certificate',
                                        actions: ['query'],
                                    },
                                ],
                            },
                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'link/Certificate',
                        name: '证书管理',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: 'e395655a273a1b765236342738289587',
                        sortIndex: 6,
                        url: '/iot/link/Certificate',
                        icon: 'icon-zhengshuguanli',
                        showPage: ['certificate'],
                        permissions: [],
                        buttons: [
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'certificate',
                                        actions: ['query', 'delete'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'certificate',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'certificate',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'certificate',
                                        actions: ['query'],
                                    },
                                ],
                            },
                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'media/Stream',
                        name: '流媒体服务',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: '82fd382e97bc132aa1a6cc926d804d48',
                        sortIndex: 7,
                        url: '/iot/link/Stream',
                        icon: 'icon-xuanzetongdao1',
                        showPage: ['media-server'],
                        permissions: [],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'media-server',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'media-server',
                                        actions: ['query', 'delete'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'media-server',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                            {
                                id: 'action',
                                name: '启/禁用',
                                permissions: [
                                    {
                                        permission: 'media-server',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'media-server',
                                        actions: ['query', 'save'],
                                    },
                                ],
                            },
                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false
                    },
                    {
                        code: 'device/Firmware',
                        name: '远程升级',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: 'e0943d4c2fa539e89df1ff92e3379477',
                        sortIndex: 9,
                        url: '/iot/link/firmware',
                        icon: 'icon-yuanchengshengji',
                        showPage: ['firmware-manager'],
                        permissions: [],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'firmware-upgrade-task-manager',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'firmware-manager',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'firmware-upgrade-task-manager',
                                        actions: ['query', 'save', 'deploy'],
                                    },
                                    {
                                        permission: 'firmware-manager',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'system_config',
                                        actions: ['query'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'firmware-manager',
                                        actions: ['query', 'delete'],
                                    },
                                    {
                                        permission: 'firmware-upgrade-task-manager',
                                        actions: ['delete'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'firmware-manager',
                                        actions: ['query', 'save'],
                                    },
                                    {
                                        permission: 'device-product',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'system_config',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'device-instance',
                                        actions: ['query'],
                                    },
                                    {
                                        permission: 'firmware-upgrade-task-manager',
                                        actions: ['query', 'save', 'deploy'],
                                    },
                                ],
                            },

                        ],
                        accessSupport: { text: "间接支持", value: "indirect" },
                        supportDataAccess: false,
                        indirectMenus: ['8ddbb67de5f65514105d47b448bfd70e']
                    },
                    {
                        code: 'link/plugin',
                        name: '插件管理',
                        owner: 'iot',
                        //parentId: '1-4',
                        id: 'a20354876e9519e48f5ed6710ba6efb3',
                        sortIndex: 10,
                        url: '/iot/link/plugin',
                        icon: 'BoxPlotOutlined',
                        showPage: ['plugin-driver'],
                        permissions: [
                            {
                                permission: 'plugin-driver',
                                actions: ['query'],
                            },
                        ],
                        buttons: [
                            {
                                id: 'view',
                                name: '查看',
                                permissions: [
                                    {
                                        permission: 'plugin-driver',
                                        actions: ['view'],
                                    },
                                ],
                            },
                            {
                                id: 'update',
                                name: '编辑',
                                permissions: [
                                    {
                                        permission: 'plugin-driver',
                                        actions: ['save'],
                                    },
                                ],
                            },
                            {
                                id: 'delete',
                                name: '删除',
                                permissions: [
                                    {
                                        permission: 'plugin-driver',
                                        actions: ['delete'],
                                    },
                                ],
                            },
                            {
                                id: 'add',
                                name: '新增',
                                permissions: [
                                    {
                                        permission: 'plugin-driver',
                                        actions: ['save'],
                                    },
                                ],
                            },

                        ],
                        accessSupport: { text: "不支持", value: "unsupported" },
                        supportDataAccess: false,
                    },
                ],
            },
        ],
    },
    {
        code: 'system',
        name: '系统管理',
        owner: 'iot',
        id: 'fd1670b860ae58cc58bcd01d027ccd35',
        url: '/system',
        icon: 'icon-xitongguanli1',
        sortIndex: 4,
        permissions: [],
        buttons: [],
        children: [
            {
                code: 'system/Relationship',
                name: '关系配置',
                owner: 'iot',
                //parentId: '3',
                id: '2fa02b8758fe82a6b9666f4ebb1bbd03',
                sortIndex: 7,
                url: '/system/Relationship',
                icon: 'icon-shuxingpeizhi',
                showPage: ['relation'],
                permissions: [],
                buttons: [
                    {
                        id: 'update',
                        name: '编辑',
                        permissions: [
                            {
                                permission: 'relation',
                                actions: ['query', 'save'],
                            },
                        ],
                    },
                    {
                        id: 'delete',
                        name: '删除',
                        permissions: [
                            {
                                permission: 'relation',
                                actions: ['query', 'delete'],
                            },
                        ],
                    },
                    {
                        id: 'view',
                        name: '查看',
                        permissions: [
                            {
                                permission: 'relation',
                                actions: ['query'],
                            },
                        ],
                    },
                    {
                        id: 'add',
                        name: '新增',
                        permissions: [
                            {
                                permission: 'relation',
                                actions: ['query', 'save'],
                            },
                        ],
                    },
                ],
                accessSupport: { text: "不支持", value: "unsupported" },
                supportDataAccess: false
            },
        ]
    }
]
