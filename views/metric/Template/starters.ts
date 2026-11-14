import type { MetricTemplateStarter } from '@jetlinks-web-core/components'

/** 创建参考随业务前端部署；校验和计算仍由后端完成。 */
const declarations: MetricTemplateStarter[] = [
  {
    "id": "communication-observation",
    "name": "通信状态与观测质量",
    "description": "查看当前连接、可选会话静默和历史观测事实。",
    "groupId": "connectivity",
    "icon": "WifiOutlined",
    "template": {
      "id": "iot-communication-observation",
      "version": "3",
      "name": "通信状态与观测质量",
      "thingType": "device",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "connectionState",
          "name": "平台连接状态",
          "valueType": {
            "type": "enum",
            "valueType": {
              "type": "int"
            },
            "elements": [
              {
                "value": 0,
                "text": "离线"
              },
              {
                "value": 1,
                "text": "在线"
              }
            ]
          },
          "source": {
            "lookback": "PT2H",
            "maxPoints": 512
          },
          "historyReconciliation": "PT5M"
        },
        {
          "id": "lastCommunicationTime",
          "name": "最近会话通信时间",
          "valueType": {
            "type": "date"
          },
          "presence": "optional"
        }
      ],
      "parameterDefinitions": [
        {
          "id": "activityAssessmentEnabled",
          "name": "评估会话通信静默",
          "valueType": {
            "type": "boolean"
          },
          "expands": {
            "defaultValue": false,
            "editable": true
          }
        },
        {
          "id": "communicationIdleSeconds",
          "name": "会话通信静默阈值",
          "valueType": {
            "type": "double",
            "scale": 4,
            "min": 1,
            "max": 604800,
            "unit": "s"
          },
          "expands": {
            "defaultValue": 180,
            "editable": true
          }
        }
      ],
      "parameters": {},
      "definitions": [
        {
          "id": "currentConnection",
          "name": "当前连接状态",
          "type": "composite",
          "dependsOn": [
            "connectionState"
          ],
          "inputs": [
            {
              "id": "connectionState",
              "metricId": "connectionState",
              "presence": "optional"
            }
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "stateTracking": {
            "maxNoData": "PT2M"
          },
          "options": {},
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "connectionState",
              "path": []
            }
          },
          "language": "spel",
          "resultType": {
            "type": "enum",
            "valueType": {
              "type": "int"
            },
            "elements": [
              {
                "value": 0,
                "text": "离线",
                "textI18n": {
                  "zh": "离线",
                  "en": "Offline"
                },
                "icon": "color:#ff4d4f"
              },
              {
                "value": 1,
                "text": "在线",
                "textI18n": {
                  "zh": "在线",
                  "en": "Online"
                },
                "icon": "color:#52c41a"
              }
            ]
          }
        },
        {
          "id": "connectionStatistics",
          "name": "近1小时连接统计",
          "type": "composite",
          "inputs": [
            {
              "id": "state",
              "metricId": "connectionState"
            }
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "calculator": {
            "provider": "state",
            "providerVersion": "1",
            "inputTypes": {
              "state": {
                "type": "array",
                "elementType": {
                  "type": "int"
                }
              }
            },
            "outputType": {
              "type": "object",
              "properties": [
                {
                  "id": "activeDuration",
                  "name": "已观测在线时长",
                  "valueType": {
                    "type": "double",
                    "scale": 4,
                    "unit": "s"
                  }
                },
                {
                  "id": "inactiveDuration",
                  "name": "已观测离线时长",
                  "valueType": {
                    "type": "double",
                    "scale": 4,
                    "unit": "s"
                  }
                },
                {
                  "id": "unknownDuration",
                  "name": "未知时长",
                  "valueType": {
                    "type": "double",
                    "scale": 4,
                    "unit": "s"
                  }
                },
                {
                  "id": "activeCount",
                  "name": "确认上线次数",
                  "valueType": {
                    "type": "double",
                    "scale": 4
                  }
                },
                {
                  "id": "inactiveCount",
                  "name": "确认掉线次数",
                  "valueType": {
                    "type": "double",
                    "scale": 4
                  }
                },
                {
                  "id": "coverage",
                  "name": "观测覆盖比例（0—1）",
                  "valueType": {
                    "type": "double",
                    "scale": 4
                  }
                }
              ]
            },
            "parameters": {
              "duration": "PT1H",
              "maxHold": "PT2M",
              "activeValue": 1,
              "inactiveValue": 0
            }
          }
        },
        {
          "id": "observedOnlineRatio",
          "name": "已观测时段在线率",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "inputs": [
            {
              "id": "connectionStatistics",
              "metricId": "connectionStatistics",
              "presence": "optional"
            }
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "logical",
                "operator": "or",
                "operands": [
                  {
                    "type": "binary",
                    "operator": "eq",
                    "left": {
                      "type": "reference",
                      "id": "connectionStatistics",
                      "path": []
                    },
                    "right": {
                      "type": "literal",
                      "valueType": "null",
                      "value": null
                    }
                  },
                  {
                    "type": "binary",
                    "operator": "le",
                    "left": {
                      "type": "binary",
                      "operator": "add",
                      "left": {
                        "type": "reference",
                        "id": "connectionStatistics",
                        "path": [
                          "activeDuration"
                        ]
                      },
                      "right": {
                        "type": "reference",
                        "id": "connectionStatistics",
                        "path": [
                          "inactiveDuration"
                        ]
                      }
                    },
                    "right": {
                      "type": "literal",
                      "valueType": "int",
                      "value": "0"
                    }
                  }
                ]
              },
              "whenTrue": {
                "type": "literal",
                "valueType": "null",
                "value": null
              },
              "whenFalse": {
                "type": "binary",
                "operator": "divide",
                "left": {
                  "type": "binary",
                  "operator": "multiply",
                  "left": {
                    "type": "literal",
                    "valueType": "double",
                    "value": "100.0"
                  },
                  "right": {
                    "type": "reference",
                    "id": "connectionStatistics",
                    "path": [
                      "activeDuration"
                    ]
                  }
                },
                "right": {
                  "type": "binary",
                  "operator": "add",
                  "left": {
                    "type": "reference",
                    "id": "connectionStatistics",
                    "path": [
                      "activeDuration"
                    ]
                  },
                  "right": {
                    "type": "reference",
                    "id": "connectionStatistics",
                    "path": [
                      "inactiveDuration"
                    ]
                  }
                }
              }
            }
          },
          "language": "spel"
        },
        {
          "id": "windowOfflineSeconds",
          "name": "近1小时离线时长",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "inputs": [
            {
              "id": "connectionStatistics",
              "metricId": "connectionStatistics",
              "presence": "optional"
            }
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "connectionStatistics",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "null",
                  "value": null
                }
              },
              "whenTrue": {
                "type": "literal",
                "valueType": "null",
                "value": null
              },
              "whenFalse": {
                "type": "reference",
                "id": "connectionStatistics",
                "path": [
                  "inactiveDuration"
                ]
              }
            }
          },
          "language": "spel"
        },
        {
          "id": "windowDisconnectCount",
          "name": "近1小时确认掉线次数",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "inputs": [
            {
              "id": "connectionStatistics",
              "metricId": "connectionStatistics",
              "presence": "optional"
            }
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "connectionStatistics",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "null",
                  "value": null
                }
              },
              "whenTrue": {
                "type": "literal",
                "valueType": "null",
                "value": null
              },
              "whenFalse": {
                "type": "reference",
                "id": "connectionStatistics",
                "path": [
                  "inactiveCount"
                ]
              }
            }
          },
          "language": "spel"
        },
        {
          "id": "windowUnknownSeconds",
          "name": "近1小时未知时长",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "inputs": [
            {
              "id": "connectionStatistics",
              "metricId": "connectionStatistics",
              "presence": "optional"
            }
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "connectionStatistics",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "null",
                  "value": null
                }
              },
              "whenTrue": {
                "type": "literal",
                "valueType": "null",
                "value": null
              },
              "whenFalse": {
                "type": "reference",
                "id": "connectionStatistics",
                "path": [
                  "unknownDuration"
                ]
              }
            }
          },
          "language": "spel"
        },
        {
          "id": "communicationAgeSeconds",
          "name": "距最近会话通信",
          "type": "composite",
          "dependsOn": [
            "lastCommunicationTime"
          ],
          "inputs": [
            {
              "id": "lastCommunicationTime",
              "metricId": "lastCommunicationTime",
              "presence": "optional"
            }
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "logical",
                "operator": "or",
                "operands": [
                  {
                    "type": "binary",
                    "operator": "eq",
                    "left": {
                      "type": "reference",
                      "id": "lastCommunicationTime",
                      "path": []
                    },
                    "right": {
                      "type": "literal",
                      "valueType": "null",
                      "value": null
                    }
                  },
                  {
                    "type": "binary",
                    "operator": "le",
                    "left": {
                      "type": "reference",
                      "id": "lastCommunicationTime",
                      "path": []
                    },
                    "right": {
                      "type": "literal",
                      "valueType": "int",
                      "value": "0"
                    }
                  },
                  {
                    "type": "binary",
                    "operator": "gt",
                    "left": {
                      "type": "reference",
                      "id": "lastCommunicationTime",
                      "path": []
                    },
                    "right": {
                      "type": "reference",
                      "id": "sample",
                      "path": [
                        "processTime"
                      ]
                    }
                  }
                ]
              },
              "whenTrue": {
                "type": "literal",
                "valueType": "null",
                "value": null
              },
              "whenFalse": {
                "type": "binary",
                "operator": "divide",
                "left": {
                  "type": "binary",
                  "operator": "subtract",
                  "left": {
                    "type": "reference",
                    "id": "sample",
                    "path": [
                      "processTime"
                    ]
                  },
                  "right": {
                    "type": "reference",
                    "id": "lastCommunicationTime",
                    "path": []
                  }
                },
                "right": {
                  "type": "literal",
                  "valueType": "double",
                  "value": "1000.0"
                }
              }
            }
          },
          "language": "spel",
          "resultType": {
            "type": "double",
            "unit": "s"
          }
        },
        {
          "id": "communicationState",
          "name": "当前通信状态",
          "type": "composite",
          "dependsOn": [
            "currentConnection",
            "communicationAgeSeconds"
          ],
          "inputs": [
            {
              "id": "currentConnection",
              "metricId": "currentConnection",
              "presence": "optional"
            },
            {
              "id": "communicationAgeSeconds",
              "metricId": "communicationAgeSeconds",
              "presence": "optional"
            }
          ],
          "options": {},
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "currentConnection",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "null",
                  "value": null
                }
              },
              "whenTrue": {
                "type": "literal",
                "valueType": "int",
                "value": "5"
              },
              "whenFalse": {
                "type": "conditional",
                "condition": {
                  "type": "binary",
                  "operator": "eq",
                  "left": {
                    "type": "reference",
                    "id": "currentConnection",
                    "path": []
                  },
                  "right": {
                    "type": "literal",
                    "valueType": "int",
                    "value": "0"
                  }
                },
                "whenTrue": {
                  "type": "literal",
                  "valueType": "int",
                  "value": "1"
                },
                "whenFalse": {
                  "type": "conditional",
                  "condition": {
                    "type": "binary",
                    "operator": "ne",
                    "left": {
                      "type": "reference",
                      "id": "currentConnection",
                      "path": []
                    },
                    "right": {
                      "type": "literal",
                      "valueType": "int",
                      "value": "1"
                    }
                  },
                  "whenTrue": {
                    "type": "literal",
                    "valueType": "int",
                    "value": "5"
                  },
                  "whenFalse": {
                    "type": "conditional",
                    "condition": {
                      "type": "unary",
                      "operator": "not",
                      "operand": {
                        "type": "reference",
                        "id": "params",
                        "path": [
                          "activityAssessmentEnabled"
                        ]
                      }
                    },
                    "whenTrue": {
                      "type": "literal",
                      "valueType": "int",
                      "value": "0"
                    },
                    "whenFalse": {
                      "type": "conditional",
                      "condition": {
                        "type": "binary",
                        "operator": "eq",
                        "left": {
                          "type": "reference",
                          "id": "communicationAgeSeconds",
                          "path": []
                        },
                        "right": {
                          "type": "literal",
                          "valueType": "null",
                          "value": null
                        }
                      },
                      "whenTrue": {
                        "type": "literal",
                        "valueType": "int",
                        "value": "4"
                      },
                      "whenFalse": {
                        "type": "conditional",
                        "condition": {
                          "type": "binary",
                          "operator": "gt",
                          "left": {
                            "type": "reference",
                            "id": "communicationAgeSeconds",
                            "path": []
                          },
                          "right": {
                            "type": "reference",
                            "id": "params",
                            "path": [
                              "communicationIdleSeconds"
                            ]
                          }
                        },
                        "whenTrue": {
                          "type": "literal",
                          "valueType": "int",
                          "value": "3"
                        },
                        "whenFalse": {
                          "type": "literal",
                          "valueType": "int",
                          "value": "0"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "language": "spel",
          "resultType": {
            "type": "enum",
            "valueType": {
              "type": "int"
            },
            "elements": [
              {
                "value": 0,
                "text": "连接正常",
                "textI18n": {
                  "zh": "连接正常",
                  "en": "Connection normal"
                },
                "icon": "color:#52c41a"
              },
              {
                "value": 1,
                "text": "离线",
                "textI18n": {
                  "zh": "离线",
                  "en": "Offline"
                },
                "icon": "color:#ff4d4f"
              },
              {
                "value": 3,
                "text": "在线但通信静默",
                "textI18n": {
                  "zh": "在线但通信静默",
                  "en": "Online, session silent"
                },
                "icon": "color:#fa8c16"
              },
              {
                "value": 4,
                "text": "评估条件不足",
                "textI18n": {
                  "zh": "评估条件不足",
                  "en": "Assessment requirements not met"
                },
                "icon": "color:#1677ff"
              },
              {
                "value": 5,
                "text": "连接状态未知",
                "textI18n": {
                  "zh": "连接状态未知",
                  "en": "Connection state unknown"
                },
                "icon": "color:#8c8c8c"
              }
            ]
          }
        }
      ],
      "outputs": [
        {
          "metricId": "communicationState",
          "label": "当前通信状态",
          "metricKind": "state",
          "persist": true,
          "publish": true,
          "options": {
            "explain": true,
            "readAggregation": {
              "semantic": "state",
              "operations": [
                "collection",
                "distribution"
              ],
              "defaultOperation": "distribution",
              "defaultView": "list"
            }
          },
          "valueType": "enum"
        },
        {
          "metricId": "observedOnlineRatio",
          "label": "已观测时段在线率",
          "unit": "%",
          "metricKind": "ratio",
          "persist": true,
          "publish": true,
          "options": {
            "explain": false,
            "readAggregation": {
              "semantic": "ratio",
              "operations": [
                "collection"
              ],
              "defaultOperation": "collection",
              "defaultView": "list"
            }
          },
          "valueType": "double"
        },
        {
          "metricId": "windowOfflineSeconds",
          "label": "近1小时离线时长",
          "unit": "s",
          "metricKind": "duration",
          "persist": true,
          "publish": true,
          "options": {
            "explain": false,
            "readAggregation": {
              "semantic": "duration",
              "operations": [
                "collection",
                "average",
                "min",
                "max"
              ],
              "defaultOperation": "max",
              "defaultView": "list"
            }
          },
          "valueType": "double"
        },
        {
          "metricId": "windowDisconnectCount",
          "label": "近1小时确认掉线次数",
          "metricKind": "numeric",
          "persist": true,
          "publish": true,
          "options": {
            "explain": false,
            "readAggregation": {
              "semantic": "numeric",
              "operations": [
                "collection",
                "average",
                "min",
                "max"
              ],
              "defaultOperation": "average",
              "defaultView": "list"
            }
          },
          "valueType": "int"
        },
        {
          "metricId": "currentConnection",
          "label": "当前连接状态",
          "metricKind": "state",
          "persist": true,
          "publish": true,
          "options": {
            "explain": false,
            "readAggregation": {
              "semantic": "state",
              "operations": [
                "collection",
                "distribution"
              ],
              "defaultOperation": "distribution",
              "defaultView": "list"
            }
          },
          "valueType": "enum"
        },
        {
          "metricId": "windowUnknownSeconds",
          "label": "近1小时未知时长",
          "unit": "s",
          "metricKind": "duration",
          "persist": true,
          "publish": true,
          "options": {
            "explain": false,
            "readAggregation": {
              "semantic": "duration",
              "operations": [
                "collection",
                "average",
                "min",
                "max"
              ],
              "defaultOperation": "max",
              "defaultView": "list"
            }
          },
          "valueType": "double"
        },
        {
          "metricId": "communicationAgeSeconds",
          "label": "距最近会话通信",
          "unit": "s",
          "metricKind": "duration",
          "persist": true,
          "publish": true,
          "options": {
            "explain": false,
            "readAggregation": {
              "semantic": "duration",
              "operations": [
                "collection",
                "average",
                "min",
                "max"
              ],
              "defaultOperation": "max",
              "defaultView": "list"
            }
          },
          "valueType": "double"
        }
      ],
      "options": {
        "category": "connectivity",
        "icon": "WifiOutlined",
        "description": "查看当前连接、可选会话静默和历史观测事实。",
        "notes": "绑定平台连接和最近会话通信。静默评估默认关闭，仅在协议有明确周期时启用。在线率=已观测在线时长/(已观测在线+离线时长)，未知时段单列；不等于完整时段可用率或SLA。每分钟更新滚动一小时，不跨重叠窗口求和。不提供无数据支持的丢包率、延迟或自定义综合评分。",
        "presentation": {
          "settings": {
            "primaryOutput": "communicationState",
            "summaryOutputs": [
              "observedOnlineRatio",
              "windowDisconnectCount"
            ]
          }
        },
        "i18nMessages": {
          "name": {
            "zh": "通信状态与观测质量",
            "en": "Communication and observation quality"
          },
          "description": {
            "zh": "查看当前连接、可选会话静默和历史观测事实。",
            "en": "View current connectivity, optional session silence and observed connection history."
          },
          "notes": {
            "zh": "绑定平台连接和最近会话通信。静默评估默认关闭，仅在协议有明确周期时启用。在线率=已观测在线时长/(已观测在线+离线时长)，未知时段单列；不等于完整时段可用率或SLA。每分钟更新滚动一小时，不跨重叠窗口求和。不提供无数据支持的丢包率、延迟或自定义综合评分。",
            "en": "Bind platform connectivity and last session activity. Silence assessment is off until the protocol has a known cadence. Observed online ratio uses online/(online+offline) time; unknown periods are separate, so this is not full-period availability or an SLA. Update the rolling hour every minute and never sum overlapping windows. No unsupported loss/latency estimates or weighted score."
          },
          "input.connectionState.name": {
            "zh": "平台连接状态",
            "en": "Platform connection state"
          },
          "input.connectionState.enum.0": {
            "zh": "离线",
            "en": "Offline"
          },
          "input.connectionState.enum.1": {
            "zh": "在线",
            "en": "Online"
          },
          "input.lastCommunicationTime.name": {
            "zh": "最近会话通信时间",
            "en": "Last session communication time"
          },
          "parameter.activityAssessmentEnabled.name": {
            "zh": "评估会话通信静默",
            "en": "Assess session silence"
          },
          "parameter.communicationIdleSeconds.name": {
            "zh": "会话通信静默阈值",
            "en": "Session silence threshold"
          },
          "rule.currentConnection.name": {
            "zh": "当前连接状态",
            "en": "Current connection"
          },
          "rule.currentConnection.result.enum.0": {
            "zh": "离线",
            "en": "Offline"
          },
          "rule.currentConnection.result.enum.1": {
            "zh": "在线",
            "en": "Online"
          },
          "rule.connectionStatistics.name": {
            "zh": "近1小时连接统计",
            "en": "One-hour connection statistics"
          },
          "rule.connectionStatistics.output.field.activeDuration.name": {
            "zh": "已观测在线时长",
            "en": "Observed online time"
          },
          "rule.connectionStatistics.output.field.inactiveDuration.name": {
            "zh": "已观测离线时长",
            "en": "Observed offline time"
          },
          "rule.connectionStatistics.output.field.unknownDuration.name": {
            "zh": "未知时长",
            "en": "Unknown time"
          },
          "rule.connectionStatistics.output.field.activeCount.name": {
            "zh": "确认上线次数",
            "en": "Confirmed connections"
          },
          "rule.connectionStatistics.output.field.inactiveCount.name": {
            "zh": "确认掉线次数",
            "en": "Confirmed disconnects"
          },
          "rule.connectionStatistics.output.field.coverage.name": {
            "zh": "观测覆盖比例（0—1）",
            "en": "Observation coverage (0–1)"
          },
          "rule.observedOnlineRatio.name": {
            "zh": "已观测时段在线率",
            "en": "Observed-time online ratio"
          },
          "rule.windowOfflineSeconds.name": {
            "zh": "近1小时离线时长",
            "en": "Offline time in last hour"
          },
          "rule.windowDisconnectCount.name": {
            "zh": "近1小时确认掉线次数",
            "en": "Confirmed disconnects in last hour"
          },
          "rule.windowUnknownSeconds.name": {
            "zh": "近1小时未知时长",
            "en": "Unknown time in last hour"
          },
          "rule.communicationAgeSeconds.name": {
            "zh": "距最近会话通信",
            "en": "Time since session communication"
          },
          "rule.communicationState.name": {
            "zh": "当前通信状态",
            "en": "Current communication state"
          },
          "rule.communicationState.result.enum.0": {
            "zh": "连接正常",
            "en": "Connection normal"
          },
          "rule.communicationState.result.enum.1": {
            "zh": "离线",
            "en": "Offline"
          },
          "rule.communicationState.result.enum.3": {
            "zh": "在线但通信静默",
            "en": "Online, session silent"
          },
          "rule.communicationState.result.enum.4": {
            "zh": "评估条件不足",
            "en": "Assessment requirements not met"
          },
          "rule.communicationState.result.enum.5": {
            "zh": "连接状态未知",
            "en": "Connection state unknown"
          },
          "output.communicationState.label": {
            "zh": "当前通信状态",
            "en": "Current communication state"
          },
          "output.observedOnlineRatio.label": {
            "zh": "已观测时段在线率",
            "en": "Observed-time online ratio"
          },
          "output.windowOfflineSeconds.label": {
            "zh": "近1小时离线时长",
            "en": "Offline time in last hour"
          },
          "output.windowDisconnectCount.label": {
            "zh": "近1小时确认掉线次数",
            "en": "Confirmed disconnects in last hour"
          },
          "output.currentConnection.label": {
            "zh": "当前连接状态",
            "en": "Current connection"
          },
          "output.windowUnknownSeconds.label": {
            "zh": "近1小时未知时长",
            "en": "Unknown time in last hour"
          },
          "output.communicationAgeSeconds.label": {
            "zh": "距最近会话通信",
            "en": "Time since session communication"
          }
        },
        "authoring": {
          "references": [
            {
              "kind": "observation",
              "name": "通用观测或算术规则",
              "description": "不宣称行业合规，示例参数需按实际配置。"
            }
          ]
        }
      }
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "targetType": "simulation",
        "targetId": "example",
        "slot": "example",
        "templateId": "iot-communication-observation",
        "templateVersion": "3",
        "state": "disabled",
        "revision": 0,
        "inputMappings": {
          "connectionState": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-gateway",
            "id": "$online"
          },
          "lastCommunicationTime": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-gateway",
            "id": "$lastCommunicationTime"
          }
        },
        "parameters": {}
      },
      "samples": [
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$online",
          "value": 1,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793491200000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$lastCommunicationTime",
          "value": 1793491200000,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          }
        },
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$online",
          "value": 0,
          "eventTime": 1793493600000,
          "ingestTime": 1793493600000,
          "processTime": 1793493600000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793493600000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$online",
          "value": 1,
          "eventTime": 1793493720000,
          "ingestTime": 1793493720000,
          "processTime": 1793493720000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793493720000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$online",
          "value": 0,
          "eventTime": 1793494080000,
          "ingestTime": 1793494080000,
          "processTime": 1793494080000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793494080000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$online",
          "value": 1,
          "eventTime": 1793494140000,
          "ingestTime": 1793494140000,
          "processTime": 1793494140000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793494140000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$online",
          "value": 0,
          "eventTime": 1793494500000,
          "ingestTime": 1793494500000,
          "processTime": 1793494500000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793494500000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-gateway",
          "metricId": "$online",
          "value": 1,
          "eventTime": 1793494560000,
          "ingestTime": 1793494560000,
          "processTime": 1793494560000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793494560000
            }
          }
        }
      ],
      "endAt": 1793494800000
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "连接与通信",
    "groupNameI18n": {
      "zh": "连接与通信",
      "en": "Connectivity"
    }
  },
  {
    "id": "connection-duration",
    "name": "在线与离线时长",
    "description": "查看当前连接持续时间与一小时内的观测时长。",
    "groupId": "connectivity",
    "icon": "WifiOutlined",
    "template": {
      "id": "iot-connection-duration",
      "version": "3",
      "name": "在线与离线时长",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "connectionState",
          "name": "在线状态",
          "valueType": {
            "type": "enum",
            "valueType": {
              "type": "int"
            },
            "elements": [
              {
                "value": 0,
                "text": "离线"
              },
              {
                "value": 1,
                "text": "在线"
              }
            ]
          },
          "source": {
            "lookback": "PT2H",
            "maxPoints": 256
          },
          "historyReconciliation": "PT5M"
        }
      ],
      "definitions": [
        {
          "name": "当前连接状态",
          "id": "connection",
          "type": "composite",
          "dependsOn": [
            "connectionState"
          ],
          "inputs": [
            {
              "id": "connectionState",
              "metricId": "connectionState"
            }
          ],
          "stateTracking": {
            "maxNoData": "PT20M"
          },
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "options": {},
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "connectionState",
              "path": []
            }
          },
          "language": "spel",
          "resultType": {
            "type": "enum",
            "valueType": {
              "type": "int"
            },
            "elements": [
              {
                "value": 0,
                "text": "离线",
                "icon": "color:#ff4d4f"
              },
              {
                "value": 1,
                "text": "在线",
                "icon": "color:#52c41a"
              }
            ]
          }
        },
        {
          "name": "本次离线时长",
          "id": "offlineSeconds",
          "type": "composite",
          "dependsOn": [
            "connection"
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "connection",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "int",
                  "value": "0"
                }
              },
              "whenTrue": {
                "type": "reference",
                "id": "metricValues",
                "path": [
                  "connection",
                  "state",
                  "duration"
                ]
              },
              "whenFalse": {
                "type": "literal",
                "valueType": "int",
                "value": "0"
              }
            }
          },
          "language": "spel"
        },
        {
          "name": "本次在线时长",
          "id": "onlineSeconds",
          "type": "composite",
          "dependsOn": [
            "connection"
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "connection",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "int",
                  "value": "1"
                }
              },
              "whenTrue": {
                "type": "reference",
                "id": "metricValues",
                "path": [
                  "connection",
                  "state",
                  "duration"
                ]
              },
              "whenFalse": {
                "type": "literal",
                "valueType": "int",
                "value": "0"
              }
            }
          },
          "language": "spel"
        },
        {
          "name": "连接时间统计",
          "id": "connectionStatistics",
          "type": "composite",
          "inputs": [
            {
              "id": "state",
              "metricId": "connectionState"
            }
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "calculator": {
            "provider": "state",
            "providerVersion": "1",
            "inputTypes": {
              "state": {
                "type": "array",
                "elementType": {
                  "type": "int"
                }
              }
            },
            "outputType": {
              "type": "object",
              "properties": [
                {
                  "id": "activeDuration",
                  "name": "运行秒数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "inactiveDuration",
                  "name": "停机秒数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "unknownDuration",
                  "name": "未知秒数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "coverage",
                  "name": "时间覆盖率",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                }
              ]
            },
            "parameters": {
              "duration": "PT1H",
              "maxHold": "PT20M",
              "activeValue": 1,
              "inactiveValue": 0
            }
          }
        },
        {
          "name": "近1小时在线时长",
          "id": "onlineWindowSeconds",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "connectionStatistics",
              "path": [
                "activeDuration"
              ]
            }
          },
          "language": "spel"
        },
        {
          "name": "近1小时离线时长",
          "id": "offlineWindowSeconds",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "connectionStatistics",
              "path": [
                "inactiveDuration"
              ]
            }
          },
          "language": "spel"
        },
        {
          "name": "未知时间",
          "id": "unknownSeconds",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "connectionStatistics",
              "path": [
                "unknownDuration"
              ]
            }
          },
          "language": "spel"
        },
        {
          "name": "时间覆盖率",
          "id": "coveragePercent",
          "type": "composite",
          "dependsOn": [
            "connectionStatistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "binary",
              "operator": "multiply",
              "left": {
                "type": "reference",
                "id": "connectionStatistics",
                "path": [
                  "coverage"
                ]
              },
              "right": {
                "type": "literal",
                "valueType": "int",
                "value": "100"
              }
            }
          },
          "language": "spel"
        }
      ],
      "outputs": [
        {
          "metricId": "connection",
          "label": "当前连接状态",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "onlineSeconds",
          "label": "本次在线时长",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "offlineSeconds",
          "label": "本次离线时长",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "onlineWindowSeconds",
          "label": "近1小时在线时长",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "offlineWindowSeconds",
          "label": "近1小时离线时长",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "unknownSeconds",
          "label": "未知时间",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "coveragePercent",
          "label": "时间覆盖率",
          "unit": "%",
          "persist": true,
          "publish": true
        }
      ],
      "parameterDefinitions": [],
      "parameters": {},
      "options": {
        "description": "查看当前连接持续时间与一小时内的观测时长。",
        "notes": "连接变化记录有效到下一次变化，显式过期约束仍生效。起点未知时不推算完整持续时长，缺失历史不补为离线。连接状态不代表设备运行或通电。",
        "presentation": {
          "settings": {
            "summaryOutputs": [
              "onlineWindowSeconds",
              "offlineWindowSeconds"
            ]
          }
        },
        "i18nMessages": {
          "name": {
            "zh": "在线与离线时长",
            "en": "Online and offline durations"
          },
          "description": {
            "zh": "查看当前连接持续时间与一小时内的观测时长。",
            "en": "View current connection duration and observed totals over one hour."
          },
          "notes": {
            "zh": "连接变化记录有效到下一次变化，显式过期约束仍生效。起点未知时不推算完整持续时长，缺失历史不补为离线。连接状态不代表设备运行或通电。",
            "en": "Connection changes remain effective until the next change, subject to explicit expiry. Unknown start boundaries do not yield a full duration; missing history is not offline time. Connectivity does not prove machine operation or electrical power."
          },
          "input.connectionState.name": {
            "zh": "在线状态",
            "en": "Connection state"
          },
          "input.connectionState.enum.0": {
            "zh": "离线",
            "en": "Offline"
          },
          "input.connectionState.enum.1": {
            "zh": "在线",
            "en": "Online"
          },
          "rule.connection.name": {
            "zh": "当前连接状态",
            "en": "Current connection state"
          },
          "rule.connection.result.enum.0": {
            "zh": "离线",
            "en": "Offline"
          },
          "rule.connection.result.enum.1": {
            "zh": "在线",
            "en": "Online"
          },
          "rule.offlineSeconds.name": {
            "zh": "本次离线时长",
            "en": "Current offline duration"
          },
          "rule.onlineSeconds.name": {
            "zh": "本次在线时长",
            "en": "Current online duration"
          },
          "rule.connectionStatistics.name": {
            "zh": "连接时间统计",
            "en": "Connection time statistics"
          },
          "rule.connectionStatistics.output.field.activeDuration.name": {
            "zh": "运行秒数",
            "en": "Active seconds"
          },
          "rule.connectionStatistics.output.field.inactiveDuration.name": {
            "zh": "停机秒数",
            "en": "Inactive seconds"
          },
          "rule.connectionStatistics.output.field.unknownDuration.name": {
            "zh": "未知秒数",
            "en": "Unknown seconds"
          },
          "rule.connectionStatistics.output.field.coverage.name": {
            "zh": "时间覆盖率",
            "en": "Time coverage"
          },
          "rule.onlineWindowSeconds.name": {
            "zh": "近1小时在线时长",
            "en": "Online in last hour"
          },
          "rule.offlineWindowSeconds.name": {
            "zh": "近1小时离线时长",
            "en": "Offline in last hour"
          },
          "rule.unknownSeconds.name": {
            "zh": "未知时间",
            "en": "Unknown time"
          },
          "rule.coveragePercent.name": {
            "zh": "时间覆盖率",
            "en": "Time coverage"
          },
          "output.connection.label": {
            "zh": "当前连接状态",
            "en": "Current connection state"
          },
          "output.onlineSeconds.label": {
            "zh": "本次在线时长",
            "en": "Current online duration"
          },
          "output.offlineSeconds.label": {
            "zh": "本次离线时长",
            "en": "Current offline duration"
          },
          "output.onlineWindowSeconds.label": {
            "zh": "近1小时在线时长",
            "en": "Online in last hour"
          },
          "output.offlineWindowSeconds.label": {
            "zh": "近1小时离线时长",
            "en": "Offline in last hour"
          },
          "output.unknownSeconds.label": {
            "zh": "未知时间",
            "en": "Unknown time"
          },
          "output.coveragePercent.label": {
            "zh": "时间覆盖率",
            "en": "Time coverage"
          }
        },
        "category": "connectivity",
        "icon": "WifiOutlined",
        "authoring": {
          "references": [
            {
              "kind": "observation",
              "name": "通用观测或算术规则",
              "description": "不宣称行业合规，示例参数需按实际配置。"
            }
          ]
        }
      },
      "thingType": "device"
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "slot": "example",
        "targetType": "simulation",
        "targetId": "example",
        "templateId": "iot-connection-duration",
        "templateVersion": "3",
        "state": "disabled",
        "revision": 0,
        "parameters": {},
        "inputMappings": {
          "connectionState": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-connectionState",
            "id": "$online"
          }
        }
      },
      "samples": [
        {
          "thingType": "device",
          "thingId": "example-connectionState",
          "metricId": "$online",
          "value": 1,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793491200000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-connectionState",
          "metricId": "$online",
          "value": 0,
          "eventTime": 1793500200000,
          "ingestTime": 1793500200000,
          "processTime": 1793500200000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793500200000
            }
          }
        },
        {
          "thingType": "device",
          "thingId": "example-connectionState",
          "metricId": "$online",
          "value": 1,
          "eventTime": 1793502000000,
          "ingestTime": 1793502000000,
          "processTime": 1793502000000,
          "quality": {
            "valid": true,
            "attributes": {
              "stateSince": 1793502000000
            }
          }
        }
      ],
      "endAt": 1793505600000
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "连接与通信",
    "groupNameI18n": {
      "zh": "连接与通信",
      "en": "Connectivity"
    }
  },
  {
    "id": "state-duration",
    "name": "状态持续时间",
    "description": "跟踪可配置状态的本次持续时间和有效观测统计。",
    "groupId": "state",
    "icon": "ClockCircleOutlined",
    "template": {
      "id": "iot-state-duration",
      "version": "2",
      "name": "状态持续时间",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "operating",
          "name": "运行状态",
          "valueType": {
            "type": "enum",
            "valueType": {
              "type": "int"
            },
            "elements": [
              {
                "value": 0,
                "text": "停机"
              },
              {
                "value": 1,
                "text": "运行"
              }
            ]
          },
          "source": {
            "lookback": "PT2H",
            "maxPoints": 256
          },
          "maxAge": "PT2H"
        }
      ],
      "definitions": [
        {
          "name": "当前工况",
          "id": "running",
          "dependsOn": [
            "operating"
          ],
          "inputs": [
            {
              "id": "operating",
              "metricId": "operating"
            }
          ],
          "stateTracking": {
            "maxNoData": "PT20M"
          },
          "options": {},
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "operating",
              "path": []
            }
          },
          "language": "spel",
          "resultType": {
            "type": "enum",
            "valueType": {
              "type": "int"
            },
            "elements": [
              {
                "value": 0,
                "text": "停机",
                "icon": "color:#8c8c8c"
              },
              {
                "value": 1,
                "text": "运行",
                "icon": "color:#52c41a"
              }
            ]
          }
        },
        {
          "name": "本次停机",
          "id": "stoppedSeconds",
          "type": "composite",
          "dependsOn": [
            "running"
          ],
          "inputs": [
            {
              "id": "running",
              "metricId": "running"
            }
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "running",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "int",
                  "value": "0"
                }
              },
              "whenTrue": {
                "type": "reference",
                "id": "metricValues",
                "path": [
                  "running",
                  "state",
                  "duration"
                ]
              },
              "whenFalse": {
                "type": "literal",
                "valueType": "int",
                "value": "0"
              }
            }
          },
          "language": "spel"
        },
        {
          "name": "本次运行",
          "id": "runningSeconds",
          "type": "composite",
          "dependsOn": [
            "running"
          ],
          "inputs": [
            {
              "id": "running",
              "metricId": "running"
            }
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "conditional",
              "condition": {
                "type": "binary",
                "operator": "eq",
                "left": {
                  "type": "reference",
                  "id": "running",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "int",
                  "value": "1"
                }
              },
              "whenTrue": {
                "type": "reference",
                "id": "metricValues",
                "path": [
                  "running",
                  "state",
                  "duration"
                ]
              },
              "whenFalse": {
                "type": "literal",
                "valueType": "int",
                "value": "0"
              }
            }
          },
          "language": "spel"
        },
        {
          "name": "状态统计",
          "id": "statistics",
          "type": "composite",
          "inputs": [
            {
              "id": "state",
              "metricId": "operating"
            }
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "calculator": {
            "provider": "state",
            "providerVersion": "1",
            "inputTypes": {
              "state": {
                "type": "array",
                "elementType": {
                  "type": "int"
                }
              }
            },
            "outputType": {
              "type": "object",
              "properties": [
                {
                  "id": "activeDuration",
                  "name": "运行秒数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "inactiveDuration",
                  "name": "停机秒数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "unknownDuration",
                  "name": "未知秒数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "activeCount",
                  "name": "确认启动次数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "inactiveCount",
                  "name": "确认停止次数",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                },
                {
                  "id": "coverage",
                  "name": "时间覆盖率",
                  "valueType": {
                    "type": "double",
                    "scale": 8
                  }
                }
              ]
            },
            "parameters": {
              "duration": "PT1H",
              "maxHold": "PT20M",
              "activeValue": 1,
              "inactiveValue": 0
            }
          }
        },
        {
          "name": "近1小时运行时长",
          "id": "activeSeconds",
          "type": "composite",
          "dependsOn": [
            "statistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "statistics",
              "path": [
                "activeDuration"
              ]
            }
          },
          "language": "spel"
        },
        {
          "name": "未知时间",
          "id": "unknownSeconds",
          "type": "composite",
          "dependsOn": [
            "statistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "statistics",
              "path": [
                "unknownDuration"
              ]
            }
          },
          "language": "spel"
        },
        {
          "name": "时间覆盖率",
          "id": "coveragePercent",
          "type": "composite",
          "dependsOn": [
            "statistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "binary",
              "operator": "multiply",
              "left": {
                "type": "reference",
                "id": "statistics",
                "path": [
                  "coverage"
                ]
              },
              "right": {
                "type": "literal",
                "valueType": "int",
                "value": "100"
              }
            }
          },
          "language": "spel"
        },
        {
          "name": "启动次数",
          "id": "startCount",
          "type": "composite",
          "dependsOn": [
            "statistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "statistics",
              "path": [
                "activeCount"
              ]
            }
          },
          "language": "spel"
        },
        {
          "name": "停止次数",
          "id": "stopCount",
          "type": "composite",
          "dependsOn": [
            "statistics"
          ],
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "statistics",
              "path": [
                "inactiveCount"
              ]
            }
          },
          "language": "spel"
        }
      ],
      "outputs": [
        {
          "metricId": "running",
          "label": "当前工况",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "stoppedSeconds",
          "label": "本次停机",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "runningSeconds",
          "label": "本次运行",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "activeSeconds",
          "label": "近1小时运行时长",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "startCount",
          "label": "启动次数",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "stopCount",
          "label": "停止次数",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "unknownSeconds",
          "label": "未知时间",
          "unit": "s",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "coveragePercent",
          "label": "时间覆盖率",
          "unit": "%",
          "persist": true,
          "publish": true
        }
      ],
      "parameterDefinitions": [],
      "parameters": {},
      "options": {
        "description": "跟踪可配置状态的本次持续时间和有效观测统计。",
        "notes": "运行1、非运行0只是可编辑编码示例，不代表某行业标准七态。每分钟评估，观测最多保持20分钟。缺数为未知，首次起点不明时不推算完整持续时长；近一小时统计只按明确编码累计。",
        "i18nMessages": {
          "name": {
            "zh": "状态持续时间",
            "en": "State durations"
          },
          "description": {
            "zh": "跟踪可配置状态的本次持续时间和有效观测统计。",
            "en": "Track configurable states and their current and observed durations."
          },
          "notes": {
            "zh": "运行1、非运行0只是可编辑编码示例，不代表某行业标准七态。每分钟评估，观测最多保持20分钟。缺数为未知，首次起点不明时不推算完整持续时长；近一小时统计只按明确编码累计。",
            "en": "Running 1 and not-running 0 are editable example codes, not a seven-state industry standard. Evaluate every minute; hold observations for at most 20 minutes. Missing periods are unknown and unknown initial boundaries do not yield a full duration. One-hour totals use explicit codes only."
          },
          "input.operating.name": {
            "zh": "运行状态",
            "en": "Operating state"
          },
          "input.operating.enum.0": {
            "zh": "停机",
            "en": "Stopped"
          },
          "input.operating.enum.1": {
            "zh": "运行",
            "en": "Running"
          },
          "rule.running.name": {
            "zh": "当前工况",
            "en": "Current state"
          },
          "rule.running.result.enum.0": {
            "zh": "停机",
            "en": "Stopped"
          },
          "rule.running.result.enum.1": {
            "zh": "运行",
            "en": "Running"
          },
          "rule.stoppedSeconds.name": {
            "zh": "本次停机",
            "en": "Current stop"
          },
          "rule.runningSeconds.name": {
            "zh": "本次运行",
            "en": "Current run"
          },
          "rule.statistics.name": {
            "zh": "状态统计",
            "en": "State statistics"
          },
          "rule.statistics.output.field.activeDuration.name": {
            "zh": "运行秒数",
            "en": "Active seconds"
          },
          "rule.statistics.output.field.inactiveDuration.name": {
            "zh": "停机秒数",
            "en": "Inactive seconds"
          },
          "rule.statistics.output.field.unknownDuration.name": {
            "zh": "未知秒数",
            "en": "Unknown seconds"
          },
          "rule.statistics.output.field.activeCount.name": {
            "zh": "确认启动次数",
            "en": "Confirmed starts"
          },
          "rule.statistics.output.field.inactiveCount.name": {
            "zh": "确认停止次数",
            "en": "Confirmed stops"
          },
          "rule.statistics.output.field.coverage.name": {
            "zh": "时间覆盖率",
            "en": "Time coverage"
          },
          "rule.activeSeconds.name": {
            "zh": "近1小时运行时长",
            "en": "Runtime in last hour"
          },
          "rule.unknownSeconds.name": {
            "zh": "未知时间",
            "en": "Unknown time"
          },
          "rule.coveragePercent.name": {
            "zh": "时间覆盖率",
            "en": "Time coverage"
          },
          "rule.startCount.name": {
            "zh": "启动次数",
            "en": "Confirmed starts"
          },
          "rule.stopCount.name": {
            "zh": "停止次数",
            "en": "Confirmed stops"
          },
          "output.running.label": {
            "zh": "当前工况",
            "en": "Current state"
          },
          "output.stoppedSeconds.label": {
            "zh": "本次停机",
            "en": "Current stop"
          },
          "output.runningSeconds.label": {
            "zh": "本次运行",
            "en": "Current run"
          },
          "output.activeSeconds.label": {
            "zh": "近1小时运行时长",
            "en": "Runtime in last hour"
          },
          "output.startCount.label": {
            "zh": "启动次数",
            "en": "Confirmed starts"
          },
          "output.stopCount.label": {
            "zh": "停止次数",
            "en": "Confirmed stops"
          },
          "output.unknownSeconds.label": {
            "zh": "未知时间",
            "en": "Unknown time"
          },
          "output.coveragePercent.label": {
            "zh": "时间覆盖率",
            "en": "Time coverage"
          }
        },
        "category": "state",
        "icon": "ClockCircleOutlined",
        "authoring": {
          "references": [
            {
              "kind": "observation",
              "name": "通用观测或算术规则",
              "description": "不宣称行业合规，示例参数需按实际配置。"
            }
          ]
        }
      },
      "thingType": "device"
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "slot": "example",
        "targetType": "simulation",
        "targetId": "example",
        "templateId": "iot-state-duration",
        "templateVersion": "2",
        "state": "disabled",
        "revision": 0,
        "parameters": {},
        "inputMappings": {
          "operating": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-operating",
            "id": "operating"
          }
        }
      },
      "samples": [
        {
          "thingType": "device",
          "thingId": "example-operating",
          "metricId": "operating",
          "value": 0,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          }
        },
        {
          "thingType": "device",
          "thingId": "example-operating",
          "metricId": "operating",
          "value": 1,
          "eventTime": 1793491500000,
          "ingestTime": 1793491500000,
          "processTime": 1793491500000,
          "quality": {
            "valid": true
          }
        },
        {
          "thingType": "device",
          "thingId": "example-operating",
          "metricId": "operating",
          "value": 1,
          "eventTime": 1793493900000,
          "ingestTime": 1793493900000,
          "processTime": 1793493900000,
          "quality": {
            "valid": true
          }
        },
        {
          "thingType": "device",
          "thingId": "example-operating",
          "metricId": "operating",
          "value": 1,
          "eventTime": 1793494800000,
          "ingestTime": 1793494800000,
          "processTime": 1793494800000,
          "quality": {
            "valid": true
          }
        }
      ]
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "状态与时长",
    "groupNameI18n": {
      "zh": "状态与时长",
      "en": "States and durations"
    }
  },
  {
    "id": "sample-mean",
    "name": "滑动窗口均值",
    "description": "在数据更新时计算最近窗口的采样均值。",
    "groupId": "statistics",
    "icon": "BarChartOutlined",
    "template": {
      "id": "iot-sample-mean",
      "version": "1",
      "name": "滑动窗口均值",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "temperature",
          "name": "温度",
          "valueType": {
            "type": "double",
            "scale": 8
          },
          "unit": "°C"
        }
      ],
      "definitions": [
        {
          "name": "平均温度",
          "id": "average",
          "type": "feature",
          "sourceMetric": "temperature",
          "aggregation": "avg",
          "window": {
            "mode": "time",
            "size": "PT15M",
            "timeMode": "event",
            "emitPolicy": "onEvent",
            "maxEntries": 128
          }
        }
      ],
      "outputs": [
        {
          "metricId": "average",
          "label": "平均温度",
          "unit": "°C",
          "persist": true,
          "publish": true
        }
      ],
      "parameterDefinitions": [],
      "parameters": {},
      "options": {
        "description": "在数据更新时计算最近窗口的采样均值。",
        "notes": "使用15分钟滚动窗口和温度样本演示，可替换为同类型测点。采样均值按有效样本等权计算，不是按时间加权的均值；缺样不补零，窗口和容量需匹配采样频率。 算术均值定义参见 NIST/SEMATECH《统计方法电子手册》1.3.5.1；窗口长度属于示例配置。 https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm",
        "i18nMessages": {
          "name": {
            "zh": "滑动窗口均值",
            "en": "Sliding-window mean"
          },
          "description": {
            "zh": "在数据更新时计算最近窗口的采样均值。",
            "en": "Calculate a sample mean over the recent window on data updates."
          },
          "notes": {
            "zh": "使用15分钟滚动窗口和温度样本演示，可替换为同类型测点。采样均值按有效样本等权计算，不是按时间加权的均值；缺样不补零，窗口和容量需匹配采样频率。 算术均值定义参见 NIST/SEMATECH《统计方法电子手册》1.3.5.1；窗口长度属于示例配置。 https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm",
            "en": "A 15-minute temperature window is an editable example. Samples have equal weight; this is not a time-weighted mean. Do not fill missing data with zero. Match the window and capacity to the sampling cadence. The arithmetic mean follows NIST/SEMATECH e-Handbook §1.3.5.1; the window length is an example configuration. https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm"
          },
          "input.temperature.name": {
            "zh": "温度",
            "en": "Temperature"
          },
          "rule.average.name": {
            "zh": "平均温度",
            "en": "Average temperature"
          },
          "output.average.label": {
            "zh": "平均温度",
            "en": "Average temperature"
          }
        },
        "category": "statistics",
        "icon": "BarChartOutlined",
        "authoring": {
          "references": [
            {
              "kind": "literature",
              "name": "NIST/SEMATECH e-Handbook of Statistical Methods",
              "section": "1.3.5.1 Measures of Location — Mean",
              "url": "https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm",
              "description": "Arithmetic mean = sum of samples / number of samples; this does not specify the application window or safety limits."
            }
          ]
        }
      },
      "thingType": "device"
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "slot": "example",
        "targetType": "simulation",
        "targetId": "example",
        "templateId": "iot-sample-mean",
        "templateVersion": "1",
        "state": "disabled",
        "revision": 0,
        "parameters": {},
        "inputMappings": {
          "temperature": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-temperature",
            "id": "temperature"
          }
        }
      },
      "samples": [
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 22,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 24,
          "eventTime": 1793491500000,
          "ingestTime": 1793491500000,
          "processTime": 1793491500000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 26,
          "eventTime": 1793491800000,
          "ingestTime": 1793491800000,
          "processTime": 1793491800000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 28,
          "eventTime": 1793492400000,
          "ingestTime": 1793492400000,
          "processTime": 1793492400000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        }
      ]
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "采样与统计",
    "groupNameI18n": {
      "zh": "采样与统计",
      "en": "Sampling and statistics"
    }
  },
  {
    "id": "counter-usage",
    "name": "累计表区间用量",
    "description": "由同一累计表的实际起止读数计算区间增量。",
    "groupId": "energy",
    "icon": "ThunderboltOutlined",
    "template": {
      "id": "iot-counter-usage",
      "version": "1",
      "name": "累计表区间用量",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "reading",
          "name": "电表读数",
          "valueType": {
            "type": "double",
            "scale": 8
          },
          "unit": "kWh",
          "source": {
            "lookback": "PT1H",
            "maxPoints": 128
          },
          "minSamples": 2,
          "maxGap": "PT30M"
        }
      ],
      "definitions": [
        {
          "name": "区间用电",
          "id": "usage",
          "inputs": [
            {
              "id": "reading",
              "metricId": "reading"
            }
          ],
          "calculator": {
            "provider": "measurement",
            "providerVersion": "1",
            "inputTypes": {
              "reading": {
                "type": "array",
                "elementType": {
                  "type": "double",
                  "scale": 8
                }
              }
            },
            "outputType": {
              "type": "double",
              "scale": 8
            },
            "outputUnit": "kWh",
            "parameters": {
              "operation": "increase",
              "negativeDelta": "reject"
            }
          }
        }
      ],
      "outputs": [
        {
          "metricId": "usage",
          "label": "区间用电",
          "unit": "kWh",
          "persist": true,
          "publish": true
        }
      ],
      "parameterDefinitions": [],
      "parameters": {},
      "options": {
        "description": "由同一累计表的实际起止读数计算区间增量。",
        "notes": "增量=结束读数−开始读数，返回实际覆盖区间，示例单位kWh可按声明修改。至少需要两条读数；负增量默认拒绝，不猜测复位/回绕，不能把缺测补0或当作完整自然小时用量。",
        "i18nMessages": {
          "name": {
            "zh": "累计表区间用量",
            "en": "Counter interval usage"
          },
          "description": {
            "zh": "由同一累计表的实际起止读数计算区间增量。",
            "en": "Calculate usage from actual start and end readings of one cumulative meter."
          },
          "notes": {
            "zh": "增量=结束读数−开始读数，返回实际覆盖区间，示例单位kWh可按声明修改。至少需要两条读数；负增量默认拒绝，不猜测复位/回绕，不能把缺测补0或当作完整自然小时用量。",
            "en": "Usage=end reading−start reading over the actual covered interval. kWh is an editable example unit. Require at least two readings. Reject negative changes by default rather than guessing resets or rollovers. Missing data is not zero or a complete calendar-hour total."
          },
          "input.reading.name": {
            "zh": "电表读数",
            "en": "Meter reading"
          },
          "rule.usage.name": {
            "zh": "区间用电",
            "en": "Consumption"
          },
          "output.usage.label": {
            "zh": "区间用电",
            "en": "Consumption"
          }
        },
        "category": "energy",
        "icon": "ThunderboltOutlined",
        "authoring": {
          "references": [
            {
              "kind": "observation",
              "name": "通用观测或算术规则",
              "description": "不宣称行业合规，示例参数需按实际配置。"
            }
          ]
        }
      },
      "thingType": "device"
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "slot": "example",
        "targetType": "simulation",
        "targetId": "example",
        "templateId": "iot-counter-usage",
        "templateVersion": "1",
        "state": "disabled",
        "revision": 0,
        "parameters": {},
        "inputMappings": {
          "reading": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-reading",
            "id": "reading"
          }
        }
      },
      "samples": [
        {
          "thingType": "device",
          "thingId": "example-reading",
          "metricId": "reading",
          "value": 100,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "unit": "kWh"
        },
        {
          "thingType": "device",
          "thingId": "example-reading",
          "metricId": "reading",
          "value": 104,
          "eventTime": 1793492100000,
          "ingestTime": 1793492100000,
          "processTime": 1793492100000,
          "quality": {
            "valid": true
          },
          "unit": "kWh"
        },
        {
          "thingType": "device",
          "thingId": "example-reading",
          "metricId": "reading",
          "value": 110,
          "eventTime": 1793493000000,
          "ingestTime": 1793493000000,
          "processTime": 1793493000000,
          "quality": {
            "valid": true
          },
          "unit": "kWh"
        }
      ]
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "计量与能耗",
    "groupNameI18n": {
      "zh": "计量与能耗",
      "en": "Metering and energy"
    }
  },
  {
    "id": "persistent-limit",
    "name": "持续越限与恢复",
    "description": "上下限持续满足设定时间后进入异常，恢复另设确认时间。",
    "groupId": "condition",
    "icon": "AlertOutlined",
    "template": {
      "id": "iot-persistent-limit",
      "version": "1",
      "name": "持续越限与恢复",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "temperature",
          "name": "温度",
          "valueType": {
            "type": "double",
            "scale": 8
          },
          "unit": "°C",
          "maxAge": "PT2M"
        }
      ],
      "definitions": [
        {
          "name": "持续越温",
          "id": "coldExcursion",
          "dependsOn": [
            "temperature"
          ],
          "temporalCondition": {
            "dwell": "PT5M",
            "recovery": "PT2M",
            "maxNoData": "PT2M",
            "enterTree": {
              "version": 1,
              "root": {
                "type": "logical",
                "operator": "or",
                "operands": [
                  {
                    "type": "binary",
                    "operator": "lt",
                    "left": {
                      "type": "reference",
                      "id": "temperature",
                      "path": []
                    },
                    "right": {
                      "type": "reference",
                      "id": "params",
                      "path": [
                        "lowerTemperature"
                      ]
                    }
                  },
                  {
                    "type": "binary",
                    "operator": "gt",
                    "left": {
                      "type": "reference",
                      "id": "temperature",
                      "path": []
                    },
                    "right": {
                      "type": "reference",
                      "id": "params",
                      "path": [
                        "upperTemperature"
                      ]
                    }
                  }
                ]
              }
            },
            "exitTree": {
              "version": 1,
              "root": {
                "type": "logical",
                "operator": "and",
                "operands": [
                  {
                    "type": "binary",
                    "operator": "ge",
                    "left": {
                      "type": "reference",
                      "id": "temperature",
                      "path": []
                    },
                    "right": {
                      "type": "reference",
                      "id": "params",
                      "path": [
                        "lowerTemperature"
                      ]
                    }
                  },
                  {
                    "type": "binary",
                    "operator": "le",
                    "left": {
                      "type": "reference",
                      "id": "temperature",
                      "path": []
                    },
                    "right": {
                      "type": "reference",
                      "id": "params",
                      "path": [
                        "upperTemperature"
                      ]
                    }
                  }
                ]
              }
            }
          },
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT1M"
          },
          "language": "spel"
        }
      ],
      "outputs": [
        {
          "metricId": "coldExcursion",
          "label": "持续越温",
          "persist": true,
          "publish": true
        }
      ],
      "parameterDefinitions": [
        {
          "id": "lowerTemperature",
          "name": "温度下限",
          "valueType": {
            "type": "double",
            "scale": 8,
            "unit": "°C"
          },
          "expands": {
            "editable": true,
            "defaultValue": 2
          }
        },
        {
          "id": "upperTemperature",
          "name": "温度上限",
          "valueType": {
            "type": "double",
            "scale": 8,
            "unit": "°C"
          },
          "expands": {
            "editable": true,
            "defaultValue": 8
          }
        }
      ],
      "parameters": {},
      "options": {
        "description": "上下限持续满足设定时间后进入异常，恢复另设确认时间。",
        "notes": "2–8°C、持续5分钟、恢复2分钟仅用于模拟，不是通用安全/食品/药品标准。绑定前按测点设置上下限和持续时间。超过2分钟无数据时为未知，不能据此判为正常。",
        "i18nMessages": {
          "name": {
            "zh": "持续越限与恢复",
            "en": "Persistent limit and recovery"
          },
          "description": {
            "zh": "上下限持续满足设定时间后进入异常，恢复另设确认时间。",
            "en": "Enter an abnormal state after a persistent bound violation, with a separate recovery delay."
          },
          "notes": {
            "zh": "2–8°C、持续5分钟、恢复2分钟仅用于模拟，不是通用安全/食品/药品标准。绑定前按测点设置上下限和持续时间。超过2分钟无数据时为未知，不能据此判为正常。",
            "en": "2–8°C, a five-minute dwell and two-minute recovery are simulation examples, not general safety, food or medicine limits. Configure bounds and delays for the measurement. No data for two minutes means unknown, not normal."
          },
          "input.temperature.name": {
            "zh": "温度",
            "en": "Temperature"
          },
          "parameter.lowerTemperature.name": {
            "zh": "温度下限",
            "en": "Lower temperature"
          },
          "parameter.upperTemperature.name": {
            "zh": "温度上限",
            "en": "Upper temperature"
          },
          "rule.coldExcursion.name": {
            "zh": "持续越温",
            "en": "Sustained excursion"
          },
          "output.coldExcursion.label": {
            "zh": "持续越温",
            "en": "Sustained excursion"
          }
        },
        "category": "condition",
        "icon": "AlertOutlined",
        "authoring": {
          "references": [
            {
              "kind": "observation",
              "name": "通用观测或算术规则",
              "description": "不宣称行业合规，示例参数需按实际配置。"
            }
          ]
        }
      },
      "thingType": "device"
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "slot": "example",
        "targetType": "simulation",
        "targetId": "example",
        "templateId": "iot-persistent-limit",
        "templateVersion": "1",
        "state": "disabled",
        "revision": 0,
        "parameters": {},
        "inputMappings": {
          "temperature": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-temperature",
            "id": "temperature"
          }
        }
      },
      "samples": [
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 5,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 9,
          "eventTime": 1793491260000,
          "ingestTime": 1793491260000,
          "processTime": 1793491260000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 9,
          "eventTime": 1793491320000,
          "ingestTime": 1793491320000,
          "processTime": 1793491320000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 9,
          "eventTime": 1793491380000,
          "ingestTime": 1793491380000,
          "processTime": 1793491380000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 9,
          "eventTime": 1793491440000,
          "ingestTime": 1793491440000,
          "processTime": 1793491440000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 9,
          "eventTime": 1793491500000,
          "ingestTime": 1793491500000,
          "processTime": 1793491500000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 9,
          "eventTime": 1793491560000,
          "ingestTime": 1793491560000,
          "processTime": 1793491560000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 5,
          "eventTime": 1793491620000,
          "ingestTime": 1793491620000,
          "processTime": 1793491620000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 5,
          "eventTime": 1793491680000,
          "ingestTime": 1793491680000,
          "processTime": 1793491680000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-temperature",
          "metricId": "temperature",
          "value": 5,
          "eventTime": 1793491740000,
          "ingestTime": 1793491740000,
          "processTime": 1793491740000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        }
      ],
      "endAt": 1793491740000
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "越限与变化",
    "groupNameI18n": {
      "zh": "越限与变化",
      "en": "Limits and changes"
    }
  },
  {
    "id": "measurement-difference",
    "name": "测点差值",
    "description": "在时间对齐和单位一致时，计算两个测点的差值。",
    "groupId": "condition",
    "icon": "DashboardOutlined",
    "template": {
      "id": "iot-measurement-difference",
      "version": "1",
      "name": "测点差值",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "bearingTemperature",
          "name": "测点 A",
          "valueType": {
            "type": "double",
            "scale": 8
          },
          "unit": "°C",
          "maxAge": "PT2M"
        },
        {
          "id": "ambientTemperature",
          "name": "测点 B",
          "valueType": {
            "type": "double",
            "scale": 8
          },
          "unit": "°C",
          "maxAge": "PT2M"
        }
      ],
      "definitions": [
        {
          "name": "差值",
          "id": "temperatureRise",
          "type": "composite",
          "dependsOn": [
            "bearingTemperature",
            "ambientTemperature"
          ],
          "maxInputSkew": "PT5S",
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "binary",
              "operator": "subtract",
              "left": {
                "type": "reference",
                "id": "bearingTemperature",
                "path": []
              },
              "right": {
                "type": "reference",
                "id": "ambientTemperature",
                "path": []
              }
            }
          },
          "language": "spel"
        }
      ],
      "outputs": [
        {
          "metricId": "temperatureRise",
          "label": "差值",
          "unit": "°C",
          "persist": true,
          "publish": true
        }
      ],
      "parameterDefinitions": [],
      "parameters": {},
      "options": {
        "description": "在时间对齐和单位一致时，计算两个测点的差值。",
        "notes": "差值=A−B；摄氏度温差只是示例，不诊断轴承故障，也不附加厂家阈值。两路数据最多相差5秒；缺数不补零，必须声明相同物理量和单位。",
        "i18nMessages": {
          "name": {
            "zh": "测点差值",
            "en": "Measurement difference"
          },
          "description": {
            "zh": "在时间对齐和单位一致时，计算两个测点的差值。",
            "en": "Subtract two aligned measurements with matching units."
          },
          "notes": {
            "zh": "差值=A−B；摄氏度温差只是示例，不诊断轴承故障，也不附加厂家阈值。两路数据最多相差5秒；缺数不补零，必须声明相同物理量和单位。",
            "en": "Difference=A−B. A temperature difference is an example, not a bearing diagnosis or manufacturer limit. Input times may differ by at most five seconds. Require the same physical quantity and unit; missing data is not zero."
          },
          "input.bearingTemperature.name": {
            "zh": "测点 A",
            "en": "Measurement A"
          },
          "input.ambientTemperature.name": {
            "zh": "测点 B",
            "en": "Measurement B"
          },
          "rule.temperatureRise.name": {
            "zh": "差值",
            "en": "Difference"
          },
          "output.temperatureRise.label": {
            "zh": "差值",
            "en": "Difference"
          }
        },
        "category": "condition",
        "icon": "DashboardOutlined",
        "authoring": {
          "references": [
            {
              "kind": "observation",
              "name": "通用观测或算术规则",
              "description": "不宣称行业合规，示例参数需按实际配置。"
            }
          ]
        }
      },
      "thingType": "device"
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "slot": "example",
        "targetType": "simulation",
        "targetId": "example",
        "templateId": "iot-measurement-difference",
        "templateVersion": "1",
        "state": "disabled",
        "revision": 0,
        "parameters": {},
        "inputMappings": {
          "bearingTemperature": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-bearingTemperature",
            "id": "bearingTemperature"
          },
          "ambientTemperature": {
            "kind": "property",
            "thingType": "device",
            "thingId": "example-ambientTemperature",
            "id": "ambientTemperature"
          }
        }
      },
      "samples": [
        {
          "thingType": "device",
          "thingId": "example-bearingTemperature",
          "metricId": "bearingTemperature",
          "value": 65,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-ambientTemperature",
          "metricId": "ambientTemperature",
          "value": 25,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-bearingTemperature",
          "metricId": "bearingTemperature",
          "value": 85,
          "eventTime": 1793491260000,
          "ingestTime": 1793491260000,
          "processTime": 1793491260000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        },
        {
          "thingType": "device",
          "thingId": "example-ambientTemperature",
          "metricId": "ambientTemperature",
          "value": 25,
          "eventTime": 1793491260000,
          "ingestTime": 1793491260000,
          "processTime": 1793491260000,
          "quality": {
            "valid": true
          },
          "unit": "°C"
        }
      ]
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "越限与变化",
    "groupNameI18n": {
      "zh": "越限与变化",
      "en": "Limits and changes"
    }
  },
  {
    "id": "scope-connectivity",
    "name": "范围设备在线统计",
    "description": "读取产品、分组或空间当前范围内的设备数量与在线率。",
    "groupId": "scope",
    "icon": "ClusterOutlined",
    "template": {
      "id": "iot-scope-connectivity",
      "version": "2",
      "name": "范围设备在线统计",
      "enabled": true,
      "inputDefinitions": [
        {
          "id": "deviceCount",
          "name": "设备总数",
          "valueType": {
            "type": "long",
            "min": 0
          },
          "maxAge": "PT10M"
        },
        {
          "id": "onlineDeviceCount",
          "name": "在线设备数",
          "valueType": {
            "type": "long",
            "min": 0
          },
          "maxAge": "PT10M"
        },
        {
          "id": "offlineDeviceCount",
          "name": "离线设备数",
          "valueType": {
            "type": "long",
            "min": 0
          },
          "maxAge": "PT10M"
        }
      ],
      "definitions": [
        {
          "name": "设备总数",
          "id": "deviceCountResult",
          "type": "composite",
          "dependsOn": [
            "deviceCount"
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT5M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "deviceCount",
              "path": []
            }
          },
          "language": "spel"
        },
        {
          "name": "在线设备数",
          "id": "onlineDeviceCountResult",
          "type": "composite",
          "dependsOn": [
            "onlineDeviceCount"
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT5M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "onlineDeviceCount",
              "path": []
            }
          },
          "language": "spel"
        },
        {
          "name": "离线设备数",
          "id": "offlineDeviceCountResult",
          "type": "composite",
          "dependsOn": [
            "offlineDeviceCount"
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT5M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "reference",
              "id": "offlineDeviceCount",
              "path": []
            }
          },
          "language": "spel"
        },
        {
          "name": "设备在线率",
          "id": "scopeOnlinePercent",
          "type": "composite",
          "dependsOn": [
            "deviceCount",
            "onlineDeviceCount"
          ],
          "window": {
            "mode": "none",
            "timeMode": "processing",
            "emitPolicy": "onSchedule",
            "emitInterval": "PT5M"
          },
          "expressionTree": {
            "version": 1,
            "root": {
              "type": "binary",
              "operator": "divide",
              "left": {
                "type": "binary",
                "operator": "multiply",
                "left": {
                  "type": "reference",
                  "id": "onlineDeviceCount",
                  "path": []
                },
                "right": {
                  "type": "literal",
                  "valueType": "double",
                  "value": "100.0"
                }
              },
              "right": {
                "type": "reference",
                "id": "deviceCount",
                "path": []
              }
            }
          },
          "language": "spel",
          "applicabilityTree": {
            "version": 1,
            "root": {
              "type": "binary",
              "operator": "gt",
              "left": {
                "type": "reference",
                "id": "deviceCount",
                "path": []
              },
              "right": {
                "type": "literal",
                "valueType": "int",
                "value": "0"
              }
            }
          }
        }
      ],
      "outputs": [
        {
          "metricId": "deviceCountResult",
          "label": "设备总数",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "onlineDeviceCountResult",
          "label": "在线设备数",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "offlineDeviceCountResult",
          "label": "离线设备数",
          "persist": true,
          "publish": true
        },
        {
          "metricId": "scopeOnlinePercent",
          "label": "设备在线率",
          "unit": "%",
          "persist": true,
          "publish": true
        }
      ],
      "parameterDefinitions": [],
      "parameters": {},
      "options": {
        "description": "读取产品、分组或空间当前范围内的设备数量与在线率。",
        "notes": "使用当前对象内置数量，每5分钟更新。总数包含未激活设备，在线+离线可以小于总数；在线率=在线数/总数，总数为0不计算。范围与子级由绑定明确，不重建历史成员，也不等同生产开机率。",
        "i18nMessages": {
          "name": {
            "zh": "范围设备在线统计",
            "en": "Scope connectivity counts"
          },
          "description": {
            "zh": "读取产品、分组或空间当前范围内的设备数量与在线率。",
            "en": "Read current device counts and online ratio for a product, group or space."
          },
          "notes": {
            "zh": "使用当前对象内置数量，每5分钟更新。总数包含未激活设备，在线+离线可以小于总数；在线率=在线数/总数，总数为0不计算。范围与子级由绑定明确，不重建历史成员，也不等同生产开机率。",
            "en": "Use built-in counts of the current object, updated every five minutes. Total includes inactive devices, so online+offline may be less than total. Online ratio=online/total; zero total yields no ratio. Bind scope and descendants explicitly. This is not historical membership reconstruction or production uptime."
          },
          "input.deviceCount.name": {
            "zh": "设备总数",
            "en": "Total devices"
          },
          "input.onlineDeviceCount.name": {
            "zh": "在线设备数",
            "en": "Online devices"
          },
          "input.offlineDeviceCount.name": {
            "zh": "离线设备数",
            "en": "Offline devices"
          },
          "rule.deviceCountResult.name": {
            "zh": "设备总数",
            "en": "Total devices"
          },
          "rule.onlineDeviceCountResult.name": {
            "zh": "在线设备数",
            "en": "Online devices"
          },
          "rule.offlineDeviceCountResult.name": {
            "zh": "离线设备数",
            "en": "Offline devices"
          },
          "rule.scopeOnlinePercent.name": {
            "zh": "设备在线率",
            "en": "Device online rate"
          },
          "output.deviceCountResult.label": {
            "zh": "设备总数",
            "en": "Total devices"
          },
          "output.onlineDeviceCountResult.label": {
            "zh": "在线设备数",
            "en": "Online devices"
          },
          "output.offlineDeviceCountResult.label": {
            "zh": "离线设备数",
            "en": "Offline devices"
          },
          "output.scopeOnlinePercent.label": {
            "zh": "设备在线率",
            "en": "Device online rate"
          }
        },
        "category": "scope",
        "icon": "ClusterOutlined",
        "authoring": {
          "references": [
            {
              "kind": "observation",
              "name": "通用观测或算术规则",
              "description": "不宣称行业合规，示例参数需按实际配置。"
            }
          ]
        }
      }
    },
    "simulation": {
      "configuration": {
        "ownerType": "simulation",
        "ownerId": "example",
        "slot": "example",
        "targetType": "simulation",
        "targetId": "example",
        "templateId": "iot-scope-connectivity",
        "templateVersion": "2",
        "state": "disabled",
        "revision": 0,
        "parameters": {},
        "inputMappings": {
          "deviceCount": {
            "kind": "builtin",
            "thingType": "deviceGroup",
            "thingId": "example-line",
            "id": "deviceCount"
          },
          "onlineDeviceCount": {
            "kind": "builtin",
            "thingType": "deviceGroup",
            "thingId": "example-line",
            "id": "onlineDeviceCount"
          },
          "offlineDeviceCount": {
            "kind": "builtin",
            "thingType": "deviceGroup",
            "thingId": "example-line",
            "id": "offlineDeviceCount"
          }
        }
      },
      "samples": [
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "deviceCount",
          "value": 10,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "onlineDeviceCount",
          "value": 8,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "offlineDeviceCount",
          "value": 1,
          "eventTime": 1793491200000,
          "ingestTime": 1793491200000,
          "processTime": 1793491200000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "deviceCount",
          "value": 10,
          "eventTime": 1793491500000,
          "ingestTime": 1793491500000,
          "processTime": 1793491500000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "onlineDeviceCount",
          "value": 7,
          "eventTime": 1793491500000,
          "ingestTime": 1793491500000,
          "processTime": 1793491500000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "offlineDeviceCount",
          "value": 2,
          "eventTime": 1793491500000,
          "ingestTime": 1793491500000,
          "processTime": 1793491500000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "deviceCount",
          "value": 10,
          "eventTime": 1793491800000,
          "ingestTime": 1793491800000,
          "processTime": 1793491800000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "onlineDeviceCount",
          "value": 6,
          "eventTime": 1793491800000,
          "ingestTime": 1793491800000,
          "processTime": 1793491800000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        },
        {
          "thingType": "deviceGroup",
          "thingId": "example-line",
          "metricId": "offlineDeviceCount",
          "value": 3,
          "eventTime": 1793491800000,
          "ingestTime": 1793491800000,
          "processTime": 1793491800000,
          "quality": {
            "valid": true
          },
          "sourceKind": "builtin"
        }
      ],
      "endAt": 1793491800000
    },
    "providerName": "通用 IoT 模板",
    "providerNameI18n": {
      "zh": "通用 IoT 模板",
      "en": "General IoT templates"
    },
    "groupName": "范围汇总",
    "groupNameI18n": {
      "zh": "范围汇总",
      "en": "Scope summaries"
    }
  }
]

export const iotMetricStarters: MetricTemplateStarter[] = declarations.map(item => ({
  ...item,
  providerId: 'device-iot',
}))
