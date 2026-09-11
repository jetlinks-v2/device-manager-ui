export const individualCardConfig = {
  name: '属性卡片',
  type: 'individualCard',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      minW: 2,
      minH: 2
    },
    individualCard: {
      title: '',
      icon: 'ExperimentOutlined',
      iconColor: '#1aa37a',
      iconSize: 32,
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 32,
      value: '',
      valueColor: 'rgba(0, 0, 0, 0.88)',
      valueFontSize: 32,
      unit: '',
      unitColor: 'rgba(0, 0, 0, 0.88)',
      unitFontSize: 24,
      deviceId: '',
      deviceName: '',
      propertyId: '',
      propertyName: ''
    }
  }
}
