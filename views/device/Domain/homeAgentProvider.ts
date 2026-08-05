import i18n from '@jetlinks-web-core/locales';
import {
  registerHomeAgentCapabilityProvider,
  type HomeAgentCapabilityContext,
  type HomeAgentCapabilityProvider,
} from '@jetlinks-web-core/layout/components/AiChat/homeAgentCapabilities';
import {
  createDeviceDomainTools,
  DEVICE_DOMAIN_MENU_CODES,
  isDeviceDomainAvailable,
  isDeviceInstanceAvailable,
  isDeviceProductAvailable,
} from './agentDeviceDomainTools';

const createDeviceDomainCapabilities = (context: HomeAgentCapabilityContext) => {
  const capabilities = [];

  if (isDeviceProductAvailable(context)) {
    capabilities.push({
      id: 'device-domain:product-model',
      name: i18n.global.t('Domain.homeAgent.capability.productModel.name'),
      description: i18n.global.t('Domain.homeAgent.capability.productModel.description'),
      kind: 'tool' as const,
      category: 'device-domain',
      menuCode: DEVICE_DOMAIN_MENU_CODES.product,
      routeName: DEVICE_DOMAIN_MENU_CODES.product,
      order: 30,
      keywords: ['product', 'metadata', 'model', 'thing model', '物模型', '产品', '规则配置'],
      metadata: {
        promptExamples: [
          i18n.global.t('Domain.homeAgent.prompt.productModelForRule'),
        ],
      },
    });
  }

  if (isDeviceInstanceAvailable(context)) {
    capabilities.push(
      {
        id: 'device-domain:device-model',
        name: i18n.global.t('Domain.homeAgent.capability.deviceModel.name'),
        description: i18n.global.t('Domain.homeAgent.capability.deviceModel.description'),
        kind: 'tool' as const,
        category: 'device-domain',
        menuCode: DEVICE_DOMAIN_MENU_CODES.instance,
        routeName: DEVICE_DOMAIN_MENU_CODES.instance,
        order: 31,
        keywords: ['device', 'metadata', 'model', 'thing model', '物模型', '设备', '规则配置'],
        metadata: {
          promptExamples: [
            i18n.global.t('Domain.homeAgent.prompt.deviceModelForRule'),
          ],
        },
      },
      {
        id: 'device-domain:device-history',
        name: i18n.global.t('Domain.homeAgent.capability.deviceHistory.name'),
        description: i18n.global.t('Domain.homeAgent.capability.deviceHistory.description'),
        kind: 'tool' as const,
        category: 'device-domain',
        menuCode: DEVICE_DOMAIN_MENU_CODES.instance,
        routeName: DEVICE_DOMAIN_MENU_CODES.instance,
        order: 32,
        keywords: ['device', 'property history', 'aggregate', 'diagnosis', '历史数据', '属性历史', '规则诊断'],
        metadata: {
          promptExamples: [
            i18n.global.t('Domain.homeAgent.prompt.historyForDiagnosis'),
          ],
        },
      },
    );
  }

  return capabilities;
};

export const deviceDomainHomeAgentProvider: HomeAgentCapabilityProvider = {
  id: 'device-domain',
  order: 85,
  getCapabilities: (context) => (isDeviceDomainAvailable(context)
    ? createDeviceDomainCapabilities(context)
    : []),
  getClientTools: (context) => (isDeviceDomainAvailable(context)
    ? createDeviceDomainTools({
      includeDeviceTools: isDeviceInstanceAvailable(context),
      includeProductTools: isDeviceProductAvailable(context),
    })
    : []),
  getPromptExamples: (context) => (isDeviceDomainAvailable(context)
    ? [
      ...(isDeviceProductAvailable(context) ? [i18n.global.t('Domain.homeAgent.prompt.productModelForRule')] : []),
      ...(isDeviceInstanceAvailable(context) ? [
        i18n.global.t('Domain.homeAgent.prompt.deviceModelForRule'),
        i18n.global.t('Domain.homeAgent.prompt.historyForDiagnosis'),
      ] : []),
    ]
    : []),
  getSystemPromptLines: (context) => (isDeviceDomainAvailable(context)
    ? i18n.global.t('Domain.homeAgent.prompt.globalSystem')
    : []),
};

export const registerDeviceDomainHomeAgentProvider = () => (
  registerHomeAgentCapabilityProvider(deviceDomainHomeAgentProvider)
);

export default deviceDomainHomeAgentProvider;
