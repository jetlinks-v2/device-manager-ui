import {deviceNumber} from '@visualization-dashboard-ui/assets/dashboard'

export const customImageCardConfig = {
  name: '数量卡片',
  type: 'customImageCard',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 4,
      h: 5,
      minW: 3,
      minH: 5
    },
    customImageCard: {
      topTitle: '产品数量',
      bottomLeftTitle: '正常',
      bottomLeftStatus: 'success',
      bottomRightTitle: '禁用',
      bottomRightStatus: 'error',
      tooltip: '',
      img: deviceNumber,
      imageChannel: 'network',
      _param_1: 12,
      _param_2: 1,
      _param_3: 2
    }
  },
  dataSourceProps: {
    sourceId: '',
    type: 'string',
    defaultValue: {
      _param_1: 0,
      _param_2: 0,
      _param_3: 0
    },
    mapping: {
      _param_1: '',
      _param_2: '',
      _param_3: ''
    }
  }
}
