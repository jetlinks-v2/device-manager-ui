import MenuContext from './menu.vue'
import { h, render } from 'vue'
import {handlePureRecord} from "../../utils";
import {omit} from "lodash-es";

let curInstance: Record<string, any> | null = null
let seed = 1
let copyValue: any
const contextMenu = (e: MouseEvent, data: any, context: any) => {
    if (curInstance) {
        curInstance.destroy()
    }
    curInstance = null

    let id = seed++
    // 创建一个临时的div，用于挂载我们的菜单
    const container = document.createElement('div') as HTMLElement
    // 固定定位挂到视口根节点，避免表格祖先的 backdrop-filter 改变包含块；全屏菜单必须留在全屏元素内。
    const appendTo = document.fullscreenElement || document.body
    // 传给menu组件的props
    const props = {
        data: data,
        onClose: () => {
            // 失焦回调可能在下一次右键后才执行，只允许关闭所属菜单。
            if (curInstance?.id === id) {
                curInstance.destroy()
            }
        },
        onClick: (type: string) => {
            const copyRecord = handlePureRecord(copyValue)
            if (copyRecord.expands) {
                copyRecord.expands = omit(copyRecord.expands, ['isProduct'])
            }
            context.click(type, data, handlePureRecord(copyRecord))
        },
        onCopy: (data: any) => {
            copyValue = data
            context.click('copy', data)
        },
        paste: !!copyValue
    }

    // 渲染虚拟节点
    const vnode = h(
        MenuContext,
        props
    )
    // vnode为需要渲染的虚拟节点，container为渲染的容器
    render(vnode, container)
    // 首先需要先把菜单真正渲染到页面，才能拿到它的宽度和高度
    appendTo.appendChild(container.firstElementChild as Node)
    // 当前真正的菜单节点，上面输出的vnode中可以看到，el就是我们的菜单节点
    const curMenu = vnode.el as HTMLElement
    // 获取curMenu的高度和宽度，用于临界的计算
    const { offsetWidth, offsetHeight } = curMenu
    const { clientWidth, clientHeight } = document.documentElement
    const { clientX, clientY } = e

    // 与鼠标使用同一视口坐标系，空间不足时向鼠标左侧或上方展开，并限制在视口内。
    const left = clientX + offsetWidth <= clientWidth ? clientX : clientX - offsetWidth
    const top = clientY + offsetHeight <= clientHeight ? clientY : clientY - offsetHeight
    curMenu.style.left = `${Math.max(0, Math.min(left, clientWidth - offsetWidth))}px`
    curMenu.style.top = `${Math.max(0, Math.min(top, clientHeight - offsetHeight))}px`

    const instance = {
        id,
        destroy: () => {
            if (curInstance?.id === id) {
                curInstance = null
            }
            render(null, container)
        },
        cleanCopy: () => {
            copyValue = null
        }
    }
    curInstance = instance

    return instance
}

export default contextMenu
