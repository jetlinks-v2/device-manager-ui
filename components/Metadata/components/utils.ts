import {randomString} from "@jetlinks-web/utils";
import {onBeforeUnmount, onMounted, ref, Ref} from "vue";
import i18n from "@jetlinks-web-core/locales";

const maskIds: string[] = []
let bodyStyle: { overflow: string, width: string } | undefined
export const maskNodeClassName = 'popover-mask'

const bodyHasScrollbar = () => {
    return document.body.scrollHeight > document.body.clientHeight;
};

const updateStyle = (dom: HTMLElement | null | undefined, style: Record<string, any>) => {
    if (!dom) return

    Object.keys(style).forEach(key => {
        dom.style[key] = style[key]
    })
}

const bodyHidden = () => {
    const hasScrollbar = bodyHasScrollbar()

    if (hasScrollbar) {
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if(scrollBarWidth > 0){
            bodyStyle ??= { overflow: document.body.style.overflow, width: document.body.style.width }
            updateStyle(document.body as HTMLElement, {
                overflow: 'hidden',
                width: `calc(100% - ${scrollBarWidth}px)`,
            })
        }
    }
}

const getMaskNode = (id: string, warpClassNames: string) => {
    let maskNode = document.querySelector(`#${id}`) as HTMLElement

    if (maskNode) {
        return maskNode
    }

    maskNode = document.createElement('div')
    maskNode.id = id

    updateStyle(maskNode, {
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        'z-index': 1070,
        'background-color': '#0003'
    })

    const warpNode = document.querySelector(`.${warpClassNames}`) as HTMLDivElement
    if (!warpNode) return undefined

    warpNode.insertAdjacentElement('beforebegin', maskNode)

    return maskNode

}

export const useMask = (propVisible: boolean, options: { visibleChange: (visible: boolean) => void }): {
    warpClassNames: string,
    visible: Ref<boolean>,
    hideMask: Function,
    showMask: Function,
    visibleChange: (visible: boolean) => void
} => {
    const key = randomString(6)
    const visible = ref(propVisible)
    const maskDomId = `${maskNodeClassName}-${key}`
    let showTimer: ReturnType<typeof setTimeout> | undefined

    const warpClassNames = `${maskNodeClassName}-warp-${key}`
    const createMask = () => {
        if (!maskIds.includes(maskDomId)) {
            maskIds.push(maskDomId)
        }

        return getMaskNode(maskDomId, warpClassNames)
    }

    // 嵌套编辑只显示最上层遮罩，关闭后恢复仍在编辑的上一层。
    const updateMasks = () => {
        maskIds.forEach((id, index) => {
            updateStyle(document.getElementById(id), {
                display: index === maskIds.length - 1 ? 'block' : 'none'
            })
        })
    }

    const showMask = () => {
        clearTimeout(showTimer)
        showTimer = setTimeout(() => {
            bodyHidden()
            createMask()
            updateMasks()
        }, 150)
    }

    const hideMask = () => {
        // 取消延迟创建，避免快速关闭或卸载后留下覆盖全页的遮罩。
        clearTimeout(showTimer)
        const index = maskIds.findIndex(key => key === maskDomId) // 当前遮罩层下标
        if (index < 0) return
        const maskNode = document.getElementById(maskDomId)
        maskIds.splice(index, 1)
        updateMasks()
        if (maskIds.length === 0 && bodyStyle) {
            updateStyle(document.body, bodyStyle)
            bodyStyle = undefined
        }

        maskNode?.remove()
    }

    const visibleChange = (v: boolean) => {
        if (visible.value === v) return
        visible.value = v
        options?.visibleChange(v)
        if (v) {
            showMask()
        } else {
            hideMask()
        }
    }

    onMounted(() => {
        if (visible.value) showMask()
    })
    onBeforeUnmount(hideMask)

    return {
        warpClassNames,
        visible,
        hideMask,
        showMask,
        visibleChange
    }
}

export const BooleanValueMap = () => ({
    trueText: i18n.global.t('Array.index.399995-3'),
    trueValue: 'true',
    falseText: i18n.global.t('Array.index.399995-4'),
    falseValue: 'false',
})
