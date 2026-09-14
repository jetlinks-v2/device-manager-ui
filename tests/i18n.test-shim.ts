const globalMessages: Record<string, unknown> = {}

const translate = (key: string, args?: unknown) => {
  if (Array.isArray(args)) {
    return `${key} ${args.join(' ')}`
  }
  return key
}

const i18n = {
  global: {
    t: translate,
    locale: { value: 'zh' },
    setLocaleMessage: (locale: string, messages: Record<string, unknown>) => {
      globalMessages[locale] = messages
    },
  },
}

export default i18n
