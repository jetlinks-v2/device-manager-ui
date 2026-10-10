import type { AiClientToolFailureOptions } from '@jetlinks-web-core/layout/components/AiChat/clientTools'

export const DEVICE_SUBJECT_REQUIRED_CODE = 'device.subject_required'
export const DEVICE_DEVICE_ID_REQUIRED_CODE = 'device.device_id_required'

type DeviceSubjectRequiredKind = 'subject' | 'deviceId'

/** Report missing subject arguments through the shared failure contract, without choosing a page workflow. */
export const createDeviceSubjectRequiredError = (
  kind: DeviceSubjectRequiredKind,
  message: string,
) => {
  const deviceOnly = kind === 'deviceId'
  const identifier = { type: 'string', minLength: 1, pattern: '\\S' }
  const failure = {
    code: deviceOnly ? DEVICE_DEVICE_ID_REQUIRED_CODE : DEVICE_SUBJECT_REQUIRED_CODE,
    message,
    failureDisposition: 'request',
    recoveryAction: 'repair',
    retryable: false,
    repair: {
      ...(deviceOnly ? { field: 'deviceId' } : {}),
      maxAttempts: 1,
      requiredInput: {
        type: 'object',
        properties: deviceOnly
          ? { deviceId: identifier }
          : { deviceId: identifier, productId: identifier },
        ...(deviceOnly
          ? { required: ['deviceId'] }
          : { anyOf: [{ required: ['deviceId'] }, { required: ['productId'] }] }),
      },
    },
  } satisfies AiClientToolFailureOptions
  return Object.assign(new Error(message), failure)
}
