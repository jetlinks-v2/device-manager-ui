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
  children?: MenuItem[]
  buttons?: MenuItem[]
  accessSupport?: { text?: string; value?: string } | string
  options?: Record<string, unknown>
  [key: string]: unknown
}

const handleMenu = (menus: MenuItem[]): MenuItem[] => menus.map(item => ({
  ...item,
  children: item.children ? handleMenu(item.children) : undefined,
  buttons: item.buttons?.map(button => ({
    ...button,
    name: buttonNameKeys[String(button.id)]
      ? i18n.global.t(buttonNameKeys[String(button.id)])
      : button.name,
  })),
  accessSupport: typeof item.accessSupport === 'object'
    ? {
        ...item.accessSupport,
        text: item.accessSupport.value === 'support'
          ? i18n.global.t('IotMenu.accessSupport.support')
          : item.accessSupport.text,
      }
    : item.accessSupport,
  options: { appName: p.id || p.name, ...item.options },
  runtime: true,
}))

export default () => {
  return handleMenu(baseMenu)
}

