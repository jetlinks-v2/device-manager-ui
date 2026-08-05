export const deviceListConfig = {
  name: '设备列表',
  type: 'deviceList',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 6,
      h: 7,
      minW: 4,
      minH: 4
    },
    deviceList: {
      showDeviceType: true,
      showOnlineStatus: true,
      showActiveTime: true,
      // showAlarmStatus: true,
      // showRelatedProps: false,
      tableSize: 'large',
      showColumnDivider: false,
      selectedRowBgColor: '#e6f7ff',
      selectFirstByDefault: false
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
