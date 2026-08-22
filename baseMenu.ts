import baseMenu from './baseMenu.json'
import p from './package.json'
import i18n from '@jetlinks-web-core/locales'

const buttonNameKeys: Record<string, string> = {
  record: 'IotMenu.button.record',
  add: 'IotMenu.button.add',
  update: 'IotMenu.button.update',
  delete: 'IotMenu.button.delete',
}

type MenuItem = {
  code?: string
  children?: MenuItem[]
  buttons?: MenuItem[]
  accessSupport?: { text?: string; value?: string } | string
  options?: Record<string, unknown>
  [key: string]: unknown
}

const handleMenu = (menus: MenuItem[], inheritedRuntime = false): MenuItem[] => menus.map(item => {
  const isRuntime = inheritedRuntime || item.owner === 'cloud' || item.owner === 'app'

  return {
    ...item,
    children: item.children ? handleMenu(item.children, isRuntime) : undefined,
    buttons: isRuntime
      ? item.buttons?.map(button => ({
          ...button,
          name: buttonNameKeys[String(button.id)]
            ? i18n.global.t(buttonNameKeys[String(button.id)])
            : button.name,
        }))
      : item.buttons,
    accessSupport: isRuntime && typeof item.accessSupport === 'object'
      ? {
          ...item.accessSupport,
          text: item.accessSupport.value === 'support'
            ? i18n.global.t('IotMenu.accessSupport.support')
            : item.accessSupport.text,
        }
      : item.accessSupport,
    options: { appName: p.id || p.name, ...item.options },
    ...(isRuntime ? { runtime: true } : {}),
  }
})

export default () => {
  return handleMenu(baseMenu)
}
