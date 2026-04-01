<template>
  <div class="mm-wrap">
    <div ref="mmMainResizeRef" class="mm-main">
      <!-- ===== 左侧：映射表格 ===== -->
      <div class="mm-main-left" :style="{ width: leftMainPercent + '%' }">
        <div class="mm-link-type-bar">
          <span class="mm-link-type-lbl">链路类型</span>
          <a-radio-group v-model:value="modbusLinkType" size="small" button-style="solid">
            <a-radio-button value="PDU">PDU</a-radio-button>
            <a-radio-button value="TCP">TCP</a-radio-button>
            <a-radio-button value="RTU">RTU</a-radio-button>
          </a-radio-group>
          <span class="mm-link-type-hint">解析与编码：TCP 含 MBAP；RTU 含 CRC；PDU 为裸 PDU（与历史默认一致）</span>
        </div>
        <div ref="tableScrollEl" class="mm-table-scroll">
      <a-table
        :data-source="mappings"
        :columns="columns"
        :pagination="false"
        size="small"
        :loading="loading"
        :scroll="{ x: 872, y: tableBodyScrollY }"
        class="mm-table"
        :row-key="(_: any, index: number) => index"
      >
      <template #headerCell="{ column }">
        <template v-if="column.key === 'action'">
          <div class="mm-action-header">
            <span class="mm-action-header-title">操作</span>
            <a-button type="link" size="small" class="mm-action-header-add" @click.stop="addMapping">
              <template #icon><PlusOutlined /></template>
              新增点位
            </a-button>
          </div>
        </template>
      </template>
      <template #bodyCell="{ column, record, index }">
        <!-- 属性：下方展示物模型说明 + 读写标签（与 Modbus 区功能码是否支持读/写校验） -->
        <template v-if="column.key === 'property'">
          <!-- AutoComplete：自由输入任意标识；收起态物模型属性展示「名称 + 弱化 id」 -->
          <div class="mm-prop-ac-wrap">
            <div
              v-show="
                focusedPropertyIndex !== index &&
                record.property &&
                getPropNameById(record.property)
              "
              class="mm-prop-ac-fake"
              aria-hidden="true"
            >
              <span class="mm-prop-ac-fake-name">{{ getPropNameById(record.property) }}</span>
              <span class="mm-prop-ac-fake-id">{{ record.property }}</span>
            </div>
            <a-auto-complete
              :value="record.property"
              :options="propertyOptions"
              :filter-option="filterPropertyACOption"
              allow-clear
              placeholder="输入或选择属性标识"
              style="width: 100%"
              size="small"
              class="mm-prop-ac"
              :class="{
                'mm-prop-ac--ghost':
                  focusedPropertyIndex !== index &&
                  !!record.property &&
                  !!getPropNameById(record.property),
              }"
              popup-class-name="mm-prop-select-dropdown"
              :dropdown-match-select-width="false"
              :list-item-height="34"
              @focus="focusedPropertyIndex = index"
              @blur="onPropertyInputBlur"
              @update:value="(v) => onPropertyAcUpdate(v, record)"
            >
              <template #option="opt">
                <div class="mm-prop-opt">
                  <span class="mm-prop-opt-name">{{ opt.propName }}</span>
                  <span class="mm-prop-opt-id">{{ opt.propId }}</span>
                </div>
              </template>
            </a-auto-complete>
          </div>
          <div v-if="isPropertyNotInThingModel(record.property)" class="mm-prop-undef-hint">
            物模型未定义
          </div>
          <template v-for="pMeta in [getPropertyUiMeta(record)]" :key="'pm-' + index">
            <template v-if="pMeta">
              <div v-if="pMeta.description" class="mm-prop-desc">{{ pMeta.description }}</div>
              <div v-if="pMeta.thingRead || pMeta.thingWrite" class="mm-prop-rw-tags">
                <template v-if="pMeta.thingRead">
                  <a-tooltip v-if="pMeta.conflictRead" title="该功能码不支持读操作">
                    <span class="mm-rw-conflict-wrap">
                      <a-tag color="error" size="small">读</a-tag>
                      <ExclamationCircleOutlined class="mm-rw-warn-icon" />
                    </span>
                  </a-tooltip>
                  <a-tag v-else color="processing" size="small">读</a-tag>
                </template>
                <template v-if="pMeta.thingWrite">
                  <a-tooltip v-if="pMeta.conflictWrite" title="该功能码不支持写操作">
                    <span class="mm-rw-conflict-wrap">
                      <a-tag color="error" size="small">写</a-tag>
                      <ExclamationCircleOutlined class="mm-rw-warn-icon" />
                    </span>
                  </a-tooltip>
                  <a-tag v-else color="processing" size="small">写</a-tag>
                </template>
              </div>
            </template>
          </template>
        </template>

        <!-- 寄存器地址 -->
        <template v-else-if="column.key === 'register'">
          <a-input
            v-model:value="record.registerStr"
            placeholder="如 40001  或  3_0"
            size="small"
            @change="() => onRegisterStrChange(record)"
          />
          <div class="cell-hint">
            <template
              v-for="hint in [record.registerStr ? getRegisterHintData(record.registerStr) : null]"
              :key="0"
            >
              <div v-if="hint" class="reg-hint">
                <!-- Row1：区域标识 + 输入格式主地址 -->
                <div class="reg-hint-row1">
                  <span class="reg-zone-badge" :style="{ color: hint.color, background: hint.bg }">{{ hint.zonePrefix }}</span>
                  <span class="reg-zone-name">{{ hint.zoneName }}</span>
                  <template v-if="hint.inputFormat === 'plc'">
                    <!-- PLC格式输入 → Row1 显示 PLC 地址 -->
                    <span class="reg-addr-val">#{{ hint.stdAddr }}<template v-if="hint.stdAddrEnd"> ~ #{{ hint.stdAddrEnd }}</template></span>
                  </template>
                  <template v-else>
                    <!-- FC格式输入 → Row1 显示 FC + Modbus 地址 -->
                    <span class="reg-fc-inline">{{ hint.fcCode }}</span>
                    <span class="reg-addr-val">addr {{ hint.modbusAddr }}<template v-if="hint.modbusAddrEnd !== undefined"> ~ {{ hint.modbusAddrEnd }}</template></span>
                  </template>
                  <span v-if="hint.slaveId" class="reg-slave">从站 {{ hint.slaveId }}</span>
                </div>
                <!-- Row2：交叉解释（另一种地址表示） + 寄存器数/字节数 -->
                <div class="reg-hint-row2">
                  <template v-if="hint.inputFormat === 'plc'">
                    <!-- PLC格式输入 → Row2 显示 Modbus 解释 -->
                    <span class="reg-interp-label">Modbus</span>
                    <span class="reg-fc-badge">{{ hint.fcCode }}</span>
                    <span class="reg-meta-sep">·</span>
                    <span>addr {{ hint.modbusAddr }}<template v-if="hint.modbusAddrEnd !== undefined"> ~ {{ hint.modbusAddrEnd }}</template></span>
                  </template>
                  <template v-else>
                    <!-- FC格式输入 → Row2 显示 PLC 解释 -->
                    <span class="reg-interp-label">PLC</span>
                    <span class="reg-addr-val-sm">#{{ hint.stdAddr }}<template v-if="hint.stdAddrEnd"> ~ #{{ hint.stdAddrEnd }}</template></span>
                  </template>
                  <span class="reg-meta-sep">·</span>
                  <template v-if="hint.addressing === 'bit'">
                    <span>{{ hint.count }} 位</span>
                    <span class="reg-meta-sep">·</span>
                    <span>报文数据区约 {{ hint.dataBytes }} 字节</span>
                    <span class="reg-meta-sep">·</span>
                    <span class="reg-micro">8 位/字节打包</span>
                  </template>
                  <template v-else>
                    <span>{{ hint.count }} 字</span>
                    <span class="reg-meta-sep">·</span>
                    <span>16 位/字</span>
                    <span class="reg-meta-sep">·</span>
                    <span>{{ hint.dataBytes }} 字节</span>
                  </template>
                  <template v-if="hint.bitIndex !== undefined">
                    <span class="reg-meta-sep">·</span>
                    <span>第 {{ hint.bitIndex }} 位</span>
                  </template>
                  <template v-if="hint.elementIndex !== undefined">
                    <span class="reg-meta-sep">·</span>
                    <span>元素[{{ hint.elementIndex }}]</span>
                  </template>
                </div>
                <div class="reg-hint-row3">
                  <span class="reg-hint-zone-explain">{{ hint.zoneExplain }}</span>
                  <template v-if="isHoldingWordBitSlice(record.registerStr)">
                    <span class="reg-meta-sep">·</span>
                    <span class="mm-reg-mask-tail" @click.stop>
                      <a-tooltip
                        title="开启后下行使用功能码 0x16（Mask Write）按位更新，需设备支持。关闭则合并整字后走 FC06 / 写多寄存器。位索引由地址第三段决定（如 3_0_1）。"
                      >
                        <span class="mm-reg-mask-tail-lbl">掩码</span>
                      </a-tooltip>
                      <a-switch
                        size="small"
                        class="mm-reg-mask-tail-sw"
                        :checked="record.useMaskWrite === true"
                        @update:checked="(v: boolean) => { record.useMaskWrite = v }"
                      />
                    </span>
                  </template>
                </div>
              </div>
              <div v-else-if="record.registerStr" class="reg-hint-error">格式错误</div>
            </template>
          </div>
        </template>

        <!-- 解析：类型 + 布局同一行；缩放/小数在下方（与抽屉一致逻辑） -->
        <template v-else-if="column.key === 'codecLayout'">
          <div class="mm-codec-layout-cell">
            <div class="mm-parse-inline-top">
              <span class="mm-parse-label mm-parse-label--inline">类型：</span>
              <a-select
                v-model:value="record.codec"
                class="mm-parse-inline-sel"
                placeholder="填写地址后选择"
                allow-clear
                size="small"
                option-label-prop="label"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
                @change="() => onCodecChange(record)"
              >
                <template v-for="grp in getCodecOptionsForCount(record.registerStr)" :key="grp.label">
                  <a-select-opt-group :label="grp.label">
                    <a-select-option
                      v-for="opt in grp.options"
                      :key="opt.value"
                      :value="opt.value"
                      :label="shortCodecLabel(opt.value)"
                    >
                      <div class="mm-codec-opt">
                        <div class="mm-codec-opt-title">{{ shortCodecLabel(opt.value) }}</div>
                        <div class="mm-codec-opt-desc">{{ opt.desc }}</div>
                      </div>
                    </a-select-option>
                  </a-select-opt-group>
                </template>
              </a-select>
              <span class="mm-parse-label mm-parse-label--inline">布局：</span>
              <a-select
                v-if="getLayoutOptions(record.registerStr).length"
                v-model:value="record.layout"
                class="mm-parse-inline-sel mm-parse-inline-sel--layout"
                size="small"
                option-label-prop="label"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
              >
                <a-select-option
                  v-for="opt in getLayoutOptions(record.registerStr)"
                  :key="opt.value"
                  :value="opt.value"
                  :label="layoutShortLabel(opt.value)"
                >
                  <div class="mm-codec-opt">
                    <div class="mm-codec-opt-title">{{ opt.title }}</div>
                    <div class="mm-codec-opt-desc">{{ opt.desc }}</div>
                  </div>
                </a-select-option>
              </a-select>
              <span v-else class="mm-parse-layout-dash">—</span>
            </div>
            <div v-if="record.registerStr && doParseRegisterStr(record.registerStr)" class="cell-hint mm-parse-hint">
              <span class="codec-count-hint">{{ getCodecFilterHint(record.registerStr) }}</span>
            </div>
            <div v-if="isNumericCodec(record.codec)" class="mm-parse-scale-row">
              <span class="mm-parse-scale-inline">
                <a-tooltip title="物模型值 = 寄存器值 × 因子；1 表示不缩放">
                  <span class="mm-parse-scale-lbl">缩放</span>
                </a-tooltip>
                <a-input-number
                  v-model:value="record.scaleFactor"
                  string-mode
                  :precision="15"
                  :step="1e-12"
                  size="small"
                  :controls="false"
                  :bordered="false"
                  placeholder="1"
                  class="mm-parse-scale-inn mm-parse-scale-inn--factor"
                  @change="(v) => onTableScaleFactorChange(record, v)"
                />
              </span>
              <span class="mm-parse-scale-sep">·</span>
              <span class="mm-parse-scale-inline">
                <a-tooltip title="-1 不处理小数；0 取整；≥1 保留位数">
                  <span class="mm-parse-scale-lbl">小数</span>
                </a-tooltip>
                <a-input-number
                  v-model:value="record.scale"
                  :min="-1"
                  :precision="0"
                  size="small"
                  :controls="false"
                  :bordered="false"
                  placeholder="-1"
                  class="mm-parse-scale-inn mm-parse-scale-inn--scale"
                  @change="(v) => onTableScaleChange(record, v)"
                />
              </span>
            </div>
          </div>
        </template>

        <!-- 操作 -->
        <template v-else-if="column.key === 'action'">
          <a-space :size="0">
            <a-tooltip title="编辑详细配置">
              <a-button type="link" size="small" @click="openDrawer(record, index)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="复制到下一行">
              <a-button type="link" size="small" @click="copyMapping(index)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-popconfirm
              title="确定删除此映射?"
              ok-text="删除"
              cancel-text="取消"
              @confirm="removeMapping(index)"
            >
              <a-button type="link" size="small" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>

      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无映射配置">
          <a-button size="small" type="primary" @click="addMapping">新增点位</a-button>
        </a-empty>
      </template>
      </a-table>
        </div>
      </div>

      <div
        class="mm-splitter"
        title="拖动调整编辑区与调试区宽度"
        role="separator"
        aria-orientation="vertical"
        @mousedown.prevent="onMmMainSplitterMouseDown"
      />

      <!-- ===== 右侧：调试（sticky，不随页面滚动离开视区） ===== -->
      <aside class="mm-main-right">
    <div class="mm-debug">
      <a-tabs size="small" type="card">
        <a-tab-pane key="decode" tab="解码调试（设备 → 平台）">
          <div class="debug-body decode-debug-wrap">
            <div class="decode-debug-grid">
              <!-- 左侧：输入 -->
              <div class="decode-debug-col decode-debug-input">
                <div class="decode-sim-bar">
                  <span class="decode-sim-title">模拟报文</span>
                  <a-input
                    v-model:value="decodeSimAddressStr"
                    class="decode-sim-addr-input"
                    size="small"
                    allow-clear
                    placeholder="40001 / 3_0-7"
                  />
                  <code
                    class="decode-sim-hex-preview"
                    :title="decodeSimHexFull"
                  >{{ decodeSimHexShort }}</code>
                  <a-space :size="0" class="decode-sim-actions">
                    <a-tooltip title="重新随机生成数据区（地址不变）">
                      <a-button type="text" size="small" class="decode-sim-icon-btn" @click="refreshDecodeSimFrame">
                        <template #icon><ReloadOutlined /></template>
                      </a-button>
                    </a-tooltip>
                    <a-tooltip title="填入下方「原始数据」框">
                      <a-button type="text" size="small" class="decode-sim-icon-btn" @click="applyDecodeSimToPayload">
                        <template #icon><DownOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </a-space>
                </div>
                <div v-if="decodeSimError" class="decode-sim-error">{{ decodeSimError }}</div>
                <div v-else-if="decodeSimMetaLine" class="decode-sim-meta">{{ decodeSimMetaLine }}</div>
                <a-textarea
                  v-model:value="decodePayload"
                  placeholder="Hex / Base64，识别为完整 Modbus 报文后将自动按映射解码"
                  :rows="2"
                  class="decode-textarea decode-textarea--compact"
                />
                <div
                  v-if="decodePayload.trim() && decodeInputNormalized.parseError"
                  class="decode-input-meta decode-input-meta--error"
                >
                  <span class="decode-parse-warn">{{ decodeInputNormalized.parseError }}</span>
                </div>
                <div v-if="decoding" class="decode-auto-hint">解码中…</div>
                <div class="decode-pdu-coil-base">
                  <span class="decode-pdu-coil-base-lbl">数据区起始线圈（0 起算）</span>
                  <a-input-number
                    v-model:value="decodePduCoilBase"
                    :min="0"
                    :max="65535"
                    size="small"
                    :step="1"
                    :controls="true"
                    class="decode-pdu-coil-base-inn"
                  />
                  <a-tooltip
                    title="用于对齐「数据区第 1 位」在设备上的线圈地址：整段响应从 0 起读时填 0；若粘贴的是一段子区间，请填该区间的起始地址。下方着色按报文里的位顺序，与映射里「字节顺序」设置含义不同。"
                  >
                    <span class="decode-pdu-coil-base-hint">?</span>
                  </a-tooltip>
                </div>
              </div>
              <!-- 右侧：Modbus 报文解释 -->
              <div class="decode-debug-col decode-debug-parse">
                <div class="debug-label">Modbus 报文与映射</div>
                <div v-if="!decodePayload.trim()" class="decode-parse-empty">在左侧粘贴原始数据，将自动解析报文并执行映射解码</div>
                <div v-else-if="decodeInputNormalized.parseError" class="decode-parse-empty decode-parse-err">
                  {{ decodeInputNormalized.parseError }}
                </div>
                <div v-else-if="decodeFrameAnalysis" class="modbus-parse-card modbus-parse-compact">
                  <template v-for="a in [decodeFrameAnalysis]" :key="'dec'">
                    <div class="mp-compact-head">
                      <a-tag size="small" class="mp-tag-tight">{{ a.linkTypeLabel }}</a-tag>
                      <span class="mp-head-meta">单元 <b>{{ a.unitId }}</b> · {{ a.fcLabel }}</span>
                    </div>
                    <div v-if="a.tcpHeader" class="mp-compact-line mp-mono mp-fade" :title="a.tcpHeader">
                      {{ a.tcpHeader }}
                    </div>
                    <div v-if="a.isException" class="mp-compact-exc">{{ a.exceptionLabel }}</div>
                    <template v-else>
                      <div
                        v-if="a.requestStartAddr !== undefined || a.requestQuantity !== undefined"
                        class="mp-compact-kv"
                      >
                        <template v-if="a.requestStartAddr !== undefined">
                          <span class="mp-ck">起始地址</span><span class="mp-cv">{{ a.requestStartAddr }}</span>
                        </template>
                        <template v-if="a.requestQuantity !== undefined">
                          <span class="mp-ck">数量</span><span class="mp-cv">{{ a.requestQuantity }}</span>
                        </template>
                      </div>
                      <div v-if="a.byteCount !== undefined" class="mp-compact-kv">
                        <span class="mp-ck">数据字节</span><span class="mp-cv">{{ a.byteCount }}</span>
                        <template v-if="a.wordRegisterCount">
                          <span class="mp-ck">字数</span><span class="mp-cv">{{ a.wordRegisterCount }}</span>
                        </template>
                      </div>
                      <!-- PDU 数据区：与映射融合；未解码仅字节标签，解码后着色映射 -->
                      <div v-if="decodePduStrip && !a.isException" class="mp-pdu-fusion">
                        <div class="mp-pdu-fusion-head">
                          <span class="mp-pdu-fusion-ttl">PDU 数据区</span>
                          <template v-if="decodeShowMappingGrid && decodeVisualPayload">
                            <span class="mp-pdu-fusion-meta"
                              >{{ decodeVisualPayload.fcLabel }} · {{ decodeVisualPayload.data.length }} 字节</span
                            >
                            <span v-if="decodeVisualPayload.pduKind === 'word'" class="mp-pdu-fusion-meta"
                              >· 基准 PDU 字 {{ decodeVisualPayload.minPdu }}</span
                            >
                            <span v-else class="mp-pdu-fusion-meta"
                              >· 数据区起始线圈 {{ decodeVisualPayload.minPdu }}</span
                            >
                            <span class="mp-pdu-fusion-badge mp-pdu-fusion-badge--ok">已映射</span>
                          </template>
                          <template v-else-if="decodePduStrip">
                            <span class="mp-pdu-fusion-meta"
                              >{{ FC_NAMES[decodePduStrip.fc] || '功能码 0x' + decodePduStrip.fc.toString(16) }} ·
                              {{ decodePduStrip.data.length }} 字节</span
                            >
                            <span
                              v-if="decodeResult?.success && decodeVisualPayload?.kind === 'fallback'"
                              class="mp-pdu-fusion-badge mp-pdu-fusion-badge--warn"
                              >未对齐</span
                            >
                            <span v-else-if="decodeResult && !decodeResult.success" class="mp-pdu-fusion-badge mp-pdu-fusion-badge--err"
                              >解码失败</span
                            >
                            <span v-else class="mp-pdu-fusion-badge mp-pdu-fusion-badge--muted">待解码</span>
                          </template>
                        </div>

                        <template v-if="decodeShowMappingGrid && decodeVisualPayload">
                          <div class="decode-visual-map decode-visual-map--embedded">
                            <div class="dvm-hint">
                              <b>按字</b>：悬停属性时仅<strong>框选寄存器</strong>（外框）。<b>按位（线圈/离散）</b>：Hex 下为 8 位格；其下为<strong>位序号 7→0</strong>（高位在左）。每位<strong>0/1</strong>仅用<strong>位格底色</strong>区分（浅灰=0，浅蓝=1）。若已映射属性则下边框叠加属性色号。重叠位不画位线。
                            </div>
                            <!-- 保持/输入寄存器：每字 2 字节外层寄存器框 -->
                            <div
                              v-if="decodeVisualPayload.pduKind === 'word'"
                              class="dvm-byte-strip dvm-byte-strip--word"
                            >
                              <div
                                v-for="(grp, gi) in decodeWordRegisterGroups"
                                :key="'wr' + gi"
                                class="dvm-reg-wrap"
                                :class="decodeRegWrapHoverClass('word', gi)"
                              >
                                <span class="dvm-reg-chip">#{{ gi }}</span>
                                <div class="dvm-reg-inner">
                                  <div
                                    v-for="(b, j) in grp.bytes"
                                    :key="'db' + grp.start + j"
                                    class="dvm-byte-cell"
                                  >
                                    <div
                                      class="dvm-byte-hex"
                                      :class="decodeByteHexSurfaceClass(grp.start + j)"
                                      :title="
                                        decodeVisualPayload.byteTone[grp.start + j] < 0 &&
                                        decodeVisualPayload.bitTone[grp.start + j]?.some((t) => t >= 0)
                                          ? '本字节内包含多个映射属性，整格无单一色号；请看下方按位颜色'
                                          : undefined
                                      "
                                    >
                                      {{ b.toString(16).padStart(2, '0').toUpperCase() }}
                                    </div>
                                    <div class="dvm-byte-bits">
                                      <div
                                        v-for="slot in 8"
                                        :key="'bit' + grp.start + j + '-' + slot"
                                        :class="decodeBitCellClass(grp.start + j, 8 - slot)"
                                        :title="
                                          'B' +
                                          (grp.start + j) +
                                          ' · bit' +
                                          (8 - slot) +
                                          ' = ' +
                                          ((b >> (8 - slot)) & 1)
                                        "
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <!-- 线圈/离散：每字节一块外框 -->
                            <div
                              v-else
                              class="dvm-byte-strip dvm-byte-strip--bit"
                            >
                              <div
                                v-for="(b, bi) in decodeVisualPayload.data"
                                :key="'db' + bi"
                                class="dvm-reg-wrap dvm-reg-wrap--coil"
                                :class="decodeRegWrapHoverClass('bit', bi)"
                              >
                                <span class="dvm-reg-chip">B{{ bi }}</span>
                                <div class="dvm-reg-inner dvm-reg-inner--single">
                                  <div class="dvm-byte-cell">
                                    <div
                                      class="dvm-byte-hex"
                                      :class="decodeByteHexSurfaceClass(bi)"
                                      :title="
                                        decodeVisualPayload.byteTone[bi] < 0 &&
                                        decodeVisualPayload.bitTone[bi]?.some((t) => t >= 0)
                                          ? '本字节内包含多个映射属性，整格无单一色号；请看下方按位颜色'
                                          : undefined
                                      "
                                    >
                                      {{ b.toString(16).padStart(2, '0').toUpperCase() }}
                                    </div>
                                    <div class="dvm-byte-bits">
                                      <div
                                        v-for="slot in 8"
                                        :key="'bit' + bi + '-' + slot"
                                        :class="decodeBitCellClass(bi, 8 - slot)"
                                        :title="
                                          'B' +
                                          bi +
                                          ' · bit' +
                                          (8 - slot) +
                                          ' = ' +
                                          ((b >> (8 - slot)) & 1)
                                        "
                                      />
                                    </div>
                                    <div class="dvm-bit-meta-row" aria-hidden="true">
                                      <span
                                        v-for="slot in 8"
                                        :key="'bidx' + bi + '-' + slot"
                                        class="dvm-bit-idx-lbl"
                                        >{{ 8 - slot }}</span
                                      >
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div class="dvm-prop-list">
                              <div
                                v-for="seg in decodeVisualPayload.segments"
                                :key="seg.propertyId"
                                class="dvm-prop-compact"
                                :class="{ 'dvm-prop-compact--hover': decodeHoverSegmentId === seg.propertyId }"
                                @mouseenter="decodeHoverSegmentId = seg.propertyId"
                                @mouseleave="decodeHoverSegmentId = null"
                              >
                                <span class="dvm-dot" :class="'dvm-t-' + seg.tone" />
                                <span class="dvm-prop-id">{{ seg.propertyId }}</span>
                                <span class="dvm-prop-val">{{ seg.displayValue }}</span>
                                <span class="dvm-prop-meta">
                                  <span class="dvm-prop-range">{{
                                    decodeSegmentRangeLabel(
                                      seg,
                                      decodeVisualPayload.pduKind === 'bit' ? decodePduCoilBase : 0,
                                    )
                                  }}</span>
                                  <span v-if="seg.registerHint" class="dvm-prop-reg">{{ seg.registerHint }}</span>
                                </span>
                              </div>
                            </div>
                            <div v-if="decodeVisualPayload.warnings.length" class="dvm-warns">
                              <div v-for="(w, wi) in decodeVisualPayload.warnings" :key="'dw' + wi">{{ w }}</div>
                            </div>
                            <div v-if="decodeVisualPayload.unmappedProps.length" class="dvm-unmapped">
                              未参与对齐的属性：{{ decodeVisualPayload.unmappedProps.join(', ') }}
                            </div>
                          </div>
                        </template>
                        <template v-else>
                          <div
                            class="dvm-byte-strip dvm-byte-strip--plain"
                            :class="
                              decodePduStrip.fc === 1 || decodePduStrip.fc === 2
                                ? 'dvm-byte-strip--bit'
                                : 'dvm-byte-strip--word-plain'
                            "
                          >
                            <div
                              v-for="(b, bi) in decodePduStrip.data"
                              :key="'pdu-plain' + bi"
                              class="dvm-byte-cell"
                            >
                              <div class="dvm-byte-idx">D{{ bi }}</div>
                              <div class="dvm-byte-hex dvm-t-x">
                                {{ b.toString(16).padStart(2, '0').toUpperCase() }}
                              </div>
                              <div class="dvm-byte-bits dvm-byte-bits--plain">
                                <div
                                  v-for="slot in 8"
                                  :key="'bp' + bi + '-' + slot"
                                  :class="['dvm-bit', 'dvm-bit--plain', decodeBitValueClass(b, 8 - slot)]"
                                  :title="
                                    'B' +
                                    bi +
                                    ' · bit' +
                                    (8 - slot) +
                                    ' = ' +
                                    ((b >> (8 - slot)) & 1)
                                  "
                                />
                              </div>
                              <template v-if="decodePduStrip.fc === 1 || decodePduStrip.fc === 2">
                                <div class="dvm-bit-meta-row" aria-hidden="true">
                                  <span
                                    v-for="slot in 8"
                                    :key="'pidx' + bi + '-' + slot"
                                    class="dvm-bit-idx-lbl"
                                    >{{ 8 - slot }}</span
                                  >
                                </div>
                              </template>
                            </div>
                          </div>
                          <div
                            v-if="decodeResult?.success && decodeVisualPayload?.kind === 'fallback'"
                            class="decode-visual-fallback decode-visual-fallback--embedded"
                          >
                            <a-alert type="info" show-icon class="dvm-fallback-alert">
                              <template #message>{{ decodeVisualPayload.note || '属性列表' }}</template>
                              <template #description>
                                <div v-if="decodeVisualPayload.data.length" class="dvm-fallback-hex">
                                  {{ bytesToHexSpaced(decodeVisualPayload.data) }}
                                </div>
                                <div class="dvm-fallback-props">
                                  <div
                                    v-for="(val, key) in decodeVisualPayload.props"
                                    :key="String(key)"
                                    class="dvm-fallback-row"
                                  >
                                    <span class="dvm-fallback-k">{{ key }}</span>
                                    <span class="dvm-fallback-v">{{ formatDecodePropValue(val) }}</span>
                                  </div>
                                </div>
                              </template>
                            </a-alert>
                          </div>
                          <a-alert
                            v-if="decodeResult && !decodeResult.success"
                            type="error"
                            message="解码失败"
                            show-icon
                            class="mp-dvm-alert"
                            :description="decodeResult.reason"
                          />
                          <div v-if="!decodeResult" class="mp-pdu-fusion-foot">
                            在左侧粘贴原始数据后将自动解码；成功后将在此显示属性与位映射
                          </div>
                        </template>
                      </div>
                      <div
                        v-else-if="a.dataHexPreview && a.dataHexPreview !== '—'"
                        class="mp-hex-box"
                      >
                        {{ a.dataHexPreview }}
                      </div>
                      <div v-if="a.registerPreview?.length" class="mp-reg-chips">
                        <span v-for="r in a.registerPreview" :key="r.index" class="mp-chip"
                          >#{{ r.index }} {{ r.uint16 }}</span
                        >
                      </div>
                      <div v-if="a.coilBitsPreview" class="mp-coil-bits">{{ a.coilBitsPreview }}</div>
                    </template>
                    <div v-if="a.crcLine" class="mp-crc-line" :class="{ 'mp-crc-bad': a.crcOk === false }">
                      {{ a.crcLine }}
                    </div>
                    <div v-for="(w, wi) in a.warnings" :key="'w' + wi" class="mp-warn-tight">{{ w }}</div>
                    <div class="mp-fill-row">
                      <a-button type="primary" size="small" :disabled="!canFillToMapping" @click="openFillMappingModal">
                        填入映射表
                      </a-button>
                      <span class="mp-fill-hint">按解析结果新增映射行；弹窗内默认用 PLC 五位数，可改 FC 格式</span>
                    </div>
                    <details v-if="decodeResult?.success" class="decode-json-details decode-json-details--in-card">
                      <summary>原始 JSON 响应</summary>
                      <pre class="debug-output">{{ JSON.stringify(decodeResult.outputs, null, 2) }}</pre>
                    </details>
                  </template>
                </div>
                <div v-else class="decode-parse-empty">字节过少，无法识别为完整 Modbus 帧</div>
                <a-alert
                  v-if="decodeFrameAnalysis && decodeResult && !decodeResult.success && !decodePduStrip"
                  type="error"
                  message="解码失败"
                  show-icon
                  class="mp-dvm-alert mp-dvm-alert--standalone"
                  :description="decodeResult.reason"
                />
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="encode" tab="编码调试（平台 → 设备）">
          <div class="debug-body encode-debug-wrap">
            <div class="decode-debug-grid">
              <div class="decode-debug-col decode-debug-input">
                <div class="debug-label">消息类型</div>
                <a-radio-group
                  v-model:value="encodeDebugMode"
                  size="small"
                  button-style="solid"
                  style="margin-bottom: 8px"
                >
                  <a-radio-button value="write">写属性</a-radio-button>
                  <a-radio-button value="read">读属性</a-radio-button>
                </a-radio-group>

                <template v-if="encodeDebugMode === 'write'">
                  <div class="debug-label">模拟属性写入</div>
                  <div
                    v-for="(item, idx) in encodeInputs"
                    :key="idx"
                    class="encode-row"
                  >
                    <a-select
                      v-model:value="item.property"
                      placeholder="选择属性"
                      size="small"
                      style="width: 200px"
                      show-search
                      allow-clear
                      :options="encodePropertyOptions"
                    />
                    <span class="encode-eq">=</span>
                    <a-input
                      v-model:value="item.value"
                      placeholder="输入模拟值"
                      size="small"
                      style="width: 140px; font-family: monospace"
                    />
                    <a-button type="link" size="small" danger @click="removeEncodeInput(idx)">
                      <template #icon><CloseOutlined /></template>
                    </a-button>
                  </div>
                  <a-button size="small" @click="addEncodeInput" style="margin-top: 4px">
                    <template #icon><PlusOutlined /></template>
                    添加属性
                  </a-button>
                </template>

                <template v-else>
                  <div class="debug-label">要读取的属性</div>
                  <a-select
                    v-model:value="readEncodeProps"
                    mode="tags"
                    size="small"
                    style="width: 100%"
                    placeholder="选择或输入属性标识，回车添加多条"
                    show-search
                    :options="encodePropertyOptions"
                    :filter-option="filterEncodeReadPropOption"
                  />
                  <div class="encode-read-hint">按映射生成读线圈/离散输入/寄存器请求帧；同一批可能拆成多帧。</div>
                </template>

                <a-button
                  size="small"
                  type="primary"
                  :loading="encoding"
                  @click="runEncode"
                  style="margin-top: 10px"
                >
                  生成 Modbus 帧
                </a-button>

                <a-alert
                  v-if="encodeResult"
                  :type="encodeResult.success ? 'success' : 'error'"
                  :message="encodeResult.success ? '编码成功' : '编码失败'"
                  show-icon
                  style="font-size: 12px; margin-top: 10px"
                >
                  <template v-if="!encodeResult.success" #description>
                    <span>{{ encodeResult.reason }}</span>
                  </template>
                </a-alert>
              </div>

              <div class="decode-debug-col decode-debug-parse">
                <div class="debug-label">Modbus 报文结构</div>
                <div v-if="!encodeResult?.success || !encodeDebugSegments.length" class="decode-parse-empty">
                  在左侧点击「生成 Modbus 帧」成功后，此处展示十六进制与字段解析（与解码区相同风格；链路类型与表格上方一致：PDU / TCP /
                  RTU）。多帧时按协议顺序拆段解释。
                </div>
                <template v-else>
                  <div v-for="(seg, fi) in encodeDebugSegments" :key="'ep-' + fi" class="encode-parse-frame-block">
                    <div v-if="encodeDebugSegments.length > 1" class="encode-parse-frame-title">帧 {{ fi + 1 }}</div>
                    <div class="encode-full-hex">
                      <span class="encode-full-hex-lbl">{{ encodeDebugSegments.length > 1 ? '本段报文' : '完整报文' }}</span>
                      <code class="encode-full-hex-code" :title="seg.hex">{{ seg.hex }}</code>
                    </div>
                    <div v-if="seg.analysis" class="modbus-parse-card modbus-parse-compact">
                      <template v-for="a in [seg.analysis]" :key="'enc' + fi">
                        <div class="mp-compact-head">
                          <a-tag size="small" class="mp-tag-tight">{{ a.linkTypeLabel }}</a-tag>
                          <span class="mp-head-meta">单元 <b>{{ a.unitId }}</b> · {{ a.fcLabel }}</span>
                        </div>
                        <div v-if="a.tcpHeader" class="mp-compact-line mp-mono mp-fade" :title="a.tcpHeader">
                          {{ a.tcpHeader }}
                        </div>
                        <div v-if="a.isException" class="mp-compact-exc">{{ a.exceptionLabel }}</div>
                        <template v-else>
                          <div
                            v-if="a.requestStartAddr !== undefined || a.requestQuantity !== undefined"
                            class="mp-compact-kv"
                          >
                            <template v-if="a.requestStartAddr !== undefined">
                              <span class="mp-ck">起始地址</span><span class="mp-cv">{{ a.requestStartAddr }}</span>
                            </template>
                            <template v-if="a.requestQuantity !== undefined">
                              <span class="mp-ck">数量</span><span class="mp-cv">{{ a.requestQuantity }}</span>
                            </template>
                          </div>
                          <div v-if="a.byteCount !== undefined" class="mp-compact-kv">
                            <span class="mp-ck">数据字节</span><span class="mp-cv">{{ a.byteCount }}</span>
                            <template v-if="a.wordRegisterCount">
                              <span class="mp-ck">字数</span><span class="mp-cv">{{ a.wordRegisterCount }}</span>
                            </template>
                          </div>
                          <div v-if="a.dataHexPreview && a.dataHexPreview !== '—'" class="mp-hex-box">
                            {{ a.dataHexPreview }}
                          </div>
                          <div v-if="a.registerPreview?.length" class="mp-reg-chips">
                            <span v-for="r in a.registerPreview" :key="r.index" class="mp-chip"
                              >#{{ r.index }} {{ r.uint16 }}</span
                            >
                          </div>
                          <div v-if="a.coilBitsPreview" class="mp-coil-bits">{{ a.coilBitsPreview }}</div>
                        </template>
                        <div v-if="a.crcLine" class="mp-crc-line" :class="{ 'mp-crc-bad': a.crcOk === false }">
                          {{ a.crcLine }}
                        </div>
                        <div v-for="(w, wi) in a.warnings" :key="'ew' + fi + wi" class="mp-warn-tight">{{ w }}</div>
                      </template>
                    </div>
                    <div v-else class="decode-parse-empty decode-parse-err">无法按当前链路类型解析本段</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
      </aside>
    </div>

    <!-- ===== Config Drawer ===== -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="`配置详情${drawerForm.property ? ' · ' + (drawerForm.propertyName || drawerForm.property) : ''}`"
      placement="right"
      :width="480"
      destroy-on-close
    >
      <a-form :model="drawerForm" layout="vertical">
        <a-form-item label="属性标识">
          <div class="mm-prop-ac-wrap">
            <div
              v-show="
                !drawerPropertyFocused &&
                drawerForm.property &&
                getPropNameById(drawerForm.property)
              "
              class="mm-prop-ac-fake"
              aria-hidden="true"
            >
              <span class="mm-prop-ac-fake-name">{{ getPropNameById(drawerForm.property) }}</span>
              <span class="mm-prop-ac-fake-id">{{ drawerForm.property }}</span>
            </div>
            <a-auto-complete
              :value="drawerForm.property"
              :options="propertyOptions"
              :filter-option="filterPropertyACOption"
              allow-clear
              placeholder="输入或选择属性标识"
              class="mm-prop-ac"
              :class="{
                'mm-prop-ac--ghost':
                  !drawerPropertyFocused &&
                  !!drawerForm.property &&
                  !!getPropNameById(drawerForm.property),
              }"
              popup-class-name="mm-prop-select-dropdown"
              :dropdown-match-select-width="false"
              :list-item-height="34"
              @focus="drawerPropertyFocused = true"
              @blur="onDrawerPropertyInputBlur"
              @update:value="onDrawerPropertyAcUpdate"
            >
              <template #option="opt">
                <div class="mm-prop-opt">
                  <span class="mm-prop-opt-name">{{ opt.propName }}</span>
                  <span class="mm-prop-opt-id">{{ opt.propId }}</span>
                </div>
              </template>
            </a-auto-complete>
          </div>
          <div v-if="isPropertyNotInThingModel(drawerForm.property)" class="mm-prop-undef-hint">
            物模型未定义
          </div>
        </a-form-item>

        <a-form-item label="寄存器地址">
          <a-input
            v-model:value="drawerForm.registerStr"
            placeholder="如 40001  或  3_0  或  2:40001"
            @change="onDrawerRegisterChange"
          />
          <div class="drawer-reg-hint">
            <template
              v-for="hint in [drawerForm.registerStr ? getRegisterHintData(drawerForm.registerStr) : null]"
              :key="0"
            >
              <div v-if="hint" class="reg-hint">
                <div class="reg-hint-row1">
                  <span class="reg-zone-badge" :style="{ color: hint.color, background: hint.bg }">{{ hint.zonePrefix }}</span>
                  <span class="reg-zone-name">{{ hint.zoneName }}</span>
                  <template v-if="hint.inputFormat === 'plc'">
                    <span class="reg-addr-val">#{{ hint.stdAddr }}<template v-if="hint.stdAddrEnd"> ~ #{{ hint.stdAddrEnd }}</template></span>
                  </template>
                  <template v-else>
                    <span class="reg-fc-inline">{{ hint.fcCode }}</span>
                    <span class="reg-addr-val">addr {{ hint.modbusAddr }}<template v-if="hint.modbusAddrEnd !== undefined"> ~ {{ hint.modbusAddrEnd }}</template></span>
                  </template>
                  <span v-if="hint.slaveId" class="reg-slave">从站 {{ hint.slaveId }}</span>
                </div>
                <div class="reg-hint-row2">
                  <template v-if="hint.inputFormat === 'plc'">
                    <span class="reg-interp-label">Modbus</span>
                    <span class="reg-fc-badge">{{ hint.fcCode }}</span>
                    <span class="reg-meta-sep">·</span>
                    <span>addr {{ hint.modbusAddr }}<template v-if="hint.modbusAddrEnd !== undefined"> ~ {{ hint.modbusAddrEnd }}</template></span>
                  </template>
                  <template v-else>
                    <span class="reg-interp-label">PLC</span>
                    <span class="reg-addr-val-sm">#{{ hint.stdAddr }}<template v-if="hint.stdAddrEnd"> ~ #{{ hint.stdAddrEnd }}</template></span>
                  </template>
                  <span class="reg-meta-sep">·</span>
                  <template v-if="hint.addressing === 'bit'">
                    <span>{{ hint.count }} 位</span>
                    <span class="reg-meta-sep">·</span>
                    <span>报文数据区约 {{ hint.dataBytes }} 字节</span>
                    <span class="reg-meta-sep">·</span>
                    <span class="reg-micro">8 位/字节打包</span>
                  </template>
                  <template v-else>
                    <span>{{ hint.count }} 字</span>
                    <span class="reg-meta-sep">·</span>
                    <span>16 位/字</span>
                    <span class="reg-meta-sep">·</span>
                    <span>{{ hint.dataBytes }} 字节</span>
                  </template>
                  <template v-if="hint.bitIndex !== undefined">
                    <span class="reg-meta-sep">·</span>
                    <span>第 {{ hint.bitIndex }} 位</span>
                  </template>
                  <template v-if="hint.elementIndex !== undefined">
                    <span class="reg-meta-sep">·</span>
                    <span>元素[{{ hint.elementIndex }}]</span>
                  </template>
                </div>
                <div class="reg-hint-row3">
                  <span class="reg-hint-zone-explain">{{ hint.zoneExplain }}</span>
                </div>
              </div>
              <div v-else-if="drawerForm.registerStr" class="reg-hint-error">格式错误</div>
            </template>
          </div>
          <div class="form-help modbus-addr-guide">
            <div class="guide-title">PLC 五位数地址与报文地址（本页约定）</div>
            <ul class="guide-list">
              <li><b>0x 线圈</b> <code>00001</code> 起 — 读 <code>FC01</code>，写单线圈 <code>FC05</code>，写多线圈 <code>FC15</code>。<b>每地址 1 位</b>（不是 16 位寄存器）；读响应里状态按<b>字节打包，每字节 8 位</b>。</li>
              <li><b>1x 离散输入</b> <code>10001</code> 起 — 只读 <code>FC02</code>，寻址与打包规则同线圈。</li>
              <li><b>3x 输入寄存器</b> <code>30001</code> 起 — 只读 <code>FC04</code>。<b>每地址 1 字 = 16 位 = 2 字节</b>（Modbus 寄存器）。</li>
              <li><b>4x 保持寄存器</b> <code>40001</code> 起 — 读 <code>FC03</code>，写单寄存器 <code>FC06</code>，写多寄存器（功能码 <code>0x10</code>，常称 FC16），字内按位写可选用掩码写（功能码 <code>0x16</code>，FC22）。同样 <b>16 位/地址</b>。</li>
              <li><b>地址换算</b>：PLC 显示地址 = 区首 + Modbus 数据地址 + 1。例：<code>40001</code> → 4x 区首偏移 0 → 报文中起始地址为 <code>0</code>。</li>
              <li><b>范围写法</b>：<code>40001-40002</code> 表示 2 个<b>字</b>；<code>00001-00008</code> 表示 8 个<b>位</b>。<code>3_0-1</code> 与 <code>40001-40002</code> 等价。</li>
              <li><b>与部分 PLC 软件</b>：有的 HMI 以「字节」显示线圈区，与本处「Modbus 位地址」可能差系数，请以设备手册为准对照。</li>
            </ul>
            <div class="guide-foot">填写范围后，列表会按区类型筛选：线圈/离散单点选「单点布尔」，多点选「布尔数组」（默认与报文一致）；寄存器区按总位数匹配 16、32、64… 位及数组规则。</div>
          </div>
        </a-form-item>

        <a-form-item label="解析">
          <div class="mm-drawer-parse-wrap">
            <div class="mm-parse-inline-top mm-drawer-parse-inline">
              <span class="mm-drawer-inline-lbl">类型：</span>
              <a-select
                v-model:value="drawerForm.codec"
                allow-clear
                option-label-prop="label"
                class="mm-drawer-parse-type-sel"
                :placeholder="drawerForm.registerStr ? '根据范围选择解析类型' : '请先填写寄存器地址范围'"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
                @change="onDrawerCodecChange"
              >
                <template v-for="grp in getCodecOptionsForCount(drawerForm.registerStr)" :key="grp.label">
                  <a-select-opt-group :label="grp.label">
                    <a-select-option
                      v-for="opt in grp.options"
                      :key="opt.value"
                      :value="opt.value"
                      :label="shortCodecLabel(opt.value)"
                    >
                      <div class="mm-codec-opt">
                        <div class="mm-codec-opt-title">{{ shortCodecLabel(opt.value) }}</div>
                        <div class="mm-codec-opt-desc">{{ opt.desc }}</div>
                      </div>
                    </a-select-option>
                  </a-select-opt-group>
                </template>
              </a-select>
              <span class="mm-drawer-inline-lbl">布局：</span>
              <a-select
                v-if="getLayoutOptions(drawerForm.registerStr).length"
                v-model:value="drawerForm.layout"
                class="mm-drawer-parse-layout-sel"
                option-label-prop="label"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
              >
                <a-select-option
                  v-for="opt in getLayoutOptions(drawerForm.registerStr)"
                  :key="opt.value"
                  :value="opt.value"
                  :label="layoutShortLabel(opt.value)"
                >
                  <div class="mm-codec-opt">
                    <div class="mm-codec-opt-title">{{ opt.title }}</div>
                    <div class="mm-codec-opt-desc">{{ opt.desc }}</div>
                  </div>
                </a-select-option>
              </a-select>
              <a-input v-else disabled value="—" class="mm-drawer-layout-dash-input" />
            </div>
            <div v-if="doParseRegisterStr(drawerForm.registerStr)" class="form-help">
              {{ getCodecFilterHint(drawerForm.registerStr) }}
            </div>
            <div v-else-if="!drawerForm.registerStr" class="form-help">
              填写寄存器地址范围后，此处只显示与位宽匹配的解析类型
            </div>
            <div class="mm-drawer-sublabel-tip" style="margin-top: 4px">
              布局仅用于<strong>输入/保持寄存器</strong>多字节数据（如 AB、AB_CD）；线圈/离散由解析类型体现位序，此处不配置布局。
            </div>
            <template v-if="isNumericCodec(drawerForm.codec)">
              <a-row :gutter="12" class="mm-drawer-scale-row">
                <a-col :span="12">
                  <div class="mm-drawer-mini-lbl">缩放因子</div>
                  <a-input-number
                    v-model:value="drawerForm.scaleFactor"
                    string-mode
                    :precision="15"
                    :step="1e-12"
                    style="width: 100%"
                  />
                </a-col>
                <a-col :span="12">
                  <div class="mm-drawer-mini-lbl">小数位数</div>
                  <a-input-number
                    v-model:value="drawerForm.scale"
                    :min="-1"
                    :precision="0"
                    style="width: 100%"
                  />
                </a-col>
              </a-row>
              <div class="form-help" style="margin-top: 4px">
                物模型值 = 原始寄存器值 × 缩放因子，保留 N 位小数（-1 表示不处理）
              </div>
            </template>
          </div>
        </a-form-item>

        <a-divider style="margin: 12px 0">读写权限</a-divider>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="可读">
              <a-switch
                v-model:checked="drawerForm.readable"
                checked-children="是"
                un-checked-children="否"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="可写">
              <a-switch
                v-model:checked="drawerForm.writable"
                checked-children="是"
                un-checked-children="否"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>

      <template #footer>
        <a-space style="float: right">
          <a-button @click="drawerVisible = false">取消</a-button>
          <a-button type="primary" @click="confirmDrawer">确定</a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-modal
      v-model:open="fillModalOpen"
      title="将报文填入映射表"
      :ok-text="fillModalOkText"
      cancel-text="取消"
      :width="480"
      @ok="confirmFillMapping"
    >
      <p class="fill-modal-tip">
        粘贴的响应通常只有数据区，<b>起始地址</b>须与当时下发的读请求一致（例如读 PLC 地址 40001 时填起始 <b>0</b>）。
      </p>
      <a-form layout="vertical" class="fill-modal-form">
        <a-form-item label="映射地址格式">
          <a-radio-group v-model:value="fillAddressFormat" size="small" button-style="solid">
            <a-radio-button value="plc">PLC 五位数（40001）</a-radio-button>
            <a-radio-button value="fc">FC_偏移（3_0）</a-radio-button>
          </a-radio-group>
          <div class="form-help">默认与 PLC/HMI 手册一致；选 FC 便于对照功能码与偏移。</div>
        </a-form-item>
        <a-form-item label="起始地址（0 起算）">
          <a-input-number v-model:value="fillPduStart" :min="0" :max="65535" style="width: 100%" />
        </a-form-item>
        <template v-if="fillModalMultiWord">
          <a-alert type="info" show-icon class="fill-multi-reg-alert">
            <template #message>
              检测到 <b>{{ fillModalWordCount }}</b> 个保持/输入寄存器（字）
            </template>
            <template #description>
              可合并为<b>一条</b>范围映射，或<b>拆分为 {{ fillModalWordCount }} 条</b>映射（每字一行，便于分别绑定物模型属性）。
            </template>
          </a-alert>
          <a-form-item label="多寄存器处理方式" style="margin-bottom: 8px">
            <a-radio-group v-model:value="fillWordMergeMode" size="small">
              <a-radio value="merge">合并为一条（地址范围）</a-radio>
              <a-radio value="split">拆分为多条（每寄存器一行）</a-radio>
            </a-radio-group>
          </a-form-item>
        </template>
        <template v-if="fillModalCoilMode">
          <a-form-item label="结束位地址（含，与起始组成位范围）">
            <a-input-number v-model:value="fillCoilEndPdu" :min="0" :max="65535" style="width: 100%" />
            <div class="form-help">默认按数据长度推算；若实际读取位数较少请改小。</div>
          </a-form-item>
          <a-alert
            v-if="fillCoilMultiBit"
            type="info"
            show-icon
            class="fill-multi-reg-alert"
            message="含多个位地址"
            description="多位线圈/离散通常用一条「布尔数组」即可；若每个地址要单独绑定属性，可拆成多行，每行 1 位并选「单点布尔」。"
          />
        </template>
        <a-form-item label="将生成地址串">
          <template v-if="fillModalMultiWord && fillWordMergeMode === 'split'">
            <pre class="fill-preview mono fill-preview-multi">{{ fillSplitPreviewSample }}</pre>
            <div class="form-help">每行一条映射，默认按 16 位无符号整数解析</div>
          </template>
          <template v-else>
            <div class="fill-preview mono">{{ fillMappingPreviewStr || '—' }}</div>
          </template>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts" name="ModbusMapping">
import { computed, ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { message, Empty } from 'ant-design-vue';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  DownOutlined,
} from '@ant-design/icons-vue';
import { useInstanceStore } from '../../../../../store/instance';
import { deviceCode, saveDeviceCode, testCode, encodeTest } from '../../../../../api/instance';

const props = defineProps<{
  thingId?: string;
  productId?: string;
}>();

const instanceStore = useInstanceStore();

/** 映射表表体可视高度（px）：由容器 ResizeObserver 计算，撑满剩余页面，仅内容超出时出现纵向滚动条 */
const tableScrollEl = ref<HTMLElement | null>(null);
const tableBodyScrollY = ref(360);

/** 主区域：左侧编辑 / 右侧调试 宽度占比（%），可拖动分割条调整 */
const mmMainResizeRef = ref<HTMLElement | null>(null);
const MM_SPLIT_STORAGE_KEY = 'modbus-mapping-mm-split-pct';
const leftMainPercent = ref(62);

function loadMmSplitFromStorage() {
  try {
    const s = localStorage.getItem(MM_SPLIT_STORAGE_KEY);
    if (s) {
      const n = parseFloat(s);
      if (!Number.isNaN(n) && n >= 28 && n <= 82) leftMainPercent.value = n;
    }
  } catch {
    /* ignore */
  }
}

function persistMmSplit() {
  try {
    localStorage.setItem(MM_SPLIT_STORAGE_KEY, String(leftMainPercent.value));
  } catch {
    /* ignore */
  }
}

function onMmMainSplitterMouseDown() {
  const onMove = (ev: MouseEvent) => {
    const el = mmMainResizeRef.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((ev.clientX - r.left) / r.width) * 100;
    leftMainPercent.value = Math.min(82, Math.max(28, pct));
  };
  const onUp = () => {
    persistMmSplit();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

let tableScrollResizeObserver: ResizeObserver | null = null;

function measureTableBodyScrollY() {
  const el = tableScrollEl.value;
  if (!el || el.clientHeight < 48) return;
  const thead = el.querySelector('.ant-table-thead') as HTMLElement | null;
  const headH = thead ? Math.ceil(thead.getBoundingClientRect().height) : 39;
  const borderPad = 2;
  const h = Math.floor(el.clientHeight - headH - borderPad);
  tableBodyScrollY.value = Math.max(160, h);
}

// ==================== Interfaces ====================
interface ModbusSimpleMapping {
  property: string;
  propertyName?: string;
  propertyDataType?: string;
  registerStr: string;
  codec: string;
  layout: string;
  scaleFactor?: number;
  scale?: number;
  /**
   * 与后端 bitLength 对齐；仅从接口回显/保存时保留（例如历史多字位配置）。
   * 地址第三段为位索引；未配置时保存侧对单点默认 bitLength=1。
   */
  bitLength?: number;
  /** 保持寄存器按位写是否走掩码写（0x16），与后端 useMaskWrite 一致 */
  useMaskWrite?: boolean;
  readable?: boolean;
  writable?: boolean;
}

interface ParsedRegister {
  slaveId: number;
  address: number;
  type: string;
  typeName: string;
  bitIndex?: number;
  elementIndex?: number;
  count: number;
  inputFormat: 'plc' | 'fc'; // 用户输入的格式：PLC 5位地址 或 FC_addr 格式
}

interface EncodeInput {
  property: string;
  value: string;
}

interface RegHintData {
  zonePrefix: string;
  zoneName: string;
  fcCode: string;
  color: string;
  bg: string;
  stdAddr: string;       // PLC 5位地址（如 "40001"）
  stdAddrEnd?: string;   // PLC 5位结束地址（范围时）
  modbusAddr: number;    // Modbus PDU 0-based 数据地址
  modbusAddrEnd?: number; // Modbus 结束地址（范围时）
  count: number;
  /** bit：线圈/离散，每 Modbus 地址 1 位；word：保持/输入寄存器，每地址 16 位 */
  addressing: 'bit' | 'word';
  /** 位区：count 个位；字区：count×16 位 */
  totalBits: number;
  /** 位区：⌈count/8⌉（读线圈/离散响应数据区按字节打包）；字区：count×2 */
  dataBytes: number;
  /** 一行简短区说明（用于 hint 第 3 行） */
  zoneExplain: string;
  bitIndex?: number;
  elementIndex?: number;
  slaveId?: number;
  inputFormat: 'plc' | 'fc';
}

// 区号 / 颜色 / 名称 / 读功能码 / 寻址方式（与 Modbus 标准一致）
const ZONE_INFO: Record<
  string,
  {
    prefix: string;
    name: string;
    fc: string;
    fcWrite?: string;
    color: string;
    bg: string;
    addressing: 'bit' | 'word';
    zoneExplain: string;
  }
> = {
  Coils: {
    prefix: '0x',
    name: '线圈',
    fc: 'FC01',
    fcWrite: 'FC05/15',
    color: '#d46b08',
    bg: '#fff7e6',
    addressing: 'bit',
    zoneExplain: '位寻址：1 地址=1 位；读响应按字节打包（8 位/字节），非 16 位寄存器',
  },
  DiscreteInputs: {
    prefix: '1x',
    name: '离散输入',
    fc: 'FC02',
    color: '#531dab',
    bg: '#f9f0ff',
    addressing: 'bit',
    zoneExplain: '位寻址：只读，1 地址=1 位；报文打包同线圈',
  },
  HoldingRegisters: {
    prefix: '4x',
    name: '保持寄存器',
    fc: 'FC03',
    fcWrite: 'FC06/16/22',
    color: '#0958d9',
    bg: '#e6f4ff',
    addressing: 'word',
    zoneExplain: '字寻址：1 地址=1 字=16 位=2 字节（Modbus 寄存器）',
  },
  InputRegisters: {
    prefix: '3x',
    name: '输入寄存器',
    fc: 'FC04',
    color: '#389e0d',
    bg: '#f6ffed',
    addressing: 'word',
    zoneExplain: '字寻址：只读，1 地址=1 字=16 位=2 字节',
  },
};

// ==================== State ====================
/** 与后端 ModbusThingsMapping.modbusLinkType 一致 */
const modbusLinkType = ref<'PDU' | 'TCP' | 'RTU'>('PDU');

const mappings = ref<ModbusSimpleMapping[]>([]);
const loading = ref(false);
const saving = ref(false);

/** 属性列 AutoComplete 焦点行（用于收起态「名称 + id」叠层） */
const focusedPropertyIndex = ref<number | null>(null);
const drawerPropertyFocused = ref(false);

// Drawer
const drawerVisible = ref(false);
const drawerIndex = ref(-1);
const drawerForm = reactive<ModbusSimpleMapping & { propertyName?: string }>({
  property: '',
  propertyName: '',
  registerStr: '',
  codec: '',
  layout: '',
  scaleFactor: 1,
  scale: -1,
  useMaskWrite: false,
  readable: true,
  writable: true,
});

// Debug
const decodePayload = ref('');
/** 读响应 PDU 数据区：第 1 个数据位（各字节 bit0 起算）对应的线圈地址（0 基）。仅粘贴响应时若读从 0 起则为 0；若响应只含子区间请填该区间起始线圈地址。 */
const decodePduCoilBase = ref(0);
const decoding = ref(false);
const decodeResult = ref<any>(null);
/** 鼠标悬停在下方的映射属性行时，对应 PDU 字节/位高亮 */
const decodeHoverSegmentId = ref<string | null>(null);

watch(decodeResult, () => {
  decodeHoverSegmentId.value = null;
});

/** 解码区：按地址模拟读响应（PDU/TCP/RTU 与左侧链路类型一致；地址串与映射表规则相同） */
const decodeSimAddressStr = ref('');
const decodeSimBytes = ref<number[]>([]);
const decodeSimFcLabel = ref('');
const decodeSimError = ref('');

/** 解码区「填入映射表」弹窗 */
const fillModalOpen = ref(false);
const fillPduStart = ref(0);
const fillCoilEndPdu = ref(0);
/** 映射地址书写格式：默认 PLC 五位数，可选 FC_偏移 */
const fillAddressFormat = ref<'plc' | 'fc'>('plc');
/** FC03/04 多字时：合并一条范围 或 拆成每字一行 */
const fillWordMergeMode = ref<'merge' | 'split'>('merge');

const encodeInputs = ref<EncodeInput[]>([{ property: '', value: '' }]);
const encoding = ref(false);
const encodeResult = ref<any>(null);
/** 编码调试：写属性 / 读属性 */
const encodeDebugMode = ref<'write' | 'read'>('write');
/** 读属性编码：属性 id 列表（Select tags 可手输） */
const readEncodeProps = ref<string[]>([]);

// ==================== 调试区草稿 localStorage（按设备区分） ====================
const DEBUG_PERSIST_VERSION = 3 as const;

interface ModbusDebugPersistPayload {
  v: typeof DEBUG_PERSIST_VERSION;
  decodePayload: string;
  /** 模拟报文地址输入框 */
  decodeSimAddressStr?: string;
  /** PDU 数据区起始线圈地址（0 基） */
  decodePduCoilBase?: number;
  encodeInputs: EncodeInput[];
  encodeDebugMode?: 'write' | 'read';
  readEncodeProps?: string[];
}

function modbusDebugStorageKey(): string {
  const id = props.thingId || instanceStore.current?.id || 'default';
  return `jetlinks-ui:modbus-mapping-debug:v${DEBUG_PERSIST_VERSION}:${id}`;
}

let modbusDebugRestoring = false;
let modbusDebugPersistTimer: ReturnType<typeof setTimeout> | null = null;
let decodeSimDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function restoreModbusDebugDraft() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(modbusDebugStorageKey());
    if (!raw) return;
    const data = JSON.parse(raw) as ModbusDebugPersistPayload & { v?: number };
    if ((data.v !== 2 && data.v !== 3) || typeof data.decodePayload !== 'string') return;
    modbusDebugRestoring = true;
    decodePayload.value = data.decodePayload;
    decodeSimAddressStr.value =
      data.v === 3 && typeof data.decodeSimAddressStr === 'string' ? data.decodeSimAddressStr : '';
    decodePduCoilBase.value =
      typeof data.decodePduCoilBase === 'number' && !Number.isNaN(data.decodePduCoilBase)
        ? Math.max(0, Math.min(65535, Math.floor(data.decodePduCoilBase)))
        : 0;
    if (Array.isArray(data.encodeInputs) && data.encodeInputs.length > 0) {
      encodeInputs.value = data.encodeInputs.map((row) => ({
        property: typeof row?.property === 'string' ? row.property : '',
        value: typeof row?.value === 'string' ? row.value : '',
      }));
    } else {
      encodeInputs.value = [{ property: '', value: '' }];
    }
    encodeDebugMode.value =
      data.encodeDebugMode === 'read' || data.encodeDebugMode === 'write' ? data.encodeDebugMode : 'write';
    readEncodeProps.value = Array.isArray(data.readEncodeProps)
      ? data.readEncodeProps.filter((x) => typeof x === 'string' && x.trim())
      : [];
    nextTick(() => {
      modbusDebugRestoring = false;
      regenerateDecodeSimFrame();
    });
  } catch {
    modbusDebugRestoring = false;
  }
}

function persistModbusDebugDraft() {
  if (typeof localStorage === 'undefined' || modbusDebugRestoring) return;
  try {
    const payload: ModbusDebugPersistPayload = {
      v: DEBUG_PERSIST_VERSION,
      decodePayload: decodePayload.value,
      decodeSimAddressStr: decodeSimAddressStr.value,
      decodePduCoilBase: decodePduCoilBase.value,
      encodeInputs: encodeInputs.value.map((r) => ({
        property: r.property ?? '',
        value: r.value ?? '',
      })),
      encodeDebugMode: encodeDebugMode.value,
      readEncodeProps: [...readEncodeProps.value],
    };
    localStorage.setItem(modbusDebugStorageKey(), JSON.stringify(payload));
  } catch {
    /* 配额或其它限制 */
  }
}

function schedulePersistModbusDebugDraft() {
  if (modbusDebugRestoring) return;
  if (modbusDebugPersistTimer) clearTimeout(modbusDebugPersistTimer);
  modbusDebugPersistTimer = setTimeout(() => {
    modbusDebugPersistTimer = null;
    persistModbusDebugDraft();
  }, 400);
}

watch(decodePayload, schedulePersistModbusDebugDraft);
watch(decodePduCoilBase, schedulePersistModbusDebugDraft);
watch(decodeSimAddressStr, () => {
  schedulePersistModbusDebugDraft();
  if (modbusDebugRestoring) return;
  if (decodeSimDebounceTimer) clearTimeout(decodeSimDebounceTimer);
  decodeSimDebounceTimer = setTimeout(() => {
    decodeSimDebounceTimer = null;
    regenerateDecodeSimFrame();
  }, 380);
});
watch(encodeInputs, schedulePersistModbusDebugDraft, { deep: true });
watch(encodeDebugMode, schedulePersistModbusDebugDraft);
watch(readEncodeProps, schedulePersistModbusDebugDraft, { deep: true });

// ==================== Static Options ====================
/**
 * 与 jetlinks-core {@code org.jetlinks.core.codec.Codecs} 静态注册的 Codec#getId() 一致。
 * title：选中框展示；desc：下拉第二行说明；bits：标量类型与映射总位宽（寄存器数×16）精确匹配；
 * registerBitsAligned：数据字节非整字对齐时，按占用寄存器总位宽匹配（如 7 字节 BCD 对应 4 寄存器=64 位）；
 * arrayElementBits：数组元素位宽，总位宽须为其整数倍且 ≥ 元素位宽。
 */
interface CodecSelectOption {
  value: string;
  title: string;
  desc: string;
  /** 标量：与映射总位宽（寄存器数×16）精确匹配 */
  bits?: number;
  /**
   * 标量：按完整寄存器位宽匹配（与 bits 二选一参与过滤）。
   * 例：bcd_date_time_7 为 7 字节数据，Modbus 常读 4 寄存器（64 位）。
   */
  registerBitsAligned?: number;
  /** 数组：总位宽为元素位宽的整数倍且 ≥ 元素位宽 */
  arrayElementBits?: number;
}

const codecGroupOptions: Array<{ label: string; options: CodecSelectOption[] }> = [
  {
    label: '整数与布尔',
    options: [
      {
        value: 'bool',
        title: 'bool',
        desc: '单字节布尔。多用于自定义报文；标准 Modbus 字寄存器通常为 16 位对齐。',
        bits: 8,
      },
      {
        value: 'int8',
        title: 'int8',
        desc: '8 位有符号整数，1 字节。适合紧凑字节流；单寄存器读响应中常与 16 位对齐配合使用。',
        bits: 8,
      },
      {
        value: 'int16',
        title: 'int16',
        desc: '16 位有符号整数，1 个寄存器（2 字节）。',
        bits: 16,
      },
      {
        value: 'unsigned_int16',
        title: 'unsigned_int16',
        desc: '16 位无符号整数，1 个寄存器。计数、档位、状态码、枚举等最常用。',
        bits: 16,
      },
      {
        value: 'unsigned_int32',
        title: 'unsigned_int32',
        desc: '32 位无符号整数，2 个连续寄存器。',
        bits: 32,
      },
      {
        value: 'int32',
        title: 'int32',
        desc: '32 位有符号整数，2 个连续寄存器。',
        bits: 32,
      },
      {
        value: 'int64',
        title: 'int64',
        desc: '64 位有符号整数，4 个连续寄存器。',
        bits: 64,
      },
    ],
  },
  {
    label: 'IEEE754 浮点',
    options: [
      {
        value: 'ieee754_float32',
        title: 'ieee754_float32',
        desc: 'IEEE754 单精度，4 字节（2 个寄存器）。模拟量、工程浮点常用。',
        bits: 32,
      },
      {
        value: 'ieee754_float64',
        title: 'ieee754_float64',
        desc: 'IEEE754 双精度，8 字节（4 个寄存器）。高精度测量、累计量等。',
        bits: 64,
      },
    ],
  },
  {
    label: '定点与小数缩放',
    options: [
      {
        value: 'Q1_15',
        title: 'Q1_15',
        desc: 'Q1.15 定点，2 字节。1 符号位 + 15 小数，约 -1～1 归一化量。',
        bits: 16,
      },
      {
        value: 'Q1_31',
        title: 'Q1_31',
        desc: 'Q1.31 定点，4 字节。高精度归一化小数。',
        bits: 32,
      },
      {
        value: 'Q7_9',
        title: 'Q7_9',
        desc: 'Q7.9 定点，2 字节。7 位整数 + 9 位小数，范围约 -64～64。',
        bits: 16,
      },
      {
        value: 'Q8_8',
        title: 'Q8_8',
        desc: 'Q8.8 定点，2 字节。嵌入式常见 8 位整数 + 8 位小数。',
        bits: 16,
      },
      {
        value: 'Q15_1',
        title: 'Q15_1',
        desc: 'Q15.1 定点，2 字节。15 位整数 + 1 位半整数，范围约 ±16K。',
        bits: 16,
      },
      {
        value: 'Q31_1',
        title: 'Q31_1',
        desc: 'Q31.1 定点，4 字节。大范围半整数定点。',
        bits: 32,
      },
      {
        value: 'fix_scaled_10',
        title: 'fix_scaled_10',
        desc: '2 字节按 1/10 缩放解析为浮点。常见于「整数存一位小数」的仪表。',
        bits: 16,
      },
    ],
  },
  {
    label: 'BCD 数值',
    options: [
      {
        value: 'bcd_8',
        title: 'bcd_8',
        desc: '1 字节 Packed BCD（如 0x12 → 12）。',
        bits: 8,
      },
      {
        value: 'bcd_16',
        title: 'bcd_16',
        desc: '2 字节 Packed BCD（如 0x1234 → 1234）。',
        bits: 16,
      },
      {
        value: 'bcd_32',
        title: 'bcd_32',
        desc: '4 字节 Packed BCD 大整数显示值。',
        bits: 32,
      },
      {
        value: 'bcd_48',
        title: 'bcd_48',
        desc: '6 字节 Packed BCD 长整型（如电力仪表地址 12 位十进制），3 个寄存器。',
        bits: 48,
      },
      {
        value: 'unpacked_bcd_16',
        title: 'unpacked_bcd_16',
        desc: '2 字节 Unpacked BCD，每字节一位十进制数字。',
        bits: 16,
      },
      {
        value: 'unpacked_bcd_32',
        title: 'unpacked_bcd_32',
        desc: '4 字节 Unpacked BCD。',
        bits: 32,
      },
    ],
  },
  {
    label: 'BCD 日期时间',
    options: [
      {
        value: 'bcd_date_time_6',
        title: 'bcd_date_time_6',
        desc: '6 字节 BCD 日期时间（YYMMDDHHmmss），3 个寄存器。',
        bits: 48,
      },
      {
        value: 'bcd_date_time_7',
        title: 'bcd_date_time_7',
        desc: '7 字节 BCD 日期时间（含星期等）。读 4 寄存器（8 字节）时取缓冲区前 7 字节解析。',
        registerBitsAligned: 64,
      },
      {
        value: 'bcd_date_time_8',
        title: 'bcd_date_time_8',
        desc: '8 字节 BCD 日期时间（年 + 月日 + 时分 + 秒），4 个寄存器对齐。',
        bits: 64,
      },
      {
        value: 'bcd_date_4',
        title: 'bcd_date_4',
        desc: '4 字节 BCD 日期（YYYYMMDD），2 个寄存器。',
        bits: 32,
      },
      {
        value: 'bcd_date_time_12',
        title: 'bcd_date_time_12',
        desc: '12 字节 BCD 日期时间（年月日时分秒各 2 字节），6 个寄存器。',
        bits: 96,
      },
    ],
  },
  {
    label: '数组（元素重复排列）',
    options: [
      { value: 'bool_array', title: 'bool_array', desc: '布尔数组，元素 1 字节。', arrayElementBits: 8 },
      { value: 'int8_array', title: 'int8_array', desc: 'int8 数组，元素 8 位。', arrayElementBits: 8 },
      { value: 'int16_array', title: 'int16_array', desc: 'int16 数组，元素 16 位。', arrayElementBits: 16 },
      {
        value: 'unsigned_int16_array',
        title: 'unsigned_int16_array',
        desc: '无符号 16 位整数数组，适合多通道同类型采样。',
        arrayElementBits: 16,
      },
      {
        value: 'unsigned_int32_array',
        title: 'unsigned_int32_array',
        desc: '无符号 32 位整数数组。',
        arrayElementBits: 32,
      },
      { value: 'int32_array', title: 'int32_array', desc: 'int32 数组。', arrayElementBits: 32 },
      { value: 'int64_array', title: 'int64_array', desc: 'int64 数组。', arrayElementBits: 64 },
      {
        value: 'ieee754_float32_array',
        title: 'ieee754_float32_array',
        desc: '单精度浮点数组。',
        arrayElementBits: 32,
      },
      {
        value: 'ieee754_float64_array',
        title: 'ieee754_float64_array',
        desc: '双精度浮点数组。',
        arrayElementBits: 64,
      },
      { value: 'Q1_15_array', title: 'Q1_15_array', desc: 'Q1.15 定点数组。', arrayElementBits: 16 },
      { value: 'Q1_31_array', title: 'Q1_31_array', desc: 'Q1.31 定点数组。', arrayElementBits: 32 },
      { value: 'Q7_9_array', title: 'Q7_9_array', desc: 'Q7.9 定点数组。', arrayElementBits: 16 },
      { value: 'Q8_8_array', title: 'Q8_8_array', desc: 'Q8.8 定点数组。', arrayElementBits: 16 },
      { value: 'Q15_1_array', title: 'Q15_1_array', desc: 'Q15.1 定点数组。', arrayElementBits: 16 },
      { value: 'Q31_1_array', title: 'Q31_1_array', desc: 'Q31.1 定点数组。', arrayElementBits: 32 },
      {
        value: 'fix_scaled_10_array',
        title: 'fix_scaled_10_array',
        desc: 'fix_scaled_10 数组。',
        arrayElementBits: 16,
      },
      { value: 'bcd_8_array', title: 'bcd_8_array', desc: 'bcd_8 数组。', arrayElementBits: 8 },
      { value: 'bcd_16_array', title: 'bcd_16_array', desc: 'bcd_16 数组。', arrayElementBits: 16 },
      { value: 'bcd_32_array', title: 'bcd_32_array', desc: 'bcd_32 数组。', arrayElementBits: 32 },
      { value: 'bcd_48_array', title: 'bcd_48_array', desc: 'bcd_48 数组。', arrayElementBits: 48 },
      {
        value: 'bcd_date_4_array',
        title: 'bcd_date_4_array',
        desc: 'bcd_date_4 数组（LocalDate 序列）。',
        arrayElementBits: 32,
      },
      {
        value: 'unpacked_bcd_16_array',
        title: 'unpacked_bcd_16_array',
        desc: 'unpacked_bcd_16 数组。',
        arrayElementBits: 16,
      },
      {
        value: 'unpacked_bcd_32_array',
        title: 'unpacked_bcd_32_array',
        desc: 'unpacked_bcd_32 数组。',
        arrayElementBits: 32,
      },
    ],
  },
  {
    label: '位与线圈',
    options: [
      {
        value: 'lsb_bit_array',
        title: 'lsb_bit_array',
        desc: '多个开关量组成布尔数组；顺序与报文一致，一般选此项。',
      },
      {
        value: 'bit_array',
        title: 'bit_array',
        desc: '布尔数组按「高位在先」展开；用于兼容旧配置或设备文档中的高位在先约定。',
      },
    ],
  },
];

/**
 * 历史 UI / 配置里曾使用的 PascalCase 等与 jetlinks-core Codec#getId()（snake_case）对照。
 * 加载配置时归一化，避免已存数据在下拉中显示为空。
 */
const LEGACY_CODEC_MAP: Record<string, string> = {
  BIT_ARRAY: 'bit_array',
  BitArray: 'bit_array',
  LSB_BIT_ARRAY: 'lsb_bit_array',
  LsbBitArray: 'lsb_bit_array',
  UnsignedInt16: 'unsigned_int16',
  UnsignedInt32: 'unsigned_int32',
  Int8: 'int8',
  Int16: 'int16',
  Int32: 'int32',
  Int64: 'int64',
  Bool: 'bool',
  Ieee754Float32: 'ieee754_float32',
  Ieee754Float64: 'ieee754_float64',
};

function normalizeCodecId(id: string | undefined | null): string {
  if (id == null || id === '') return '';
  return LEGACY_CODEC_MAP[id] ?? id;
}

/**
 * 解析类型下拉收起态与列表主行：尽量用可读简称（如 uint16）；布尔相关用语义化中文。
 */
function shortCodecLabel(codecId: string | undefined | null): string {
  if (codecId == null || codecId === '') return '';
  let id = normalizeCodecId(String(codecId));
  if (id === 'bool') return '单点布尔';
  if (id === 'lsb_bit_array') return '布尔数组';
  if (id === 'bit_array') return '布尔数组·高位优先';
  if (id.endsWith('_array')) {
    const inner = id.slice(0, -'_array'.length);
    return `${shortCodecLabel(inner)}[]`;
  }
  if (id.startsWith('unsigned_int')) {
    return `uint${id.slice('unsigned_int'.length)}`;
  }
  if (id === 'ieee754_float32') return 'float32';
  if (id === 'ieee754_float64') return 'float64';
  return id;
}

const columns = [
  { title: '属性', key: 'property', width: 160 },
  { title: '寄存器地址', key: 'register', width: 280 },
  { title: '解析', key: 'codecLayout', width: 360 },
  { title: '操作', key: 'action', width: 132, fixed: 'right' },
];

// ==================== Computed ====================
/** 物模型属性（与设备运行态属性页 expands.type 语义一致） */
interface ThingMetadataProperty {
  id: string;
  name: string;
  description?: string;
  expands?: { type?: string[] };
  valueType?: { type: string };
}

const metadataProperties = computed(() => {
  const meta = instanceStore.current?.metadata;
  if (!meta) return [];
  try {
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
    return (parsed.properties || []) as ThingMetadataProperty[];
  } catch {
    return [];
  }
});

/** 与 ModbusRegisterType：离散/输入寄存器无写功能码；四类均有读功能码 */
function modbusZoneSupportsWrite(modbusType: string | undefined): boolean {
  if (!modbusType) return true;
  return modbusType === 'Coils' || modbusType === 'HoldingRegisters';
}

function modbusZoneSupportsRead(modbusType: string | undefined): boolean {
  if (!modbusType) return true;
  return (
    modbusType === 'Coils' ||
    modbusType === 'DiscreteInputs' ||
    modbusType === 'HoldingRegisters' ||
    modbusType === 'InputRegisters'
  );
}

interface PropertyUiMeta {
  description?: string;
  thingRead: boolean;
  thingWrite: boolean;
  conflictRead: boolean;
  conflictWrite: boolean;
}

/**
 * 属性列附加展示：物模型说明、读写标签；与当前寄存器区功能码冲突时标红 + 提示。
 * expands.type：read / write / report（上报视为可读语义，与运行态属性页一致）
 */
function getPropertyUiMeta(record: ModbusSimpleMapping): PropertyUiMeta | null {
  if (!record.property) return null;
  const meta = metadataProperties.value.find((p) => p.id === record.property);
  if (!meta) return null;

  const parsed = doParseRegisterStr(record.registerStr);
  const zone = parsed?.type;

  const types = meta.expands?.type;
  let thingRead = true;
  let thingWrite = true;
  if (types && types.length > 0) {
    thingRead = types.includes('read') || types.includes('report');
    thingWrite = types.includes('write');
  }

  return {
    description: meta.description?.trim() || undefined,
    thingRead,
    thingWrite,
    conflictRead: thingRead && !modbusZoneSupportsRead(zone),
    conflictWrite: thingWrite && !modbusZoneSupportsWrite(zone),
  };
}

/** 物模型属性下拉候选项（AutoComplete 仍可输入任意字符串，不必在列表中） */
const propertyOptions = computed(() =>
  metadataProperties.value.map((p) => ({
    value: p.id,
    searchText: `${p.name} ${p.id}`.toLowerCase(),
    propName: p.name,
    propId: p.id,
    label: p.name,
    dataType: p.valueType?.type,
  }))
);

/** 物模型中已定义属性 id → 名称（用于输入框收起态展示） */
function getPropNameById(propertyId: string | undefined): string | undefined {
  if (!propertyId || !String(propertyId).trim()) return undefined;
  const p = metadataProperties.value.find((x) => x.id === propertyId);
  const n = p?.name?.trim();
  return n || undefined;
}

function onPropertyInputBlur() {
  window.setTimeout(() => {
    focusedPropertyIndex.value = null;
  }, 120);
}

function onDrawerPropertyInputBlur() {
  window.setTimeout(() => {
    drawerPropertyFocused.value = false;
  }, 120);
}

/** 有内容且物模型中不存在该属性 id */
function isPropertyNotInThingModel(propertyId: string | undefined): boolean {
  if (!propertyId || !String(propertyId).trim()) return false;
  return !metadataProperties.value.some((p) => p.id === propertyId);
}

function filterPropertyACOption(input: string, option: any) {
  const t = (input || '').toLowerCase().trim();
  if (!t) return true;
  const st =
    option?.searchText ??
    `${option?.propName ?? ''} ${option?.value ?? ''}`.toLowerCase();
  return String(st).includes(t);
}

/** AutoComplete 同步到行数据并刷新 propertyName（任意字符串均可保留） */
function onPropertyAcUpdate(v: string | number | undefined | null, record: ModbusSimpleMapping) {
  const s = v != null && v !== '' ? String(v) : '';
  record.property = s;
  onPropertyChange(s, record);
}

function onDrawerPropertyAcUpdate(v: string | number | undefined | null) {
  const s = v != null && v !== '' ? String(v) : '';
  drawerForm.property = s;
  onDrawerPropertyChange(s);
}

const encodePropertyOptions = computed(() =>
  mappings.value
    .filter((m) => m.property)
    .map((m) => ({
      value: m.property,
      label: m.propertyName ? `${m.propertyName}（${m.property}）` : m.property,
    }))
);

function filterEncodeReadPropOption(input: string, option: { label?: string; value?: string }) {
  const q = (input || '').trim().toLowerCase();
  if (!q) return true;
  const label = String(option?.label ?? '').toLowerCase();
  const value = String(option?.value ?? '').toLowerCase();
  return label.includes(q) || value.includes(q);
}

/** a-input-number（含 stringMode）可能为 number | string，统一为有限数字供保存与后端 JSON */
function toFiniteNumberOr(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// 与后端 ModbusThingsMapping 一致：仅 thingId + properties（寄存器定义内嵌在每条 property.register）
const configObject = computed(() => {
  if (!mappings.value.length) return null;

  const regMap = new Map<string, any>();

  mappings.value.forEach((m) => {
    const parsed = doParseRegisterStr(m.registerStr);
    if (parsed) {
      const key = `${parsed.slaveId}_${parsed.type}_${parsed.address}`;
      const existing = regMap.get(key);

      const zi = ZONE_INFO[parsed.type];
      const isWordBitSlice = zi?.addressing === 'word' && parsed.bitIndex !== undefined;
      const layoutWc = layoutWordCountForSave(parsed);
      // 字内按位：不配置布局 UI，保存时固定单字大端 AB（与 JetLinks 字内取位一致）
      const layout = isWordBitSlice
        ? 'AB'
        : layoutLogicalToBackend(normalizeLayoutToLogical(m.layout, layoutWc), layoutWc);

      if (!existing || parsed.count > (existing.registerCount || 0)) {
        const sfFallback = existing ? existing.scaleFactor : 1;
        const scFallback = existing ? existing.scale : -1;
        regMap.set(key, {
          key: {
            slaveId: parsed.slaveId,
            address: parsed.address,
            type: parsed.type,
          },
          registerCount: Math.max(parsed.count, existing ? existing.registerCount : 0),
          codec: normalizeCodecId(m.codec || (existing ? existing.codec : '')),
          layout,
          scaleFactor: toFiniteNumberOr(m.scaleFactor, sfFallback),
          scale: Math.round(toFiniteNumberOr(m.scale, scFallback)),
        });
      }
    }
  });

  const propList: any[] = [];

  mappings.value.forEach((m) => {
    const parsed = doParseRegisterStr(m.registerStr);
    if (parsed) {
      const key = `${parsed.slaveId}_${parsed.type}_${parsed.address}`;
      const reg = regMap.get(key);
      const bitLen =
        parsed.bitIndex !== undefined
          ? typeof m.bitLength === 'number' && m.bitLength > 0
            ? Math.min(16, Math.floor(m.bitLength))
            : 1
          : null;
      const row: Record<string, unknown> = {
        property: m.property,
        register: reg,
        elementIndex: parsed.elementIndex ?? null,
        bitIndex: parsed.bitIndex ?? null,
        bitLength: bitLen,
        readable: m.readable ?? true,
        writable: m.writable ?? true,
      };
      if (parsed.type === 'HoldingRegisters' && parsed.bitIndex !== undefined && m.useMaskWrite === true) {
        row.useMaskWrite = true;
      }
      propList.push(row);
    }
  });

  return {
    thingId: props.thingId || instanceStore.current?.id,
    modbusLinkType: modbusLinkType.value,
    properties: propList,
  };
});

// ==================== Register Parsing (preserved from original) ====================

/**
 * 返回寄存器类型的完整工业名称（用于 ParsedRegister.typeName 存储）
 */
const getTypeName = (type: string) => {
  const names: Record<string, string> = {
    Coils: '线圈 Coil',
    DiscreteInputs: '离散输入 DI',
    HoldingRegisters: '保持寄存器 HR',
    InputRegisters: '输入寄存器 IR',
  };
  return names[type] || type;
};

/**
 * 根据寄存器类型和偏移地址，返回标准 5 位 Modbus 地址
 * HoldingRegisters: 4x → 40001+addr, InputRegisters: 3x → 30001+addr
 * Coils: 0x → 00001+addr, DiscreteInputs: 1x → 10001+addr
 */
const getStandardAddress = (type: string, address: number): string => {
  const base: Record<string, number> = {
    Coils: 1,
    DiscreteInputs: 10001,
    HoldingRegisters: 40001,
    InputRegisters: 30001,
  };
  return String((base[type] ?? 0) + address).padStart(5, '0');
};

/**
 * 返回寄存器类型的简短工业标签（含功能码），用于 hint 展示
 */
const getTypeLabel = (type: string): string => {
  // 格式: 区号(地址前缀) 名称 [功能码]
  // FC03 读取 4x 区（保持寄存器 40001+），FC04 读取 3x 区（输入寄存器 30001+）
  const labels: Record<string, string> = {
    Coils:            '0x 线圈 [FC01]',
    DiscreteInputs:   '1x 离散输入 [FC02]',
    HoldingRegisters: '4x 保持寄存器 [FC03]',
    InputRegisters:   '3x 输入寄存器 [FC04]',
  };
  return labels[type] || type;
};

/**
 * 解析单个5位标准地址 → { type, address }
 * 供 doParseRegisterStr 内部复用
 */
const parseStd5Digit = (val: number): { type: string; address: number } | null => {
  if (isNaN(val)) return null;
  if (val >= 400001) return { type: 'HoldingRegisters', address: val - 400001 };
  if (val >= 300001) return { type: 'InputRegisters',   address: val - 300001 };
  if (val >= 100001) return { type: 'DiscreteInputs',   address: val - 100001 };
  if (val >= 40001)  return { type: 'HoldingRegisters', address: val - 40001  };
  if (val >= 30001)  return { type: 'InputRegisters',   address: val - 30001  };
  if (val >= 10001)  return { type: 'DiscreteInputs',   address: val - 10001  };
  if (val >= 1 && val <= 9999) return { type: 'Coils', address: val - 1 };
  return null;
};

/**
 * 解析寄存器地址字符串。
 * 寄存器数量由地址范围决定，而非 codec。
 *
 * 支持的格式：
 *   40001          单个5位地址（1个寄存器）
 *   40001-40002    5位地址范围（2个寄存器）
 *   3_0            FC格式单地址（FC03 地址0，1个寄存器）
 *   3_0-2          FC格式范围（FC03 地址0～2，共3个寄存器）
 *   3_0_7          FC格式 + 位索引（字区内 bool 读单寄存器第7位）
 *   2:40001-40002  从站2 + 标准地址范围
 *   3_0@5          FC格式 + 数组元素下标
 *   40001*2        旧格式（仍兼容，但推荐改用范围写法）
 */
const doParseRegisterStr = (str: string): ParsedRegister | null => {
  if (!str) return null;

  let slaveId = 1;
  let s = str.trim();
  let count = 1;
  let bitIndex: number | undefined;
  let elementIndex: number | undefined;

  // 1. 兼容旧格式 *n（解析后由范围覆盖，*n 仍可作为 fallback）
  let legacyCount: number | undefined;
  if (s.includes('*')) {
    const starIdx = s.indexOf('*');
    const c = parseInt(s.slice(starIdx + 1));
    if (!isNaN(c) && c > 0) legacyCount = c;
    s = s.slice(0, starIdx).trim();
  }

  // 2. 从站 ID 前缀："2:..."
  if (s.includes(':')) {
    const colonIdx = s.indexOf(':');
    slaveId = parseInt(s.slice(0, colonIdx));
    s = s.slice(colonIdx + 1).trim();
  }

  // 3. 元素下标后缀："...@5"
  if (s.includes('@')) {
    const atIdx = s.lastIndexOf('@');
    elementIndex = parseInt(s.slice(atIdx + 1));
    s = s.slice(0, atIdx).trim();
  }

  let type: string | null = null;
  let address = -1;

  const FC_MAP: Record<number, string> = {
    1: 'Coils', 2: 'DiscreteInputs',
    3: 'HoldingRegisters', 4: 'InputRegisters',
  };

  // 判断输入格式：含 _ 为 FC 格式，否则为 PLC 5位地址格式
  const inputFormat: 'plc' | 'fc' = s.includes('_') ? 'fc' : 'plc';

  if (s.includes('_')) {
    // ── FC 格式：fc_addr[-endAddr][_bitIndex] ──
    const underParts = s.split('_');
    const code = parseInt(underParts[0]);
    type = FC_MAP[code] || null;
    const addrPart = underParts[1] ?? '';

    if (addrPart.includes('-')) {
      // 范围："0-2" → 地址0起，共3个寄存器
      const dashIdx = addrPart.indexOf('-');
      address = parseInt(addrPart.slice(0, dashIdx));
      const endAddr = parseInt(addrPart.slice(dashIdx + 1));
      if (!isNaN(endAddr) && endAddr >= address) count = endAddr - address + 1;
    } else {
      address = parseInt(addrPart);
      // 第三段为位索引（仅单寄存器时有效）
      if (underParts.length >= 3) {
        bitIndex = parseInt(underParts[2]);
        count = 1;
      }
    }
  } else {
    // ── 标准5位地址格式 ──
    if (s.includes('-')) {
      const dashIdx = s.indexOf('-');
      const startP = parseStd5Digit(parseInt(s.slice(0, dashIdx).trim()));
      const endP   = parseStd5Digit(parseInt(s.slice(dashIdx + 1).trim()));
      if (startP && endP && startP.type === endP.type) {
        type    = startP.type;
        address = startP.address;
        count   = endP.address - startP.address + 1;
      }
    } else {
      const p = parseStd5Digit(parseInt(s));
      if (p) { type = p.type; address = p.address; }
    }
  }

  // 旧格式 *n 兜底（当范围未能解析出 count 时使用）
  if (legacyCount !== undefined && count === 1) count = legacyCount;

  if (isNaN(slaveId) || address < 0 || !type || count < 1) return null;
  return { slaveId, address, type, typeName: getTypeName(type), bitIndex, elementIndex, count, inputFormat };
};

/** 保持寄存器 + 字内位下标（如 3_0_1）：表格内可开关掩码写 */
function isHoldingWordBitSlice(registerStr: string): boolean {
  const p = doParseRegisterStr(registerStr);
  return !!(p && p.type === 'HoldingRegisters' && p.bitIndex !== undefined);
}

/**
 * 根据地址串解析出的区类型与宽度过滤 codec。
 * 0x/1x 为按位寻址，与保持/输入寄存器（16 位/字）不同，不可混用「字」类解析器。
 */
const getCodecOptionsForCount = (registerStr: string) => {
  const res = doParseRegisterStr(registerStr);
  if (!res) return codecGroupOptions;

  const zone = ZONE_INFO[res.type];
  if (!zone) return codecGroupOptions;

  // 输入/保持寄存器 + 字内位下标（如 3_0_1）：仅解析 1 位 → 仅 bool，与线圈按位不同（此处为字内按位）
  if (zone.addressing === 'word' && res.bitIndex !== undefined) {
    return [
      {
        label: '输入/保持寄存器（字内按位）',
        options: [
          {
            value: 'bool',
            title: 'bool',
            desc: '仅读取该字寄存器中的 1 位；映射为布尔属性（地址第三段为位号，如 3_0_1 表示 FC04 地址 0 的第 1 位）',
          },
        ],
      },
    ];
  }

  if (zone.addressing === 'bit') {
    // 单点：标量 bool；多点：按位展开为布尔数组（与平台约定一致）
    if (res.count === 1) {
      return [
        {
          label: '线圈 / 离散（单点）',
          options: [
            {
              value: 'bool',
              title: 'bool',
              desc: '单个开关量，映射为一个布尔属性。',
            },
          ],
        },
      ];
    }
    return [
      {
        label: '线圈 / 离散（多位）',
        options: [
          {
            value: 'lsb_bit_array',
            title: 'lsb_bit_array',
            desc: '多个连续位组成布尔数组；顺序与报文一致，一般选此项。',
          },
          {
            value: 'bit_array',
            title: 'bit_array',
            desc: '布尔数组按「高位在先」展开；用于兼容旧配置或设备文档约定。',
          },
        ],
      },
    ];
  }

  const targetBits = res.count * 16;
  return codecGroupOptions
    .map((group) => ({
      ...group,
      options: group.options.filter((opt) => codecOptionMatchesWordWidth(opt, targetBits)),
    }))
    .filter((group) => group.options.length > 0);
};

/** 字寄存器区：按映射总位宽过滤；bit_array / lsb_bit_array 始终可选（按字拆位） */
const codecOptionMatchesWordWidth = (opt: CodecSelectOption, targetBits: number) => {
  if (opt.value === 'bit_array' || opt.value === 'lsb_bit_array') return true;
  if (typeof opt.registerBitsAligned === 'number') {
    return targetBits === opt.registerBitsAligned;
  }
  if (typeof opt.arrayElementBits === 'number') {
    return targetBits >= opt.arrayElementBits && targetBits % opt.arrayElementBits === 0;
  }
  if (typeof opt.bits === 'number') return opt.bits === targetBits;
  return false;
};

/** 解析器列下方灰色说明文案（面向用户，不展开实现细节） */
const getCodecFilterHint = (registerStr: string): string => {
  const res = doParseRegisterStr(registerStr);
  if (!res) return '';
  const zone = ZONE_INFO[res.type];
  if (!zone) return '';
  if (zone.addressing === 'bit') {
    if (res.count === 1) {
      return '1 个位地址 · 选「单点布尔」';
    }
    return `${res.count} 个位地址 · 选「布尔数组」（默认与报文一致）；需兼容旧约定时再选「高位优先」`;
  }
  if (zone.addressing === 'word' && res.bitIndex !== undefined) {
    return `字内第 ${res.bitIndex} 位 · 仅「单点布尔」，无需字节顺序`;
  }
  return `${res.count} 个寄存器（${res.count * 16} 位）· 仅列出位宽匹配的解析类型`;
};

const getRegisterHint = (str: string): string => {
  const res = doParseRegisterStr(str);
  if (!res) return '';

  const parts: string[] = [];

  // 从站（非默认才显示）
  if (res.slaveId !== 1) parts.push(`从站 ${res.slaveId}`);

  // 类型 + 功能码（工业标准简称）
  parts.push(getTypeLabel(res.type));

  // 标准 5 位地址（如 40001）
  parts.push(`#${getStandardAddress(res.type, res.address)}`);

  const z = ZONE_INFO[res.type];
  if (z?.addressing === 'bit') {
    parts.push(`${res.count} 个位`);
  } else {
    const byteCount = res.count * 2;
    parts.push(`${res.count} 字(16位) · ${byteCount} 字节`);
  }

  // 位操作（字区 + bit_index，常用 bool）
  if (res.bitIndex !== undefined) parts.push(`第 ${res.bitIndex} 位`);

  // 数组元素下标
  if (res.elementIndex !== undefined) parts.push(`元素[${res.elementIndex}]`);

  return parts.join('  ·  ');
};

/**
 * 返回结构化寄存器解析数据，供模板渲染带颜色的双行 hint 使用
 */
const getRegisterHintData = (str: string): RegHintData | null => {
  const res = doParseRegisterStr(str);
  if (!res) return null;

  const info = ZONE_INFO[res.type];
  if (!info) return null;

  const stdAddr    = getStandardAddress(res.type, res.address);
  const stdAddrEnd = res.count > 1 ? getStandardAddress(res.type, res.address + res.count - 1) : undefined;

  const addressing = info.addressing;
  const totalBits = addressing === 'bit' ? res.count : res.count * 16;
  const dataBytes = addressing === 'bit' ? Math.ceil(res.count / 8) : res.count * 2;

  return {
    zonePrefix: info.prefix,
    zoneName: info.name,
    fcCode: info.fc,
    color: info.color,
    bg: info.bg,
    stdAddr,
    stdAddrEnd,
    modbusAddr: res.address,
    modbusAddrEnd: res.count > 1 ? res.address + res.count - 1 : undefined,
    count: res.count,
    addressing,
    totalBits,
    dataBytes,
    zoneExplain: info.zoneExplain,
    bitIndex: res.bitIndex,
    elementIndex: res.elementIndex,
    slaveId: res.slaveId !== 1 ? res.slaveId : undefined,
    inputFormat: res.inputFormat,
  };
};

/** 布局逻辑 ID（界面与行数据）；保存 API 时转换为 JetLinks ByteLayout.getId()，如 AB、AB_CD */
type LayoutLogicalId = 'BIG_ENDIAN' | 'LITTLE_ENDIAN' | 'WORD_SWAP_2' | 'WORD_REVERSE_2';

const LAYOUT_LOGICAL_IDS = new Set<string>([
  'BIG_ENDIAN',
  'LITTLE_ENDIAN',
  'WORD_SWAP_2',
  'WORD_REVERSE_2',
]);

/** 收起态短标签（与类型列 shortCodec 一致：主行简短） */
const layoutShortLabel = (logical: string | undefined): string => {
  const m: Record<string, string> = {
    BIG_ENDIAN: '大端',
    LITTLE_ENDIAN: '小端',
    WORD_SWAP_2: '交换',
    WORD_REVERSE_2: '反转',
  };
  return m[logical || ''] || logical || '';
};

/** 后端 ByteLayout id → 界面逻辑 id（兼容历史配置中的 AB、AB_CD 等） */
const layoutBackendToLogical = (backend: string, wordCount: number): LayoutLogicalId => {
  if (wordCount === 1) {
    if (backend === 'BA') return 'LITTLE_ENDIAN';
    return 'BIG_ENDIAN';
  }
  // 2 字或 3 字（6 字节）时，后端仍常用 AB_CD 族布局 id
  if (wordCount === 2 || wordCount === 3) {
    const m: Record<string, LayoutLogicalId> = {
      AB_CD: 'BIG_ENDIAN',
      DC_BA: 'LITTLE_ENDIAN',
      CD_AB: 'WORD_SWAP_2',
      BA_DC: 'WORD_REVERSE_2',
    };
    return m[backend] ?? 'BIG_ENDIAN';
  }
  if (wordCount >= 4) {
    const m: Record<string, LayoutLogicalId> = {
      AB_CD_EF_GH: 'BIG_ENDIAN',
      GH_EF_CD_AB: 'LITTLE_ENDIAN',
      BA_DC_FE_HG: 'WORD_SWAP_2',
      HG_FE_DC_BA: 'WORD_REVERSE_2',
    };
    return m[backend] ?? 'BIG_ENDIAN';
  }
  return 'BIG_ENDIAN';
};

/** 界面逻辑 id → 后端 ByteLayout id */
const layoutLogicalToBackend = (logical: LayoutLogicalId, wordCount: number): string => {
  if (wordCount === 1) {
    return logical === 'LITTLE_ENDIAN' ? 'BA' : 'AB';
  }
  if (wordCount === 2 || wordCount === 3) {
    const m: Record<string, string> = {
      BIG_ENDIAN: 'AB_CD',
      LITTLE_ENDIAN: 'DC_BA',
      WORD_SWAP_2: 'CD_AB',
      WORD_REVERSE_2: 'BA_DC',
    };
    return m[logical] ?? 'AB_CD';
  }
  if (wordCount >= 4) {
    const m: Record<string, string> = {
      BIG_ENDIAN: 'AB_CD_EF_GH',
      LITTLE_ENDIAN: 'GH_EF_CD_AB',
      WORD_SWAP_2: 'BA_DC_FE_HG',
      WORD_REVERSE_2: 'HG_FE_DC_BA',
    };
    return m[logical] ?? 'AB_CD_EF_GH';
  }
  return 'AB';
};

const coerceLogicalForWordCount = (logical: LayoutLogicalId, wordCount: number): LayoutLogicalId => {
  if (wordCount === 1 && (logical === 'WORD_SWAP_2' || logical === 'WORD_REVERSE_2')) {
    return 'BIG_ENDIAN';
  }
  return logical;
};

/** 将行内 layout（逻辑 id 或历史后端 id）规范为逻辑 id */
const normalizeLayoutToLogical = (layout: string | undefined, wordCount: number): LayoutLogicalId => {
  const raw = (layout || '').trim();
  if (!raw) return 'BIG_ENDIAN';
  if (LAYOUT_LOGICAL_IDS.has(raw)) {
    return coerceLogicalForWordCount(raw as LayoutLogicalId, wordCount);
  }
  return layoutBackendToLogical(raw, wordCount);
};

/** 布局下拉：与 Codec 一致，title 为主标题（名称 · 逻辑ID），desc 为第二行（含 AB/BA 等示例 + 说明） */
interface LayoutSelectOption {
  value: LayoutLogicalId;
  title: string;
  desc: string;
}

/** 读响应 PDU 数据区字节数（按线圈数量向上取整到字节） */
function pduCoilDataByteCount(bitCount: number): number {
  return Math.max(1, Math.ceil(bitCount / 8));
}

/**
 * 与 {@link ModbusThingsMapping#extractCoilRegionFromFrame} 一致：≤16 线圈时 Codec 入参固定为 2 字节（writeShort）；
 * ＞16 时为 ceil(n/8) 字节。用于保存时字计数等，不能仅用 ceil(位数/8)。
 */
function coilCodecBufferByteCount(bitCount: number): number {
  const n = Math.max(1, bitCount);
  if (n <= 16) return 2;
  return Math.ceil(n / 8);
}

/**
 * 线圈/离散按字节打包后的「字个数」（2 字节=1 字），用于保存时 layout 归一化；界面不再为线圈提供布局下拉。
 */
function layoutWordCountForBitZone(bitCount: number): number {
  const bytes = coilCodecBufferByteCount(bitCount);
  if (bytes <= 1) return 0;
  if (bytes % 2 !== 0) return -1;
  return bytes / 2;
}

/** 保存/归一化布局时用的「字计数」：字区=寄存器个数；位区=按字节打包后的字个数（非 1 字节且非奇数） */
function layoutWordCountForSave(parsed: ParsedRegister): number {
  const zi = ZONE_INFO[parsed.type];
  if (zi?.addressing === 'bit') {
    const wc = layoutWordCountForBitZone(parsed.count);
    return wc <= 0 ? 1 : wc;
  }
  return parsed.count;
}

/** 从 API 还原行数据时，将布局与后端 ByteLayout 对齐用的字计数 */
function layoutWordCountFromRegisterReg(reg: { registerCount?: number; key?: { type?: string } }): number {
  const n = Math.max(1, reg?.registerCount || 1);
  const t = reg?.key?.type;
  if (t === 'Coils' || t === 'DiscreteInputs') {
    const wc = layoutWordCountForBitZone(n);
    return wc <= 0 ? 1 : wc;
  }
  return n;
}

/**
 * 与 JetLinks ByteLayout 一致（2/4/6/8 字节族），按寄存器「字个数」取布局选项（仅 3x/4x）。
 */
function getLayoutOptionsForWordCount(wc: number): LayoutSelectOption[] {
  // 单字（2 字节）：仅字内大/小端（AB/BA），无「字交换 / 字内反转」多字语义
  if (wc === 1) {
    return [
      {
        value: 'BIG_ENDIAN',
        title: '大端 · BIG_ENDIAN',
        desc: `AB：字内高字节在前（Big-endian，单寄存器常见文档顺序）`,
      },
      {
        value: 'LITTLE_ENDIAN',
        title: '小端 · LITTLE_ENDIAN',
        desc: `BA：字内低字节在前（寄存器内低字节先出现在报文）`,
      },
    ];
  }
  if (wc === 2) {
    return [
      {
        value: 'BIG_ENDIAN',
        title: '大端 · BIG_ENDIAN',
        desc: `AB_CD（ABCD）：字序与字内均为高字节在前；网络序 / Modbus 文档典型写法`,
      },
      {
        value: 'LITTLE_ENDIAN',
        title: '小端 · LITTLE_ENDIAN',
        desc: `DC_BA（DCBA）：字序与字内字节序均反转；整段按小端理解`,
      },
      {
        value: 'WORD_SWAP_2',
        title: '交换 · WORD_SWAP_2',
        desc: `CD_AB（CDAB）：仅交换两个 16 位字顺序，字内仍大端；多 PLC 的 32 位浮点/DINT 跨寄存器`,
      },
      {
        value: 'WORD_REVERSE_2',
        title: '反转 · WORD_REVERSE_2',
        desc: `BA_DC（BADC）：每个寄存器内高低字节对调，字序不变；部分仪表/PLC 字内反转`,
      },
    ];
  }
  if (wc === 3) {
    return [
      {
        value: 'BIG_ENDIAN',
        title: '大端 · BIG_ENDIAN',
        desc: `AB_CD（ABCD）：前 4 字节大端；6 字节场景下与设备约定一致时常用`,
      },
      {
        value: 'LITTLE_ENDIAN',
        title: '小端 · LITTLE_ENDIAN',
        desc: `DC_BA（DCBA）：整段小端理解（含 6 字节跨寄存器）`,
      },
      {
        value: 'WORD_SWAP_2',
        title: '交换 · WORD_SWAP_2',
        desc: `CD_AB（CDAB）：字序交换（多字场景）`,
      },
      {
        value: 'WORD_REVERSE_2',
        title: '反转 · WORD_REVERSE_2',
        desc: `BA_DC（BADC）：字内字节对调（多字场景）`,
      },
    ];
  }
  if (wc >= 4) {
    return [
      {
        value: 'BIG_ENDIAN',
        title: '大端 · BIG_ENDIAN',
        desc: `AB_CD_EF_GH（ABCDEFGH）：四寄存器连续大端排列，双精度浮点等常用`,
      },
      {
        value: 'LITTLE_ENDIAN',
        title: '小端 · LITTLE_ENDIAN',
        desc: `GH_EF_CD_AB（GHEFCDAB）：四寄存器整体小端排列（寄存器块级反转）`,
      },
      {
        value: 'WORD_SWAP_2',
        title: '交换 · WORD_SWAP_2',
        desc: `BA_DC_FE_HG（BADCFEHG）：每字内高低对调，字与字之间仍大端顺序`,
      },
      {
        value: 'WORD_REVERSE_2',
        title: '反转 · WORD_REVERSE_2',
        desc: `HG_FE_DC_BA（HGFEDCBA）：每字内交换且字间按小端排列`,
      },
    ];
  }
  return [];
}

const getLayoutOptions = (registerStr: string): LayoutSelectOption[] => {
  const res = doParseRegisterStr(registerStr);
  if (!res) return [];
  const zone = ZONE_INFO[res.type];

  // 线圈/离散：位打包与字寄存器不同，不在此配置字节布局（保存时按默认大端 AB）
  if (zone?.addressing === 'bit') {
    return [];
  }

  // 字区：总数据字节 = 寄存器数×2；仅 1 字节时不展示布局
  const wordBytes = res.count * 2;
  if (wordBytes <= 1) return [];

  // 输入/保持寄存器 + 字内位下标（如 3_0_1）：仅 1 位 bool，无字节布局
  if (zone.addressing === 'word' && res.bitIndex !== undefined) {
    return [];
  }

  return getLayoutOptionsForWordCount(res.count);
};

const autoFillLayout = (item: ModbusSimpleMapping) => {
  const res = doParseRegisterStr(item.registerStr);
  if (!res) return;

  if (item.codec) {
    const norm = normalizeCodecId(item.codec);
    if (norm !== item.codec) item.codec = norm;
  }

  const zone = ZONE_INFO[res.type];
  if (!zone) return;

  // 线圈/离散：不配置字节布局（保存时由空 layout 归一化为默认 AB）
  if (zone.addressing === 'bit') {
    if (res.count === 1 && (item.codec === 'bit_array' || item.codec === 'lsb_bit_array')) {
      item.codec = 'bool';
    }
    if (res.count > 1 && item.codec === 'bool') {
      item.codec = '';
    }
    item.layout = '';
    return;
  }

  // 输入/保持寄存器 + 字内位下标：仅 bool，无布局（如 3_0_1）；先于可选 Codec 校验以免误清空
  if (zone.addressing === 'word' && res.bitIndex !== undefined) {
    item.codec = 'bool';
    item.layout = '';
    return;
  }

  const validCodecs = getCodecOptionsForCount(item.registerStr)
    .flatMap((g) => (g as any).options.map((o: any) => o.value as string));
  if (item.codec && !validCodecs.includes(item.codec)) {
    item.codec = '';
  }

  const opts = getLayoutOptions(item.registerStr);
  if (!opts.length) {
    item.layout = '';
    return;
  }

  let logical = normalizeLayoutToLogical(item.layout, res.count);
  logical = coerceLogicalForWordCount(logical, res.count);
  const allowed = new Set(opts.map((o) => o.value));
  if (!allowed.has(logical)) {
    logical = 'BIG_ENDIAN';
  }
  item.layout = logical;
};

/** 展示「缩放/精度」等数值配置：位数组、日期时间、纯布尔、数组型不展示 */
const isNumericCodec = (codec: string) => {
  if (!codec) return true;
  if (codec === 'bit_array' || codec === 'lsb_bit_array' || codec === 'bool') return false;
  if (codec.includes('bcd_date_time')) return false;
  if (codec.endsWith('_array')) return false;
  return true;
};

/** 表格内联编辑：缩放因子失焦/变更后归一化，与抽屉逻辑一致 */
const onTableScaleFactorChange = (record: ModbusSimpleMapping, v: number | string | null) => {
  if (v == null || v === '') {
    record.scaleFactor = 1;
    return;
  }
  const n = typeof v === 'string' ? Number(v) : v;
  if (Number.isNaN(n)) {
    record.scaleFactor = 1;
  } else {
    record.scaleFactor = n;
  }
};

/** 表格内联编辑：小数位数 */
const onTableScaleChange = (record: ModbusSimpleMapping, v: number | null) => {
  if (v == null || Number.isNaN(Number(v))) {
    record.scale = -1;
  } else {
    record.scale = Math.round(Number(v));
  }
};

// ==================== Table Event Handlers ====================
const onPropertyChange = (val: string, record: ModbusSimpleMapping) => {
  const prop = metadataProperties.value.find((p) => p.id === val);
  if (prop) {
    record.propertyName = prop.name;
    record.propertyDataType = prop.valueType?.type;
    // codec 由寄存器范围来驱动，属性变更时不再自动推荐 codec
  } else {
    record.propertyName = undefined;
    record.propertyDataType = undefined;
  }
};

const onCodecChange = (record: ModbusSimpleMapping) => {
  autoFillLayout(record);
};

/** 寄存器地址变更：非保持+字内位时清除掩码写 */
function onRegisterStrChange(record: ModbusSimpleMapping) {
  if (!isHoldingWordBitSlice(record.registerStr)) {
    record.useMaskWrite = false;
  }
  autoFillLayout(record);
}

// ==================== Drawer ====================
const openDrawer = (record: ModbusSimpleMapping, index: number) => {
  drawerPropertyFocused.value = false;
  drawerIndex.value = index;
  Object.assign(drawerForm, {
    property: record.property ?? '',
    propertyName: record.propertyName ?? '',
    registerStr: record.registerStr ?? '',
    codec: normalizeCodecId(record.codec ?? ''),
    layout: record.layout ?? '',
    scaleFactor: record.scaleFactor ?? 1,
    scale: record.scale ?? -1,
    useMaskWrite: record.useMaskWrite === true,
    readable: record.readable ?? true,
    writable: record.writable ?? true,
  });
  drawerVisible.value = true;
};

const onDrawerPropertyChange = (val: string) => {
  const prop = metadataProperties.value.find((p) => p.id === val);
  if (prop) {
    drawerForm.propertyName = prop.name;
    // codec 由寄存器范围驱动，此处不自动推荐
  } else {
    drawerForm.propertyName = '';
  }
};

const onDrawerRegisterChange = () => {
  if (!isHoldingWordBitSlice(drawerForm.registerStr)) {
    drawerForm.useMaskWrite = false;
  }
  autoFillLayout(drawerForm as ModbusSimpleMapping);
};

const onDrawerCodecChange = () => {
  autoFillLayout(drawerForm as ModbusSimpleMapping);
};

const confirmDrawer = () => {
  if (drawerIndex.value >= 0 && drawerIndex.value < mappings.value.length) {
    // 用 splice 替换整行，确保 a-table 的响应式更新生效
    mappings.value.splice(drawerIndex.value, 1, {
      ...mappings.value[drawerIndex.value],
      property: drawerForm.property,
      propertyName: drawerForm.propertyName,
      registerStr: drawerForm.registerStr,
      codec: normalizeCodecId(drawerForm.codec),
      layout: drawerForm.layout,
      scaleFactor: toFiniteNumberOr(drawerForm.scaleFactor, 1),
      scale: Math.round(toFiniteNumberOr(drawerForm.scale, -1)),
      useMaskWrite: drawerForm.useMaskWrite === true,
      readable: drawerForm.readable,
      writable: drawerForm.writable,
    });
  }
  drawerVisible.value = false;
};

// ==================== CRUD ====================
const addMapping = () => {
  focusedPropertyIndex.value = null;
  mappings.value.unshift({
    property: '',
    registerStr: '',
    codec: '',
    layout: '',
    scaleFactor: 1,
    scale: -1,
    useMaskWrite: false,
    readable: true,
    writable: true,
  });
};

const removeMapping = (index: number) => {
  mappings.value.splice(index, 1);
};

const copyMapping = (index: number) => {
  const copy = { ...mappings.value[index] };
  mappings.value.splice(index + 1, 0, copy);
};

// ==================== API: Load/Save ====================
function normalizeModbusLinkType(v: unknown): 'PDU' | 'TCP' | 'RTU' {
  if (v === 'TCP' || v === 'RTU' || v === 'PDU') return v;
  return 'PDU';
}

const reconstructMappings = (mapping: any): ModbusSimpleMapping[] => {
  const typeCodeMap: Record<string, number> = {
    HoldingRegisters: 3,
    InputRegisters: 4,
    Coils: 1,
    DiscreteInputs: 2,
  };

  return (mapping.properties || []).map((prop: any) => {
    const reg = prop.register;
    let registerStr = '';

    if (reg?.key) {
      const { slaveId, type, address } = reg.key;
      const typeCode = typeCodeMap[type] || 3;
      const count = reg.registerCount || 1;

      registerStr = `${typeCode}_${address}`;
      // 范围写法：count > 1 且非 bit 操作时使用 "fc_start-end"
      if (count > 1 && prop.bitIndex == null) {
        registerStr += `-${address + count - 1}`;
      }
      if (prop.bitIndex != null) registerStr += `_${prop.bitIndex}`;
      if (prop.elementIndex != null) registerStr += `@${prop.elementIndex}`;
      if (slaveId && slaveId !== 1) registerStr = `${slaveId}:${registerStr}`;
    }

    const metaProp = metadataProperties.value.find((p) => p.id === prop.property);
    const layoutWc = layoutWordCountFromRegisterReg(reg);
    return {
      property: prop.property ?? '',
      propertyName: metaProp?.name,
      propertyDataType: metaProp?.valueType?.type,
      registerStr,
      codec: normalizeCodecId(reg?.codec ?? ''),
      layout: normalizeLayoutToLogical(reg?.layout ?? '', layoutWc),
      scaleFactor: toFiniteNumberOr(reg?.scaleFactor, 1),
      scale: Math.round(toFiniteNumberOr(reg?.scale, -1)),
      bitLength: typeof prop.bitLength === 'number' && prop.bitLength > 0 ? prop.bitLength : undefined,
      useMaskWrite: prop.useMaskWrite === true,
      readable: prop.readable ?? true,
      writable: prop.writable ?? true,
    };
  });
};

const loadConfig = async () => {
  const pId = props.productId || instanceStore.current?.productId;
  const dId = props.thingId || instanceStore.current?.id;
  if (!pId || !dId) return;

  loading.value = true;
  try {
    const res: any = await deviceCode(pId, dId);
    if (res.status === 200 && res.result?.provider === 'modbus') {
      const mMapping = res.result.configuration?.mapping;
      if (mMapping) {
        modbusLinkType.value = normalizeModbusLinkType(mMapping.modbusLinkType);
        mappings.value = reconstructMappings(mMapping);
        mappings.value.forEach((row) => autoFillLayout(row));
      }
    }
  } finally {
    loading.value = false;
  }
};

const saveConfig = async () => {
  const pId = props.productId || instanceStore.current?.productId;
  const dId = props.thingId || instanceStore.current?.id;
  if (!pId || !dId) {
    message.error('未找到设备信息');
    return;
  }
  if (!configObject.value) {
    message.warning('请先配置映射关系');
    return;
  }

  saving.value = true;
  try {
    const res: any = await saveDeviceCode(pId, dId, {
      provider: 'modbus',
      configuration: { mapping: configObject.value },
    });
    if (res.status === 200) {
      message.success('保存成功');
    }
  } finally {
    saving.value = false;
  }
};

// ==================== Debug: Decode — Hex/Base64 规范化 & Modbus 帧解析 ====================

interface DecodeNormalized {
  bytes: number[];
  sourceLabel: string;
  parseError: string;
  hexForApi: string;
}

const bytesToHexSpaced = (arr: number[]): string =>
  arr.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

/** 将编码结果中的一行 Hex（空格/逗号/0x 等）转为字节，与解码区 Hex 规则一致 */
function hexLineToBytes(line: string): number[] {
  const hexFlat = line
    .replace(/\r\n/g, '\n')
    .replace(/0x/gi, '')
    .replace(/[,;:|_\-\t\n\r \u00a0]+/g, '')
    .trim();
  if (!hexFlat.length || !/^[0-9a-fA-F]+$/.test(hexFlat) || hexFlat.length % 2 !== 0) {
    return [];
  }
  const bytes: number[] = [];
  for (let i = 0; i < hexFlat.length; i += 2) {
    bytes.push(parseInt(hexFlat.slice(i, i + 2), 16));
  }
  return bytes;
}

function normalizeDecodeInput(raw: string): DecodeNormalized {
  const empty: DecodeNormalized = { bytes: [], sourceLabel: '', parseError: '', hexForApi: '' };
  const t = raw.trim();
  if (!t) return empty;

  const tryParseBase64 = (s: string): number[] | null => {
    try {
      const b64 = s.replace(/\s/g, '');
      if (!b64.length) return null;
      const bin = atob(b64);
      return [...bin].map((c) => c.charCodeAt(0));
    } catch {
      return null;
    }
  };

  /**
   * 展平为连续十六进制串：去掉所有 0x/0X、空白、常见分隔符（空格、逗号、冒号、分号、竖线、下划线、连字符）
   * 支持：01 03 04 / 0x01,0x03 / 0x01-0x03 / 0X01\n0X03 等
   */
  function flattenHexInput(input: string): string {
    return input
      .replace(/\r\n/g, '\n')
      .replace(/0x/gi, '')
      .replace(/[,;:|_\-\t\n\r \u00a0]+/g, '')
      .trim();
  }

  const hexFlat = flattenHexInput(t);
  const isPureHex = hexFlat.length > 0 && /^[0-9a-fA-F]+$/.test(hexFlat);

  // 纯十六进制字符（仅 0-9A-F）：优先按 Hex 解析（避免与 Base64 歧义，如 AABBCCDD）
  if (isPureHex) {
    if (hexFlat.length % 2 !== 0) {
      return {
        ...empty,
        parseError: '十六进制总位数须为偶数（已自动去掉空格、0x、逗号等分隔）',
      };
    }
    const bytes: number[] = [];
    for (let i = 0; i < hexFlat.length; i += 2) {
      bytes.push(parseInt(hexFlat.slice(i, i + 2), 16));
    }
    const hexLower = hexFlat.toLowerCase();
    return {
      bytes,
      sourceLabel: 'Hex',
      parseError: '',
      hexForApi: `0x${hexLower}`,
    };
  }

  const b64Compact = t.replace(/\s/g, '');
  const hasB64Special = /[+/=]/.test(b64Compact);
  const looksLikeBase64 =
    b64Compact.length >= 4 && /^[A-Za-z0-9+/]+=*$/.test(b64Compact);

  // 含 Base64 特征字符，或整体符合 Base64 字母表
  if (hasB64Special || looksLikeBase64) {
    const b = tryParseBase64(t);
    if (b?.length) {
      const hex = b.map((x) => x.toString(16).padStart(2, '0')).join('');
      return {
        bytes: b,
        sourceLabel: 'Base64',
        parseError: '',
        hexForApi: `0x${hex}`,
      };
    }
    if (hasB64Special) {
      return { ...empty, parseError: 'Base64 解码失败，请检查填充与字符集' };
    }
  }

  // 最后尝试 Base64（无 +/= 的短串等）
  const bFallback = tryParseBase64(t);
  if (bFallback?.length) {
    const hex = bFallback.map((x) => x.toString(16).padStart(2, '0')).join('');
    return {
      bytes: bFallback,
      sourceLabel: 'Base64',
      parseError: '',
      hexForApi: `0x${hex}`,
    };
  }

  return {
    ...empty,
    parseError:
      '无法自动识别：请使用十六进制（支持空格、0x 前缀、逗号/换行分隔）或标准 Base64',
  };
}

function crc16Modbus(bytes: number[], start: number, len: number): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= bytes[start + i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xa001;
      else crc >>>= 1;
    }
  }
  return crc & 0xffff;
}

const FC_NAMES: Record<number, string> = {
  0x01: 'FC01 读线圈',
  0x02: 'FC02 读离散输入',
  0x03: 'FC03 读保持寄存器',
  0x04: 'FC04 读输入寄存器',
  0x05: 'FC05 写单线圈',
  0x06: 'FC06 写单寄存器',
  0x0f: 'FC15 写多线圈',
  0x10: 'FC16 写多寄存器',
  0x16: 'FC22 掩码写寄存器',
};

const EXC_NAMES: Record<number, string> = {
  1: '非法功能码',
  2: '非法数据地址',
  3: '非法数据值',
  4: '从站设备故障',
};

/** 解码调试：按地址模拟「设备 → 主站」读响应（随机数据区；PDU / TCP+MBAP / RTU+CRC 与链路类型一致） */
const MAX_DECODE_SIM_DATA = 512;

function randomBytes(n: number): number[] {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 256));
}

function wrapTcpMbap(pdu: number[]): number[] {
  const n = pdu.length;
  const tid = 0;
  return [(tid >> 8) & 0xff, tid & 0xff, 0, 0, (n >> 8) & 0xff, n & 0xff, ...pdu];
}

function buildRandomReadResponse(
  parsed: ParsedRegister,
  link: 'PDU' | 'TCP' | 'RTU'
): { bytes: number[]; fcLabel: string } | null {
  const slave = parsed.slaveId ?? 1;
  let fc: number;
  if (parsed.type === 'Coils') fc = 0x01;
  else if (parsed.type === 'DiscreteInputs') fc = 0x02;
  else if (parsed.type === 'HoldingRegisters') fc = 0x03;
  else if (parsed.type === 'InputRegisters') fc = 0x04;
  else return null;

  const zone = ZONE_INFO[parsed.type];
  if (!zone) return null;

  const fcLabel = FC_NAMES[fc] || `FC${fc}`;

  if (zone.addressing === 'bit') {
    const nBits = parsed.count;
    const byteCount = Math.ceil(nBits / 8);
    if (byteCount > MAX_DECODE_SIM_DATA) return null;
    const data = randomBytes(byteCount);
    const pdu = [slave, fc, byteCount, ...data];
    if (link === 'PDU') return { bytes: pdu, fcLabel };
    if (link === 'TCP') return { bytes: wrapTcpMbap(pdu), fcLabel };
    const crc = crc16Modbus(pdu, 0, pdu.length);
    return { bytes: [...pdu, crc & 0xff, (crc >> 8) & 0xff], fcLabel };
  }

  const byteCount = parsed.count * 2;
  if (byteCount > MAX_DECODE_SIM_DATA) return null;
  const data = randomBytes(byteCount);
  const pdu = [slave, fc, byteCount, ...data];
  if (link === 'PDU') return { bytes: pdu, fcLabel };
  if (link === 'TCP') return { bytes: wrapTcpMbap(pdu), fcLabel };
  const crc = crc16Modbus(pdu, 0, pdu.length);
  return { bytes: [...pdu, crc & 0xff, (crc >> 8) & 0xff], fcLabel };
}

function regenerateDecodeSimFrame() {
  decodeSimError.value = '';
  const s = decodeSimAddressStr.value.trim();
  if (!s) {
    decodeSimBytes.value = [];
    decodeSimFcLabel.value = '';
    return;
  }
  const parsed = doParseRegisterStr(s);
  if (!parsed) {
    decodeSimError.value = '地址格式无法解析，请与映射表相同（如 40001-40008、3_0-7、1_0-15）';
    decodeSimBytes.value = [];
    decodeSimFcLabel.value = '';
    return;
  }
  const built = buildRandomReadResponse(parsed, modbusLinkType.value);
  if (!built) {
    decodeSimError.value = '模拟数据过大（请缩小寄存器/位数范围）';
    decodeSimBytes.value = [];
    decodeSimFcLabel.value = '';
    return;
  }
  decodeSimBytes.value = built.bytes;
  decodeSimFcLabel.value = built.fcLabel;
}

function refreshDecodeSimFrame() {
  regenerateDecodeSimFrame();
}

function applyDecodeSimToPayload() {
  if (!decodeSimBytes.value.length) {
    message.warning('请先在 [ ] 中填写可解析的地址');
    return;
  }
  decodePayload.value = bytesToHexSpaced(decodeSimBytes.value);
  message.success('已填入原始数据');
}

interface ModbusParseView {
  linkTypeLabel: string;
  tcpHeader?: string;
  unitId: number;
  /** 功能码数值（异常时为原功能码低 7 位） */
  fcCode: number;
  fcLabel: string;
  isException: boolean;
  exceptionLabel?: string;
  /** 下行读/写请求：PDU 起始地址（0-based） */
  requestStartAddr?: number;
  /** 下行读请求：线圈/离散数量或寄存器字数；写多线圈/多寄存器时的数量 */
  requestQuantity?: number;
  byteCount?: number;
  /** FC03/04 数据区寄存器个数 */
  wordRegisterCount?: number;
  dataHexPreview?: string;
  registerPreview?: { index: number; hex: string; uint16: number }[];
  coilBitsPreview?: string;
  crcLine?: string;
  crcOk?: boolean;
  warnings: string[];
}

/** 按所选链路类型解析上行原始字节（与后端 ModbusFrameCodec.decode 一致） */
function parseModbusPayload(bytes: number[], link: 'PDU' | 'TCP' | 'RTU'): ModbusParseView | null {
  const warnings: string[] = [];

  if (link === 'PDU') {
    if (bytes.length < 2) return null;
    const unit = bytes[0];
    const fc = bytes[1];
    const pduTail = bytes.slice(2);
    return buildPduView('Modbus PDU（裸 PDU）', undefined, unit, fc, pduTail, undefined, warnings);
  }

  if (link === 'TCP') {
    if (bytes.length < 8) {
      warnings.push('TCP：至少需要 8 字节（MBAP 6 + 至少 2 字节 PDU）');
      return null;
    }
    const proto = (bytes[2] << 8) | bytes[3];
    if (proto !== 0) {
      warnings.push('TCP：协议标识应为 0');
      return null;
    }
    const mbapLen = (bytes[4] << 8) | bytes[5];
    if (mbapLen < 2) {
      warnings.push('TCP：MBAP 长度字段应 ≥ 2');
      return null;
    }
    if (bytes.length < 6 + mbapLen) {
      warnings.push('TCP：缓冲区长度不足（需至少 6 + MBAP「长度」字节）');
      return null;
    }
    const tid = (bytes[0] << 8) | bytes[1];
    const unit = bytes[6];
    const fc = bytes[7];
    const pduTail = bytes.slice(8, 6 + mbapLen);
    const tcpHeader = `事务 ${tid} · 协议标识 0 · 长度 ${mbapLen} · 单元 ${unit}`;
    return buildPduView('Modbus TCP', tcpHeader, unit, fc, pduTail, undefined, warnings);
  }

  // RTU
  if (bytes.length < 4) return null;
  const crcRx = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
  const crcCalc = crc16Modbus(bytes, 0, bytes.length - 2);
  const crcOk = crcCalc === crcRx;
  const slave = bytes[0];
  const fc = bytes[1];
  const pduTail = bytes.slice(2, -2);
  const crcLine = `接收 0x${(crcRx & 0xff).toString(16).padStart(2, '0').toUpperCase()} ${((crcRx >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase()}（低字节在前）· 计算 0x${(crcCalc & 0xff).toString(16).padStart(2, '0').toUpperCase()} ${((crcCalc >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase()}${crcOk ? ' ✓' : ' ✗'}`;
  if (!crcOk) {
    warnings.push('RTU：CRC 与计算值不一致');
  }
  return buildPduView('Modbus RTU', undefined, slave, fc, pduTail, { crcLine, crcOk }, warnings);
}

function buildPduView(
  linkTypeLabel: string,
  tcpHeader: string | undefined,
  unitId: number,
  fc: number,
  pduTail: number[],
  crc: { crcLine: string; crcOk: boolean } | undefined,
  warnings: string[]
): ModbusParseView {
  const isExc = (fc & 0x80) !== 0;
  const fcBase = fc & 0x7f;

  if (isExc) {
    const code = pduTail[0] ?? 0;
    const fcLabel = `${FC_NAMES[fcBase] || `功能码 0x${fcBase.toString(16)}`} · 异常响应`;
    return {
      linkTypeLabel,
      tcpHeader,
      unitId,
      fcCode: fcBase,
      fcLabel,
      isException: true,
      exceptionLabel: `异常码 ${code} — ${EXC_NAMES[code] || '未知'}`,
      crcLine: crc?.crcLine,
      crcOk: crc?.crcOk,
      warnings,
    };
  }

  const fcLabel = FC_NAMES[fc] || `功能码 0x${fc.toString(16).toUpperCase()}`;

  let byteCount: number | undefined;
  let dataHexPreview: string | undefined;
  let registerPreview: { index: number; hex: string; uint16: number }[] | undefined;
  let coilBitsPreview: string | undefined;

  if (fc === 0x03 || fc === 0x04) {
    byteCount = pduTail[0];
    const data = pduTail.slice(1, 1 + (byteCount ?? 0));
    if (byteCount !== undefined && data.length !== byteCount) {
      warnings.push('字节计数与后续数据长度不一致');
    }
    dataHexPreview = data.length ? bytesToHexSpaced(data) : '—';
    registerPreview = [];
    for (let i = 0; i + 1 < data.length; i += 2) {
      const hi = data[i];
      const lo = data[i + 1];
      const uint16 = (hi << 8) | lo;
      registerPreview.push({
        index: i / 2,
        hex: `${hi.toString(16).padStart(2, '0').toUpperCase()} ${lo.toString(16).padStart(2, '0').toUpperCase()}`,
        uint16,
      });
    }
  } else if (fc === 0x01 || fc === 0x02) {
    byteCount = pduTail[0];
    const data = pduTail.slice(1, 1 + (byteCount ?? 0));
    dataHexPreview = data.length ? bytesToHexSpaced(data) : '—';
    const bits: string[] = [];
    let bitNo = 0;
    const maxShow = 64;
    for (let bi = 0; bi < data.length && bitNo < maxShow; bi++) {
      const by = data[bi];
      for (let b = 0; b < 8 && bitNo < maxShow; b++) {
        const v = (by >> b) & 1;
        bits.push(`位${bitNo}=${v}`);
        bitNo++;
      }
    }
    coilBitsPreview = bits.length
      ? bits.join('  ') + (bitNo >= maxShow ? ' …' : '')
      : undefined;
  } else {
    dataHexPreview = pduTail.length ? bytesToHexSpaced(pduTail) : '—';
  }

  const wordRegisterCount = registerPreview?.length;

  return {
    linkTypeLabel,
    tcpHeader,
    unitId,
    fcCode: fc,
    fcLabel,
    isException: false,
    byteCount,
    wordRegisterCount,
    dataHexPreview,
    registerPreview,
    coilBitsPreview,
    crcLine: crc?.crcLine,
    crcOk: crc?.crcOk,
    warnings,
  };
}

/** 解析下行 Modbus PDU（透传编码通常为 从站 + 功能码 + 数据，无 CRC/MBAP）；与 parseModbusPayload（按链路类型）互补 */
function parseModbusDownlinkPdu(bytes: number[]): ModbusParseView | null {
  if (bytes.length < 2) return null;
  const unitId = bytes[0];
  const fc = bytes[1];
  const tail = bytes.slice(2);
  const warnings: string[] = [];
  const linkTypeLabel = 'Modbus PDU（下行 · 无 RTU CRC / 无 TCP MBAP）';

  if (fc & 0x80) {
    const fcBase = fc & 0x7f;
    const code = tail[0] ?? 0;
    const fcLabel = `${FC_NAMES[fcBase] || `功能码 0x${fcBase.toString(16)}`} · 异常响应`;
    return {
      linkTypeLabel,
      unitId,
      fcCode: fcBase,
      fcLabel,
      isException: true,
      exceptionLabel: `异常码 ${code} — ${EXC_NAMES[code] || '未知'}`,
      warnings,
    };
  }

  const fcLabelBase = FC_NAMES[fc] || `功能码 0x${fc.toString(16).toUpperCase()}`;

  if (fc === 0x01 || fc === 0x02 || fc === 0x03 || fc === 0x04) {
    if (tail.length < 4) {
      warnings.push('读请求应为：起始地址 2 字节 + 数量 2 字节');
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: `${fcLabelBase} · 请求`,
        isException: false,
        dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
        warnings,
      };
    }
    const addr = (tail[0] << 8) | tail[1];
    const qty = (tail[2] << 8) | tail[3];
    if (qty === 0) {
      warnings.push(
        '读请求数量为 0，不符合 Modbus 规范（线圈/离散 1–2000；寄存器 1–125）。若由平台生成，请升级/核对读线圈 PDU 编码实现。',
      );
    }
    return {
      linkTypeLabel,
      unitId,
      fcCode: fc,
      fcLabel: `${fcLabelBase} · 请求`,
      isException: false,
      requestStartAddr: addr,
      requestQuantity: qty,
      // 读请求 PDU 尾部仅为「起始地址 + 数量」共 4 字节，已在上方展示，不再重复为「数据区」十六进制
      warnings,
    };
  }

  if (fc === 0x05 || fc === 0x06) {
    if (tail.length < 4) {
      warnings.push('单写请求应为：地址 2 字节 + 值 2 字节');
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: `${fcLabelBase} · 请求`,
        isException: false,
        dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
        warnings,
      };
    }
    const addr = (tail[0] << 8) | tail[1];
    const val = (tail[2] << 8) | tail[3];
    const coilBitsPreview =
      fc === 0x05
        ? `写入线圈：${val === 0xff00 ? 'ON' : val === 0 ? 'OFF' : `0x${val.toString(16).toUpperCase()}`}`
        : `写入寄存器值：${val} (0x${val.toString(16).toUpperCase().padStart(4, '0')})`;
    return {
      linkTypeLabel,
      unitId,
      fcCode: fc,
      fcLabel: `${fcLabelBase} · 请求`,
      isException: false,
      requestStartAddr: addr,
      dataHexPreview: bytesToHexSpaced(tail),
      coilBitsPreview,
      warnings,
    };
  }

  if (fc === 0x0f) {
    if (tail.length < 5) {
      warnings.push('写多线圈请求长度不足');
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: `${fcLabelBase} · 请求`,
        isException: false,
        dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
        warnings,
      };
    }
    const addr = (tail[0] << 8) | tail[1];
    const qty = (tail[2] << 8) | tail[3];
    const byteCount = tail[4];
    const data = tail.slice(5, 5 + byteCount);
    if (data.length !== byteCount) {
      warnings.push('字节计数与后续线圈数据长度不一致');
    }
    return {
      linkTypeLabel,
      unitId,
      fcCode: fc,
      fcLabel: `${fcLabelBase} · 请求`,
      isException: false,
      requestStartAddr: addr,
      requestQuantity: qty,
      byteCount,
      dataHexPreview: data.length ? bytesToHexSpaced(data) : '—',
      coilBitsPreview: `线圈数量 ${qty}`,
      warnings,
    };
  }

  if (fc === 0x10) {
    if (tail.length < 5) {
      warnings.push('写多寄存器请求长度不足');
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: `${fcLabelBase} · 请求`,
        isException: false,
        dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
        warnings,
      };
    }
    const addr = (tail[0] << 8) | tail[1];
    const qty = (tail[2] << 8) | tail[3];
    const byteCount = tail[4];
    const data = tail.slice(5, 5 + byteCount);
    if (data.length !== byteCount) {
      warnings.push('字节计数与后续寄存器数据长度不一致');
    }
    const registerPreview: { index: number; hex: string; uint16: number }[] = [];
    for (let i = 0; i + 1 < data.length; i += 2) {
      const hi = data[i];
      const lo = data[i + 1];
      const uint16 = (hi << 8) | lo;
      registerPreview.push({
        index: i / 2,
        hex: `${hi.toString(16).padStart(2, '0').toUpperCase()} ${lo.toString(16).padStart(2, '0').toUpperCase()}`,
        uint16,
      });
    }
    return {
      linkTypeLabel,
      unitId,
      fcCode: fc,
      fcLabel: `${fcLabelBase} · 请求`,
      isException: false,
      requestStartAddr: addr,
      requestQuantity: qty,
      byteCount,
      wordRegisterCount: registerPreview.length ? registerPreview.length : qty,
      dataHexPreview: data.length ? bytesToHexSpaced(data) : '—',
      registerPreview: registerPreview.length ? registerPreview : undefined,
      warnings,
    };
  }

  if (fc === 0x16) {
    if (tail.length < 6) {
      warnings.push('掩码写寄存器请求应为：起始地址 2 字节 + AND_Mask 2 字节 + OR_Mask 2 字节');
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: `${fcLabelBase} · 请求`,
        isException: false,
        dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
        warnings,
      };
    }
    const addr = (tail[0] << 8) | tail[1];
    const andMask = (tail[2] << 8) | tail[3];
    const orMask = (tail[4] << 8) | tail[5];
    const coilBitsPreview = `AND_Mask=0x${andMask.toString(16).toUpperCase().padStart(4, '0')} · OR_Mask=0x${orMask.toString(16).toUpperCase().padStart(4, '0')}（新值 = (当前 & AND) | (OR & ~AND)）`;
    return {
      linkTypeLabel,
      unitId,
      fcCode: fc,
      fcLabel: `${fcLabelBase} · 请求`,
      isException: false,
      requestStartAddr: addr,
      dataHexPreview: bytesToHexSpaced(tail),
      coilBitsPreview,
      warnings,
    };
  }

  return {
    linkTypeLabel,
    unitId,
    fcCode: fc,
    fcLabel: `${fcLabelBase} · 下行`,
    isException: false,
    dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
    warnings,
  };
}

const decodeInputNormalized = computed(() => normalizeDecodeInput(decodePayload.value));

const decodeFrameAnalysis = computed((): ModbusParseView | null => {
  const n = decodeInputNormalized.value;
  if (n.parseError || !n.bytes.length) return null;
  return parseModbusPayload(n.bytes, modbusLinkType.value);
});

const decodeSimHexFull = computed(() =>
  decodeSimBytes.value.length ? bytesToHexSpaced(decodeSimBytes.value) : '—'
);

const decodeSimHexShort = computed(() => {
  const full = decodeSimHexFull.value;
  if (full === '—') return '—';
  const max = 96;
  return full.length > max ? `${full.slice(0, max)}…` : full;
});

const decodeSimMetaLine = computed(() => {
  if (!decodeSimBytes.value.length || !decodeSimFcLabel.value) return '';
  const linkLabel =
    modbusLinkType.value === 'TCP'
      ? 'Modbus TCP'
      : modbusLinkType.value === 'RTU'
        ? 'Modbus RTU'
        : 'Modbus PDU';
  return `${linkLabel} · 模拟读响应 · ${decodeSimFcLabel.value} · ${decodeSimBytes.value.length} 字节`;
});

/** 解码可视化：PDU 数据区字节 / 位 与属性对齐 */
interface DecodeVisualSegment {
  propertyId: string;
  byteStart: number;
  byteLen: number;
  tone: number;
  displayValue: string;
  rawValue: unknown;
  registerHint?: string;
  /** 相对 PDU 数据区起始的全局位下标（0=第 1 字节 bit0） */
  bitRanges?: { from: number; to: number }[];
}

function formatDecodePropValue(val: unknown): string {
  if (val == null) return String(val);
  if (Array.isArray(val)) {
    const s = JSON.stringify(val);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  }
  if (typeof val === 'object') {
    const s = JSON.stringify(val);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

function mergeReportProperties(outputs: any[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!Array.isArray(outputs)) return out;
  for (const msg of outputs) {
    if (msg && typeof msg === 'object' && msg.properties && typeof msg.properties === 'object') {
      Object.assign(out, msg.properties);
    }
  }
  return out;
}

/**
 * 下行请求 PDU 从单元 ID 起的字节长度（与 {@link ModbusFrameCodec#encodePduInternal} 常见帧一致）。
 * 无法识别时返回 null。
 */
function lengthDownlinkRequestPdu(bytes: number[], start: number): number | null {
  if (start + 2 > bytes.length) return null;
  const fcRaw = bytes[start + 1];
  if (fcRaw & 0x80) {
    return start + 3 <= bytes.length ? 3 : null;
  }
  const fc = fcRaw & 0x7f;
  if (fc === 0x01 || fc === 0x02 || fc === 0x03 || fc === 0x04) return 6;
  if (fc === 0x05 || fc === 0x06) return 6;
  if (fc === 0x0f) {
    if (start + 7 > bytes.length) return null;
    const byteCount = bytes[start + 6];
    return 7 + byteCount;
  }
  if (fc === 0x10) {
    if (start + 7 > bytes.length) return null;
    const byteCount = bytes[start + 6];
    return 7 + byteCount;
  }
  return null;
}

/**
 * 将编码结果连续字节拆成多段「线级」报文（与后端多帧顺序拼接一致）：PDU 按下行请求长度切分；TCP 按 MBAP；RTU 按 PDU+CRC。
 */
function splitEncodePayloadToWireSegments(bytes: number[], link: 'PDU' | 'TCP' | 'RTU'): number[][] {
  if (!bytes.length) return [];
  if (link === 'TCP') {
    const out: number[][] = [];
    let i = 0;
    while (i < bytes.length) {
      if (i + 6 > bytes.length) break;
      if (((bytes[i + 2] << 8) | bytes[i + 3]) !== 0) break;
      const mbapLen = (bytes[i + 4] << 8) | bytes[i + 5];
      const total = 6 + mbapLen;
      if (total < 8 || i + total > bytes.length) break;
      out.push(bytes.slice(i, i + total));
      i += total;
    }
    if (i < bytes.length) {
      if (out.length) out.push(bytes.slice(i));
      else out.push(bytes);
    }
    return out.length ? out : [bytes];
  }
  if (link === 'RTU') {
    const out: number[][] = [];
    let i = 0;
    while (i < bytes.length) {
      const pduLen = lengthDownlinkRequestPdu(bytes, i);
      if (pduLen == null || i + pduLen + 2 > bytes.length) break;
      out.push(bytes.slice(i, i + pduLen + 2));
      i += pduLen + 2;
    }
    if (i < bytes.length) {
      if (out.length) out.push(bytes.slice(i));
      else out.push(bytes);
    }
    return out.length ? out : [bytes];
  }
  const out: number[][] = [];
  let i = 0;
  while (i < bytes.length) {
    const pduLen = lengthDownlinkRequestPdu(bytes, i);
    if (pduLen == null || i + pduLen > bytes.length) break;
    out.push(bytes.slice(i, i + pduLen));
    i += pduLen;
  }
  if (i < bytes.length) {
    if (out.length) out.push(bytes.slice(i));
    else out.push(bytes);
  }
  return out.length ? out : [bytes];
}

/** 按链路类型从完整 ADU 得到 UnitId+功能码+数据 的 PDU 字节序列（与后端 decode 剥离规则一致） */
function stripToPduBytes(fullBytes: number[], link: 'PDU' | 'TCP' | 'RTU'): number[] | null {
  if (link === 'PDU') return fullBytes;
  if (link === 'TCP') {
    if (fullBytes.length < 8) return null;
    if (((fullBytes[2] << 8) | fullBytes[3]) !== 0) return null;
    const mbapLen = (fullBytes[4] << 8) | fullBytes[5];
    if (mbapLen < 2 || fullBytes.length < 6 + mbapLen) return null;
    return fullBytes.slice(6, 6 + mbapLen);
  }
  if (fullBytes.length < 4) return null;
  return fullBytes.slice(0, -2);
}

/** 从完整帧提取读响应 PDU 数据区（线圈/寄存器负载），需与左侧「链路类型」一致 */
function extractModbusResponseDataBytes(
  fullBytes: number[],
  link: 'PDU' | 'TCP' | 'RTU',
): { data: number[]; fc: number } | null {
  const pdu = stripToPduBytes(fullBytes, link);
  if (!pdu || pdu.length < 4) return null;
  const fc = pdu[1];
  const bc = pdu[2];
  if (fc === 0x03 || fc === 0x04 || fc === 0x01 || fc === 0x02) {
    if (pdu.length < 3 + bc) return null;
    const data = pdu.slice(3, 3 + bc);
    if (data.length !== bc) return null;
    return { data, fc };
  }
  return null;
}

function registerBitIndexToGlobalBit(
  pduWordStart: number,
  bitInRegister: number,
  minPdu: number,
): number {
  const wordOff = pduWordStart - minPdu;
  const byteBase = wordOff * 2;
  const b = bitInRegister;
  // Modbus 字寄存器大端：首字节高 8 位（bit15..8），次字节低 8 位（bit7..0）
  if (b < 8) {
    return (byteBase + 1) * 8 + b;
  }
  return (byteBase + 0) * 8 + (b - 8);
}

function buildRegisterDecodeSegments(
  props: Record<string, unknown>,
  mapRows: ModbusSimpleMapping[],
  dataLen: number,
): { segments: DecodeVisualSegment[]; minPdu: number; unmappedProps: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const acc: { prop: string; pduStart: number; words: number; bitIndex?: number }[] = [];
  const unmapped: string[] = [];

  for (const k of Object.keys(props)) {
    const row = mapRows.find((m) => m.property === k);
    if (!row) {
      unmapped.push(k);
      continue;
    }
    const p = doParseRegisterStr(row.registerStr);
    if (!p) {
      unmapped.push(k);
      continue;
    }
    const zone = ZONE_INFO[p.type];
    if (!zone || zone.addressing !== 'word') {
      unmapped.push(k);
      continue;
    }
    acc.push({
      prop: k,
      pduStart: p.address,
      words: Math.max(1, p.count),
      bitIndex: p.bitIndex,
    });
  }

  if (!acc.length) {
    return { segments: [], minPdu: 0, unmappedProps: [...Object.keys(props)], warnings };
  }

  const minPdu = Math.min(...acc.map((r) => r.pduStart));
  const segments: DecodeVisualSegment[] = [];
  let tone = 0;

  for (const r of [...acc].sort((a, b) => a.pduStart - b.pduStart || (a.bitIndex ?? -1) - (b.bitIndex ?? -1))) {
    const row = mapRows.find((m) => m.property === r.prop)!;
    const t = tone % 8;
    tone++;

    if (r.bitIndex !== undefined) {
      const g = registerBitIndexToGlobalBit(r.pduStart, r.bitIndex, minPdu);
      const byteIdx = Math.floor(g / 8);
      if (byteIdx < 0 || byteIdx >= dataLen) {
        warnings.push(`「${r.prop}」字内位映射超出数据区`);
        continue;
      }
      segments.push({
        propertyId: r.prop,
        byteStart: byteIdx,
        byteLen: 1,
        tone: t,
        displayValue: formatDecodePropValue(props[r.prop]),
        rawValue: props[r.prop],
        registerHint: row.registerStr,
        bitRanges: [{ from: g, to: g }],
      });
      continue;
    }

    const wordOff = r.pduStart - minPdu;
    const byteStart = wordOff * 2;
    const byteLen = r.words * 2;
    if (byteStart < 0 || byteStart + byteLen > dataLen) {
      warnings.push(`「${r.prop}」推算字节 [${byteStart}, ${byteStart + byteLen}) 超出数据区 ${dataLen} 字节`);
      continue;
    }
    segments.push({
      propertyId: r.prop,
      byteStart,
      byteLen,
      tone: t,
      displayValue: formatDecodePropValue(props[r.prop]),
      rawValue: props[r.prop],
      registerHint: row.registerStr,
    });
  }

  return { segments, minPdu, unmappedProps: unmapped, warnings };
}

function buildCoilDecodeSegments(
  props: Record<string, unknown>,
  mapRows: ModbusSimpleMapping[],
  dataLen: number,
  /** PDU 数据区第 0 位对应的线圈地址（0 基）；与读响应起始线圈一致；默认 0 */
  pduCoilBase: number,
): { segments: DecodeVisualSegment[]; minBitPdu: number; unmappedProps: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const acc: { prop: string; startBit: number; bitCount: number }[] = [];
  const unmapped: string[] = [];

  for (const k of Object.keys(props)) {
    const row = mapRows.find((m) => m.property === k);
    if (!row) {
      unmapped.push(k);
      continue;
    }
    const p = doParseRegisterStr(row.registerStr);
    if (!p) {
      unmapped.push(k);
      continue;
    }
    const zone = ZONE_INFO[p.type];
    if (!zone || zone.addressing !== 'bit') {
      unmapped.push(k);
      continue;
    }
    acc.push({ prop: k, startBit: p.address, bitCount: Math.max(1, p.count) });
  }

  if (!acc.length) {
    return { segments: [], minBitPdu: pduCoilBase, unmappedProps: [...Object.keys(props)], warnings };
  }

  const maxPduBit = dataLen * 8 - 1;
  const segments: DecodeVisualSegment[] = [];
  let tone = 0;
  for (const r of [...acc].sort((a, b) => a.startBit - b.startBit)) {
    const g0 = r.startBit - pduCoilBase;
    const g1 = g0 + r.bitCount - 1;
    if (g1 < 0 || g0 > maxPduBit) {
      warnings.push(
        `「${r.prop}」线圈 ${r.startBit}–${r.startBit + r.bitCount - 1} 与当前 PDU 数据区（起始线圈 ${pduCoilBase}，共 ${dataLen} 字节）无交集`,
      );
      continue;
    }
    const clip0 = Math.max(0, g0);
    const clip1 = Math.min(maxPduBit, g1);
    const byteStart = Math.floor(clip0 / 8);
    const byteEnd = Math.floor(clip1 / 8);
    const byteLen = byteEnd - byteStart + 1;
    if (byteStart < 0 || byteStart + byteLen > dataLen) {
      warnings.push(`「${r.prop}」位范围对应字节超出数据区`);
      continue;
    }
    const row = mapRows.find((m) => m.property === r.prop)!;
    segments.push({
      propertyId: r.prop,
      byteStart,
      byteLen,
      tone: tone % 8,
      displayValue: formatDecodePropValue(props[r.prop]),
      rawValue: props[r.prop],
      registerHint: row.registerStr,
      bitRanges: [{ from: clip0, to: clip1 }],
    });
    tone++;
  }

  return { segments, minBitPdu: pduCoilBase, unmappedProps: unmapped, warnings };
}

/** 将段映射为字节级与位级色号；无 bitRanges 时整字节 8 位同色 */
function applySegmentsToMatrices(
  dataLen: number,
  segments: DecodeVisualSegment[],
  existingWarnings: string[],
): { byteTone: number[]; bitTone: number[][]; warnings: string[] } {
  const warnings = [...existingWarnings];
  const bitTone: number[][] = Array.from({ length: dataLen }, () => new Array(8).fill(-1));

  for (const seg of segments) {
    const paintBit = (g: number) => {
      const bi = Math.floor(g / 8);
      const bj = g % 8;
      if (bi < 0 || bi >= dataLen) return;
      if (bitTone[bi][bj] !== -1 && bitTone[bi][bj] !== seg.tone) {
        warnings.push(`位 ${g}（B${bi}·b${bj}）被多属性覆盖`);
      }
      bitTone[bi][bj] = seg.tone;
    };

    if (seg.bitRanges?.length) {
      for (const br of seg.bitRanges) {
        for (let g = br.from; g <= br.to; g++) {
          paintBit(g);
        }
      }
    } else {
      for (let i = 0; i < seg.byteLen; i++) {
        const idx = seg.byteStart + i;
        if (idx < 0 || idx >= dataLen) continue;
        for (let bj = 0; bj < 8; bj++) {
          paintBit(idx * 8 + bj);
        }
      }
    }
  }

  const byteTone = new Array(dataLen).fill(-1);
  for (let bi = 0; bi < dataLen; bi++) {
    const filled = bitTone[bi].filter((t) => t >= 0);
    if (!filled.length) continue;
    const unique = new Set(filled);
    if (unique.size === 1) byteTone[bi] = filled[0];
    else byteTone[bi] = -1;
  }

  return { byteTone, bitTone, warnings };
}

function decodeSegmentRangeLabel(seg: DecodeVisualSegment, pduCoilBase = 0): string {
  if (seg.bitRanges?.length) {
    const r = seg.bitRanges[0];
    const c0 = r.from + pduCoilBase;
    const c1 = r.to + pduCoilBase;
    if (r.from === r.to) {
      return pduCoilBase ? `PDU位#${r.from} · 线圈#${c0}` : `位#${r.from}`;
    }
    return pduCoilBase
      ? `PDU位 ${r.from}–${r.to} · 线圈 ${c0}–${c1}`
      : `位 ${r.from}–${r.to}`;
  }
  if (seg.byteLen <= 1) return `B${seg.byteStart}`;
  return `B${seg.byteStart}–${seg.byteStart + seg.byteLen - 1}`;
}

/** 全局位下标 g（相对 PDU 数据区）是否属于该映射段 */
function segmentCoversGlobalBit(seg: DecodeVisualSegment, g: number): boolean {
  if (seg.bitRanges?.length) {
    return seg.bitRanges.some((br) => g >= br.from && g <= br.to);
  }
  const bi = Math.floor(g / 8);
  return bi >= seg.byteStart && bi < seg.byteStart + seg.byteLen;
}

function segmentCoversBitIndex(seg: DecodeVisualSegment, bi: number, bj: number): boolean {
  return segmentCoversGlobalBit(seg, bi * 8 + bj);
}

/** 映射段是否与字节区间 [biMin, biMax] 有交集（用于寄存器外框悬停） */
function segmentTouchesByteRange(seg: DecodeVisualSegment, biMin: number, biMax: number): boolean {
  if (seg.bitRanges?.length) {
    for (const br of seg.bitRanges) {
      for (let g = br.from; g <= br.to; g++) {
        const bi = Math.floor(g / 8);
        if (bi >= biMin && bi <= biMax) return true;
      }
    }
    return false;
  }
  for (let i = 0; i < seg.byteLen; i++) {
    const bi = seg.byteStart + i;
    if (bi >= biMin && bi <= biMax) return true;
  }
  return false;
}

/** 多属性覆盖同一全局位时，不画位值/悬停边框 */
function buildGlobalBitOverlapSet(segments: DecodeVisualSegment[]): Set<number> {
  const count = new Map<number, number>();
  for (const seg of segments) {
    const seen = new Set<number>();
    const add = (g: number) => {
      if (seen.has(g)) return;
      seen.add(g);
      count.set(g, (count.get(g) ?? 0) + 1);
    };
    if (seg.bitRanges?.length) {
      for (const br of seg.bitRanges) {
        for (let g = br.from; g <= br.to; g++) add(g);
      }
    } else {
      for (let i = 0; i < seg.byteLen; i++) {
        const idx = seg.byteStart + i;
        for (let bj = 0; bj < 8; bj++) add(idx * 8 + bj);
      }
    }
  }
  const overlap = new Set<number>();
  for (const [g, c] of count.entries()) {
    if (c > 1) overlap.add(g);
  }
  return overlap;
}

type DecodeVisualPayload =
  | {
      kind: 'grid';
      fc: number;
      fcLabel: string;
      pduKind: 'word' | 'bit';
      data: number[];
      segments: DecodeVisualSegment[];
      byteTone: number[];
      /** 每字节 8 位色号，下标 0=LSB（bit0）…7=MSB（bit7） */
      bitTone: number[][];
      unmappedProps: string[];
      warnings: string[];
      minPdu: number;
    }
  | {
      kind: 'fallback';
      props: Record<string, unknown>;
      data: number[];
      fc: number;
      fcLabel: string;
      note?: string;
    };

const decodeVisualPayload = computed((): DecodeVisualPayload | null => {
  const dr = decodeResult.value;
  if (!dr?.success || !Array.isArray(dr.outputs)) return null;
  const props = mergeReportProperties(dr.outputs);
  if (!Object.keys(props).length) return null;
  const bytes = decodeInputNormalized.value.bytes;
  if (!bytes.length) return null;
  const ext = extractModbusResponseDataBytes(bytes, modbusLinkType.value);
  if (!ext?.data.length) {
    return {
      kind: 'fallback',
      props,
      data: [],
      fc: 0,
      fcLabel: '—',
      note: '无法从当前帧中解析读响应数据区（请确认 FC01/02/03/04 响应格式与链路类型）',
    };
  }
  const { data, fc } = ext;
  const fcLabel = FC_NAMES[fc] || `功能码 0x${fc.toString(16)}`;

  if (fc === 0x03 || fc === 0x04) {
    const { segments, warnings, unmappedProps, minPdu } = buildRegisterDecodeSegments(
      props,
      mappings.value,
      data.length,
    );
    const { byteTone, bitTone, warnings: w2 } = applySegmentsToMatrices(data.length, segments, warnings);
    if (segments.length) {
      return {
        kind: 'grid',
        fc,
        fcLabel,
        pduKind: 'word',
        data,
        segments,
        byteTone,
        bitTone,
        unmappedProps,
        warnings: w2,
        minPdu,
      };
    }
    return {
      kind: 'fallback',
      props,
      data,
      fc,
      fcLabel,
      note: '未能将寄存器映射与 PDU 数据区对齐（需映射为 3x/4x 字寄存器且地址与响应中寄存器块一致）',
    };
  }

  if (fc === 0x01 || fc === 0x02) {
    const { segments, warnings, unmappedProps, minBitPdu } = buildCoilDecodeSegments(
      props,
      mappings.value,
      data.length,
      decodePduCoilBase.value,
    );
    const { byteTone, bitTone, warnings: w2 } = applySegmentsToMatrices(data.length, segments, warnings);
    if (segments.length) {
      return {
        kind: 'grid',
        fc,
        fcLabel,
        pduKind: 'bit',
        data,
        segments,
        byteTone,
        bitTone,
        unmappedProps,
        warnings: w2,
        minPdu: minBitPdu,
      };
    }
    return {
      kind: 'fallback',
      props,
      data,
      fc,
      fcLabel,
      note: '未能将线圈/离散映射与 PDU 数据区对齐（需映射为 0x/1x 位地址）',
    };
  }

  return {
    kind: 'fallback',
    props,
    data,
    fc,
    fcLabel,
    note: '当前功能码暂不做字节对齐，仅展示属性列表',
  };
});

function hoveredDecodeSegment(): DecodeVisualSegment | null {
  const p = decodeVisualPayload.value;
  const id = decodeHoverSegmentId.value;
  if (!p || p.kind !== 'grid' || !id) return null;
  return p.segments.find((s) => s.propertyId === id) ?? null;
}

/** 读响应 PDU 数据区字节（与映射解码使用同一提取逻辑），用于未解码时的字节条 */
const decodePduStrip = computed((): { data: number[]; fc: number } | null => {
  const bytes = decodeInputNormalized.value.bytes;
  if (!bytes.length) return null;
  const ext = extractModbusResponseDataBytes(bytes, modbusLinkType.value);
  if (!ext?.data.length) return null;
  return ext;
});

/** 解码成功且可展示网格映射（着色 + 属性行） */
const decodeShowMappingGrid = computed(
  () =>
    !!decodeResult.value?.success && decodeVisualPayload.value?.kind === 'grid',
);

/** 被多段映射覆盖的全局位下标（不展示这些位的值边框与悬停圈选） */
const decodeBitOverlapSet = computed(() => {
  const p = decodeVisualPayload.value;
  if (!p || p.kind !== 'grid') return new Set<number>();
  return buildGlobalBitOverlapSet(p.segments);
});

/** 保持/输入寄存器：每 2 字节一个字，外层寄存器框 */
const decodeWordRegisterGroups = computed(() => {
  const p = decodeVisualPayload.value;
  if (!p || p.kind !== 'grid' || p.pduKind !== 'word') {
    return [] as { start: number; bytes: number[] }[];
  }
  const out: { start: number; bytes: number[] }[] = [];
  const d = p.data;
  for (let i = 0; i < d.length; i += 2) {
    out.push({ start: i, bytes: d.slice(i, i + 2) });
  }
  return out;
});

/** 悬停属性行：高亮对应寄存器外框（字=2 字节，位=单字节块） */
function decodeRegWrapHoverClass(pduKind: 'word' | 'bit', regIndex: number): string {
  if (!decodeHoverSegmentId.value) return '';
  const seg = hoveredDecodeSegment();
  if (!seg) return '';
  if (pduKind === 'word') {
    const bi0 = regIndex * 2;
    const bi1 = bi0 + 1;
    return segmentTouchesByteRange(seg, bi0, bi1) ? 'dvm-reg-wrap--hover' : '';
  }
  return segmentTouchesByteRange(seg, regIndex, regIndex) ? 'dvm-reg-wrap--hover' : '';
}

/**
 * PDU 单个字节的 Hex 底色类：
 * - 该字节 8 位同属一个映射段 → byteTone≥0，用对应 dvm-t-n；
 * - 同一字节内多位分属不同属性（多种色号）→ byteTone=-1 但 bitTone 已有着色 → 用 dvm-byte-hex--mixed（实线），避免误用 dvm-t-x 虚线；
 * - 整字节均未映射 → dvm-t-x（虚线表示未参与映射）。
 */
function decodeByteHexSurfaceClass(bi: number): string {
  const p = decodeVisualPayload.value;
  if (!p || p.kind !== 'grid') return 'dvm-t-x';
  const bt = p.byteTone[bi];
  if (bt >= 0) return `dvm-t-${bt}`;
  const row = p.bitTone[bi];
  if (!row) return 'dvm-t-x';
  const hasMappedBit = row.some((t) => t >= 0);
  if (hasMappedBit) return 'dvm-byte-hex--mixed';
  return 'dvm-t-x';
}

/** 位在字节内的值（bj：0=LSB … 7=MSB），用于细边框区分 0/1；重叠位不画 */
function decodeBitValueClass(byteVal: number, bj: number, globalOverlap?: boolean): string {
  if (globalOverlap === true) return '';
  const bit = (byteVal >> bj) & 1;
  return bit ? 'dvm-bit-val-1' : 'dvm-bit-val-0';
}

function decodeBitCellClass(bi: number, bj: number): string {
  const p = decodeVisualPayload.value;
  const byteVal = p?.kind === 'grid' ? (p.data[bi] ?? 0) : 0;
  const g = bi * 8 + bj;
  const ov = decodeBitOverlapSet.value.has(g);
  const vCls = decodeBitValueClass(byteVal, bj, ov);
  if (!p || p.kind !== 'grid') return `dvm-bit dvm-t-x ${vCls}`.trim();
  const t = p.bitTone[bi]?.[bj];
  const bt = p.byteTone[bi];
  let cls: string;
  if (t !== undefined && t >= 0) cls = `dvm-bit dvm-t-${t} ${vCls}`.trim();
  else if (bt >= 0) cls = `dvm-bit dvm-t-${bt} ${vCls}`.trim();
  else cls = `dvm-bit dvm-t-x ${vCls}`.trim();
  const h = hoveredDecodeSegment();
  // 按字：仅寄存器外框高亮；按位：寄存器框 + 对应位（下边框）
  if (p.pduKind === 'bit' && h && segmentCoversBitIndex(h, bi, bj) && !ov) cls += ' dvm-bit--hover-sel';
  return cls;
}

/**
 * 编码调试：按链路类型剥离 TCP MBAP / RTU CRC 后，用下行 PDU 解析器解释（与后端 encode 输出一致）。
 */
function parseEncodeDownlinkFrame(fullBytes: number[], link: 'PDU' | 'TCP' | 'RTU'): ModbusParseView | null {
  const pdu = stripToPduBytes(fullBytes, link);
  if (!pdu || pdu.length < 2) return null;
  const inner = parseModbusDownlinkPdu(pdu);
  if (!inner) return null;
  if (link === 'PDU') {
    return { ...inner, linkTypeLabel: 'Modbus PDU · 下行请求' };
  }
  if (link === 'TCP') {
    if (fullBytes.length < 8) return { ...inner, linkTypeLabel: 'Modbus TCP · 下行请求' };
    const tid = (fullBytes[0] << 8) | fullBytes[1];
    const mbapLen = (fullBytes[4] << 8) | fullBytes[5];
    const unit = fullBytes[6];
    const tcpHeader = `事务 ${tid} · 协议标识 0 · 长度 ${mbapLen} · 单元 ${unit}`;
    return { ...inner, linkTypeLabel: 'Modbus TCP · 下行请求', tcpHeader };
  }
  const crcRx = fullBytes[fullBytes.length - 2] | (fullBytes[fullBytes.length - 1] << 8);
  const crcCalc = crc16Modbus(fullBytes, 0, fullBytes.length - 2);
  const crcOk = crcCalc === crcRx;
  const crcLine = `CRC 接收 0x${(crcRx & 0xff).toString(16).padStart(2, '0').toUpperCase()} ${((crcRx >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase()}（低字节在前）· 计算 0x${(crcCalc & 0xff).toString(16).padStart(2, '0').toUpperCase()} ${((crcCalc >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase()}${crcOk ? ' ✓' : ' ✗'}`;
  const warnings = [...(inner.warnings || [])];
  if (!crcOk) {
    warnings.push('RTU：CRC 与计算值不一致');
  }
  return { ...inner, linkTypeLabel: 'Modbus RTU · 下行请求', crcLine, crcOk, warnings };
}

/** 编码调试：将接口返回的连续 Hex（可能含多帧拼接）拆段后逐段解析 */
const encodeDebugSegments = computed((): { hex: string; analysis: ModbusParseView | null }[] => {
  const r = encodeResult.value;
  if (!r?.success || !Array.isArray(r.frames)) return [];
  const link = modbusLinkType.value;
  const allBytes = r.frames.flatMap((fr: string) => hexLineToBytes(String(fr ?? '')));
  if (allBytes.length < 2) return [];
  const wireChunks = splitEncodePayloadToWireSegments(allBytes, link);
  return wireChunks.map((seg) => ({
    hex: bytesToHexSpaced(seg),
    analysis: parseEncodeDownlinkFrame(seg, link),
  }));
});

const canFillToMapping = computed(() => {
  const a = decodeFrameAnalysis.value;
  if (!a || a.isException) return false;
  if (a.fcCode === 0x03 || a.fcCode === 0x04) return (a.wordRegisterCount ?? 0) >= 1;
  if (a.fcCode === 0x01 || a.fcCode === 0x02) return (a.byteCount ?? 0) >= 1;
  return false;
});

const fillModalCoilMode = computed(() => {
  const a = decodeFrameAnalysis.value;
  return !!a && !a.isException && (a.fcCode === 0x01 || a.fcCode === 0x02);
});

const fillModalWordCount = computed(() => decodeFrameAnalysis.value?.wordRegisterCount ?? 0);

/** FC03/04 且数据区含 2 个及以上寄存器 */
const fillModalMultiWord = computed(() => {
  const a = decodeFrameAnalysis.value;
  return !!a && !a.isException && (a.fcCode === 0x03 || a.fcCode === 0x04) && (a.wordRegisterCount ?? 0) > 1;
});

/** 线圈/离散：结束位大于起始位时提示可多映射 */
const fillCoilMultiBit = computed(() => {
  if (!fillModalCoilMode.value) return false;
  const s = fillPduStart.value ?? 0;
  const e = fillCoilEndPdu.value ?? 0;
  return e > s;
});

const fillModalOkText = computed(() => {
  if (fillModalMultiWord.value && fillWordMergeMode.value === 'split') {
    return `添加 ${fillModalWordCount.value} 行`;
  }
  return '添加一行';
});

/** 单个保持/输入寄存器的地址串（用于拆分填充） */
function buildSingleWordRegisterStr(fcCode: number, pduAddr: number, slave: number): string {
  const plc = fillAddressFormat.value === 'plc';
  if (plc) {
    const type = fcCode === 0x03 ? 'HoldingRegisters' : 'InputRegisters';
    const std = getStandardAddress(type, pduAddr);
    return slave !== 1 ? `${slave}:${std}` : std;
  }
  const tc = fcCode === 0x03 ? 3 : 4;
  const str = `${tc}_${pduAddr}`;
  return slave !== 1 ? `${slave}:${str}` : str;
}

const fillSplitPreviewSample = computed(() => {
  if (!fillModalMultiWord.value || fillWordMergeMode.value !== 'split') return '';
  const a = decodeFrameAnalysis.value!;
  const n = a.wordRegisterCount ?? 0;
  const s = fillPduStart.value ?? 0;
  const slave = a.unitId;
  const lines: string[] = [];
  const maxShow = 8;
  for (let k = 0; k < Math.min(n, maxShow); k++) {
    lines.push(buildSingleWordRegisterStr(a.fcCode, s + k, slave));
  }
  if (n > maxShow) lines.push(`… 共 ${n} 行`);
  return lines.join('\n');
});

/** 根据弹窗状态生成映射表「寄存器地址」字符串（PLC 或 FC 格式） */
function buildFillRegisterStrFromState(): string {
  const a = decodeFrameAnalysis.value;
  if (!a || a.isException) return '';
  const s = fillPduStart.value ?? 0;
  const slave = a.unitId;
  const plc = fillAddressFormat.value === 'plc';

  if (a.fcCode === 0x03 || a.fcCode === 0x04) {
    const n = a.wordRegisterCount ?? 0;
    if (n < 1) return '';
    const e = s + n - 1;
    if (plc) {
      const type = a.fcCode === 0x03 ? 'HoldingRegisters' : 'InputRegisters';
      const stdS = getStandardAddress(type, s);
      const stdE = getStandardAddress(type, e);
      let str = s === e ? stdS : `${stdS}-${stdE}`;
      if (slave !== 1) str = `${slave}:${str}`;
      return str;
    }
    const tc = a.fcCode === 0x03 ? 3 : 4;
    let str = `${tc}_${s}`;
    if (e > s) str += `-${e}`;
    if (slave !== 1) str = `${slave}:${str}`;
    return str;
  }

  if (a.fcCode === 0x01 || a.fcCode === 0x02) {
    const e = fillCoilEndPdu.value ?? 0;
    if (plc) {
      const type = a.fcCode === 0x01 ? 'Coils' : 'DiscreteInputs';
      const stdS = getStandardAddress(type, s);
      const stdE = getStandardAddress(type, e);
      let str = s === e ? stdS : `${stdS}-${stdE}`;
      if (slave !== 1) str = `${slave}:${str}`;
      return str;
    }
    const tc = a.fcCode === 0x01 ? 1 : 2;
    let str = `${tc}_${s}-${e}`;
    if (slave !== 1) str = `${slave}:${str}`;
    return str;
  }

  return '';
}

const fillMappingPreviewStr = computed(() => buildFillRegisterStrFromState());

function suggestCodecForWordCount(n: number): string {
  if (n === 1) return 'unsigned_int16';
  if (n === 2) return 'unsigned_int32';
  if (n === 4) return 'ieee754_float64';
  return '';
}

function openFillMappingModal() {
  if (!canFillToMapping.value) return;
  const a = decodeFrameAnalysis.value!;
  fillAddressFormat.value = 'plc';
  fillWordMergeMode.value = 'merge';
  fillPduStart.value = 0;
  if (a.fcCode === 0x01 || a.fcCode === 0x02) {
    const bc = a.byteCount ?? 1;
    fillCoilEndPdu.value = Math.max(0, bc * 8 - 1);
  } else {
    fillCoilEndPdu.value = 0;
  }
  fillModalOpen.value = true;
}

function confirmFillMapping() {
  const a = decodeFrameAnalysis.value;
  if (!a || !canFillToMapping.value) {
    fillModalOpen.value = false;
    return Promise.resolve();
  }
  const s = fillPduStart.value ?? 0;

  if (a.fcCode === 0x03 || a.fcCode === 0x04) {
    const n = a.wordRegisterCount ?? 0;
    if (n < 1) {
      message.warning('无法推断寄存器字数');
      return Promise.reject();
    }

    if (n > 1 && fillWordMergeMode.value === 'split') {
      for (let k = 0; k < n; k++) {
        const pdu = s + k;
        const registerStr = buildSingleWordRegisterStr(a.fcCode, pdu, a.unitId);
        const row: ModbusSimpleMapping = {
          property: '',
          registerStr,
          codec: 'unsigned_int16',
          layout: '',
          scaleFactor: 1,
          scale: -1,
          readable: true,
          writable: true,
        };
        autoFillLayout(row);
        mappings.value.push(row);
      }
      message.success(`已添加 ${n} 行映射（每寄存器一行），请逐行补全属性标识`);
      fillModalOpen.value = false;
      nextTick(() => {
        document.querySelector('.mm-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return Promise.resolve();
    }

    const registerStr = buildFillRegisterStrFromState();
    if (!registerStr) {
      message.warning('无法生成地址串');
      return Promise.reject();
    }
    const row: ModbusSimpleMapping = {
      property: '',
      registerStr,
      codec: suggestCodecForWordCount(n),
      layout: '',
      scaleFactor: 1,
      scale: -1,
      readable: true,
      writable: true,
    };
    autoFillLayout(row);
    mappings.value.push(row);
    message.success(
      n > 1
        ? '已合并为一条范围映射；若需拆分可重新打开弹窗选择「拆分为多条」'
        : '已在映射表末尾新增一行，请补全属性标识'
    );
    fillModalOpen.value = false;
    nextTick(() => {
      document.querySelector('.mm-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return Promise.resolve();
  }

  if (a.fcCode === 0x01 || a.fcCode === 0x02) {
    const e = fillCoilEndPdu.value ?? 0;
    if (e < s) {
      message.warning('结束位地址须大于等于起始地址');
      return Promise.reject();
    }
    const registerStr = buildFillRegisterStrFromState();
    if (!registerStr) {
      message.warning('无法生成地址串');
      return Promise.reject();
    }
    const singleBit = e === s;
    const row: ModbusSimpleMapping = {
      property: '',
      registerStr,
      codec: singleBit ? 'bool' : 'lsb_bit_array',
      layout: '',
      scaleFactor: 1,
      scale: -1,
      readable: true,
      writable: true,
    };
    autoFillLayout(row);
    mappings.value.push(row);
    message.success('已新增线圈/离散映射行');
    fillModalOpen.value = false;
    nextTick(() => {
      document.querySelector('.mm-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return Promise.resolve();
  }
  fillModalOpen.value = false;
  return Promise.resolve();
}

// ==================== Debug: Decode ====================
let autoDecodeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 原始数据或映射变化时：在可识别为完整 Modbus 帧且已配置映射时自动调用解码 */
async function tryAutoDecode() {
  const raw = decodePayload.value.trim();
  const n = normalizeDecodeInput(raw);
  if (n.parseError || !n.bytes.length) {
    decodeResult.value = null;
    return;
  }
  if (!decodeFrameAnalysis.value) {
    decodeResult.value = null;
    return;
  }
  if (!configObject.value) {
    decodeResult.value = null;
    return;
  }
  decoding.value = true;
  decodeResult.value = null;
  try {
    const res: any = await testCode({
      provider: 'modbus',
      configuration: { mapping: configObject.value },
      payload: n.hexForApi,
    });
    if (res.status === 200) {
      decodeResult.value = res.result;
    }
  } finally {
    decoding.value = false;
  }
}

function scheduleAutoDecode() {
  if (autoDecodeDebounceTimer) clearTimeout(autoDecodeDebounceTimer);
  autoDecodeDebounceTimer = setTimeout(() => {
    autoDecodeDebounceTimer = null;
    void tryAutoDecode();
  }, 420);
}

watch(decodePayload, () => scheduleAutoDecode());
watch(decodePduCoilBase, () => scheduleAutoDecode());

watch(
  () => mappings.value,
  () => scheduleAutoDecode(),
  { deep: true },
);

// ==================== Debug: Encode ====================
const addEncodeInput = () => {
  encodeInputs.value.push({ property: '', value: '' });
};

const removeEncodeInput = (idx: number) => {
  encodeInputs.value.splice(idx, 1);
};

const runEncode = async () => {
  if (!configObject.value) {
    message.warning('请先配置映射关系');
    return;
  }

  if (encodeDebugMode.value === 'read') {
    const props = readEncodeProps.value.map((s) => String(s).trim()).filter(Boolean);
    if (!props.length) {
      message.warning('请先选择或输入要读取的属性标识');
      return;
    }
    encoding.value = true;
    encodeResult.value = null;
    try {
      const res: any = await encodeTest({
        provider: 'modbus',
        configuration: { mapping: configObject.value },
        message: { messageType: 'READ_PROPERTY', properties: props },
      });
      if (res.status === 200) {
        encodeResult.value = res.result;
      }
    } finally {
      encoding.value = false;
    }
    return;
  }

  const valid = encodeInputs.value.filter((i) => i.property);
  if (!valid.length) {
    message.warning('请先选择属性');
    return;
  }

  const properties: Record<string, any> = {};
  valid.forEach((item) => {
    const num = parseFloat(item.value);
    properties[item.property] = isNaN(num) ? item.value : num;
  });

  encoding.value = true;
  encodeResult.value = null;
  try {
    const res: any = await encodeTest({
      provider: 'modbus',
      configuration: { mapping: configObject.value },
      message: { messageType: 'WRITE_PROPERTY', properties },
    });
    if (res.status === 200) {
      encodeResult.value = res.result;
    }
  } finally {
    encoding.value = false;
  }
};

// ==================== Lifecycle ====================
function scheduleMeasureTableBody() {
  requestAnimationFrame(() => {
    measureTableBodyScrollY();
  });
}

onMounted(() => {
  loadMmSplitFromStorage();
  restoreModbusDebugDraft();
  loadConfig();
  nextTick(() => {
    scheduleMeasureTableBody();
    tableScrollResizeObserver = new ResizeObserver(() => scheduleMeasureTableBody());
    if (tableScrollEl.value) {
      tableScrollResizeObserver.observe(tableScrollEl.value);
    }
    scheduleAutoDecode();
  });
});

onUnmounted(() => {
  if (modbusDebugPersistTimer) {
    clearTimeout(modbusDebugPersistTimer);
    modbusDebugPersistTimer = null;
  }
  if (decodeSimDebounceTimer) {
    clearTimeout(decodeSimDebounceTimer);
    decodeSimDebounceTimer = null;
  }
  if (autoDecodeDebounceTimer) {
    clearTimeout(autoDecodeDebounceTimer);
    autoDecodeDebounceTimer = null;
  }
  persistModbusDebugDraft();
  tableScrollResizeObserver?.disconnect();
  tableScrollResizeObserver = null;
});

watch(
  () => [mappings.value.length, loading.value] as const,
  () => nextTick(() => scheduleMeasureTableBody()),
  { flush: 'post' }
);

watch(
  () => props.thingId,
  () => {
    restoreModbusDebugDraft();
  }
);

watch(
  () => instanceStore.current?.id,
  (id) => {
    if (id) {
      restoreModbusDebugDraft();
      decodeResult.value = null;
      encodeResult.value = null;
      loadConfig();
    }
  }
);

watch(modbusLinkType, () => {
  regenerateDecodeSimFrame();
});

defineExpose({
  loadConfig,
  saveConfig,
  addMapping,
  loading,
  saving,
});
</script>

<style scoped lang="less">
.mm-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-bottom: 16px;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.mm-action-header {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.mm-action-header-title {
  margin-right: 2px;
}

.mm-action-header-add {
  padding: 0 4px;
  height: auto;
  font-size: 12px;
}

.mm-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
}

.mm-main-left {
  flex: 0 0 auto;
  width: 62%;
  min-width: 260px;
  max-width: 85%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mm-link-type-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fafafa;
  font-size: 12px;
}

.mm-link-type-lbl {
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}

.mm-link-type-hint {
  color: rgba(0, 0, 0, 0.45);
  flex: 1 1 200px;
  min-width: 0;
  line-height: 1.45;
}

.mm-splitter {
  flex: 0 0 8px;
  width: 8px;
  cursor: col-resize;
  align-self: stretch;
  position: relative;
  z-index: 5;
  user-select: none;
  touch-action: none;
  background: transparent;
}

.mm-splitter::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 1px;
  background: #e0e0e0;
  transition: background 0.15s ease;
}

.mm-splitter:hover::after {
  background: #1890ff;
}

.mm-main-right {
  flex: 1 1 auto;
  min-width: min(280px, 32vw);
  width: auto;
  max-width: none;
  position: sticky;
  top: 12px;
  align-self: stretch;
  min-height: 0;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 4;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 1100px) {
  .mm-main {
    flex-direction: column;
  }

  .mm-main-left {
    width: 100% !important;
    max-width: none;
  }

  .mm-splitter {
    display: none;
  }

  .mm-main-right {
    position: static;
    min-width: 0;
    max-height: none;
    overflow-y: visible;
  }
}

.mm-table-scroll {
  width: 100%;
  min-width: 0;
  flex: 1;
  min-height: 0;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;

  :deep(.ant-table-wrapper) {
    border-radius: 6px;
  }

  :deep(.ant-table-header) {
    border-radius: 0;
  }

  /* 仅当表体内容高度超过 scroll.y 时出现纵向滚动条 */
  :deep(.ant-table-body) {
    overflow-y: auto !important;
  }
}

.mm-table {
  :deep(.ant-table-cell) {
    vertical-align: top;
    padding: 6px 8px !important;
  }
}

.cell-hint {
  margin-top: 2px;
  min-height: 18px;
  line-height: 1;
}

.mm-prop-desc {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.55);
  word-break: break-word;
}

.mm-prop-undef-hint {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.35;
  color: #d46b08;
}

.mm-prop-rw-tags {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.mm-rw-conflict-wrap {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: help;
}

.mm-rw-warn-icon {
  font-size: 13px;
  color: #ff4d4f;
}

/* 属性 Select：收起态与下拉项均为「大字名称 + 小字 id」同行展示 */
.mm-prop-select-dropdown {
  :deep(.ant-select-item-option-content) {
    width: 100%;
    min-width: 0;
  }

  .mm-prop-opt {
    display: flex;
    align-items: baseline;
    flex-wrap: nowrap;
    gap: 6px;
    min-width: 0;
  }

  .mm-prop-opt-name {
    font-size: 13px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.85);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mm-prop-opt-id {
    flex-shrink: 0;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    font-family: 'Consolas', 'Monaco', monospace;
  }
}

.mm-prop-ac-wrap {
  position: relative;
  width: 100%;
}

.mm-prop-ac-fake {
  position: absolute;
  left: 11px;
  right: 28px;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding-right: 4px;
  pointer-events: none;
  overflow: hidden;
  line-height: 28px;
}

.mm-prop-ac-fake-name {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.88);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mm-prop-ac-fake-id {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.38);
  font-family: 'Consolas', 'Monaco', monospace;
}

.mm-prop-ac--ghost :deep(.ant-input),
.mm-prop-ac--ghost :deep(input) {
  color: transparent !important;
  caret-color: rgba(0, 0, 0, 0.65);
}

.mm-prop-ac {
  :deep(.ant-select-selector) {
    min-height: 28px;
  }
}

// ── 寄存器地址结构化 hint ──────────────────────────────────────
.reg-hint {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.reg-hint-row1 {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 16px;
  flex-wrap: nowrap;
}

.reg-zone-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  font-family: 'Consolas', 'Monaco', monospace;
  line-height: 15px;
  flex-shrink: 0;
  white-space: nowrap;
}

.reg-zone-name {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
  white-space: nowrap;
}

.reg-addr-val {
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 600;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.82);
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.reg-slave {
  font-size: 10px;
  padding: 0 4px;
  background: #f5f5f5;
  border-radius: 3px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 14px;
  white-space: nowrap;
}

.reg-hint-row2 {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.38);
  line-height: 14px;
  flex-wrap: wrap;
}

.reg-hint-row3 {
  margin-top: 2px;
  font-size: 9px;
  line-height: 13px;
  color: rgba(0, 0, 0, 0.32);
  font-style: italic;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
}

.reg-hint-zone-explain {
  flex: 1 1 120px;
  min-width: 0;
}

.mm-reg-mask-tail {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  font-style: normal;
}

.mm-reg-mask-tail-lbl {
  font-size: 9px;
  color: rgba(0, 0, 0, 0.42);
  cursor: help;
  user-select: none;
  white-space: nowrap;
}

.mm-reg-mask-tail-sw {
  transform: scale(0.82);
  transform-origin: center center;
}

.reg-micro {
  font-style: italic;
  color: rgba(0, 0, 0, 0.28);
}

.reg-fc-badge {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 9px;
  padding: 0 3px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  color: rgba(0, 0, 0, 0.38);
  line-height: 12px;
  white-space: nowrap;
}

.reg-meta-sep {
  color: rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
}

// FC格式 inline 展示（用于 Row1 中 FC 代码）
.reg-fc-inline {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 10px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  flex-shrink: 0;
}

// 交叉解释标签（"Modbus" / "PLC"）
.reg-interp-label {
  font-size: 9px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.35);
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 13px;
}

// Row2 中小号地址值（PLC 交叉解释）
.reg-addr-val-sm {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.55);
  white-space: nowrap;
}

.reg-manual-badge {
  font-size: 9px;
  padding: 0 3px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 2px;
  color: #d46b08;
  line-height: 12px;
  white-space: nowrap;
}

.reg-hint-error {
  margin-top: 2px;
  font-size: 10px;
  color: #ff4d4f;
}

.codec-count-hint {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.35);
  font-style: italic;
}

/* 表格：解析列 — 类型 / 布局 同一行 + 缩放/小数摘要 */
.mm-codec-layout-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.mm-parse-inline-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  width: 100%;
}

.mm-parse-label--inline {
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
  text-align: left;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
}

.mm-parse-inline-sel {
  flex: 1 1 76px;
  min-width: 56px;
  max-width: 118px;
}

.mm-parse-inline-sel--layout {
  max-width: 76px;
}

.mm-parse-inline-sel :deep(.ant-select-selection-item),
.mm-parse-inline-sel :deep(.ant-select-selection-placeholder) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mm-parse-layout-dash {
  font-size: 12px;
  color: #bfbfbf;
  padding: 0 4px;
}

.mm-parse-scale-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 2px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1.35;
  margin-top: 2px;
}

.mm-parse-scale-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
}

.mm-parse-scale-lbl {
  flex: 0 0 auto;
  color: rgba(0, 0, 0, 0.38);
  cursor: help;
  user-select: none;
}

.mm-parse-scale-inn {
  flex: 0 1 auto;
  min-width: 0;
  padding: 0 !important;
  font-size: 11px !important;
  line-height: 1.35 !important;
  color: rgba(0, 0, 0, 0.75) !important;
  background: transparent !important;
  border-radius: 2px;
  transition: background 0.15s ease;
}

.mm-parse-scale-inn:hover,
.mm-parse-scale-inn.ant-input-number-focused {
  background: rgba(0, 0, 0, 0.04) !important;
}

.mm-parse-scale-inn--factor {
  width: 52px;
}

.mm-parse-scale-inn--scale {
  width: 40px;
}

.mm-parse-scale-inn :deep(.ant-input-number-input) {
  padding: 0 4px !important;
  height: 20px !important;
  text-align: left;
}

.mm-parse-scale-sep {
  margin: 0 3px;
  color: rgba(0, 0, 0, 0.25);
}

.mm-parse-hint {
  margin-left: 0;
  margin-top: 0;
}

/* 抽屉：解析（类型+布局一行，缩放/小数并入） */
.mm-drawer-parse-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mm-drawer-parse-inline {
  align-items: flex-start;
}

.mm-drawer-inline-lbl {
  flex: 0 0 auto;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
  line-height: 32px;
}

.mm-drawer-parse-type-sel {
  flex: 1 1 140px;
  min-width: 120px;
}

.mm-drawer-parse-layout-sel {
  flex: 1 1 100px;
  min-width: 88px;
  max-width: 140px;
}

.mm-drawer-layout-dash-input {
  flex: 0 0 48px;
  max-width: 56px;
}

.mm-drawer-mini-lbl {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 4px;
}

.mm-drawer-scale-row {
  margin-top: 4px;
}

.mm-drawer-sublabel-tip {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.4;
  margin: -2px 0 6px;
}

.drawer-reg-hint {
  margin-top: 6px;
}

.cell-na {
  color: #bfbfbf;
  font-size: 12px;
}

.mm-debug {
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  overflow: hidden;

  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
    padding: 0 8px;
    background: #fafafa;
  }
}

.debug-body {
  padding: 12px 16px;
}

.decode-debug-wrap {
  padding: 0;
}

.decode-sim-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 6px;
  margin-bottom: 6px;
  padding: 3px 4px;
  background: transparent;
  border: none;
  border-radius: 2px;
}

.decode-sim-title {
  font-size: 11px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.4);
  flex: 0 0 auto;
}

.decode-sim-addr-input {
  flex: 0 1 140px;
  min-width: 0;
  max-width: 160px;
}

.decode-sim-addr-input :deep(.ant-input),
.decode-sim-addr-input :deep(.ant-input-affix-wrapper input.ant-input) {
  font-size: 11px;
  line-height: 1.35;
}

.decode-sim-addr-input :deep(.ant-input-affix-wrapper) {
  padding: 0 6px;
  min-height: 22px;
  border-color: #f0f0f0;
  background: rgba(0, 0, 0, 0.02);
}

.decode-sim-addr-input :deep(.ant-input-affix-wrapper:hover),
.decode-sim-addr-input :deep(.ant-input-affix-wrapper-focused) {
  border-color: #e6e6e6;
}

.decode-sim-hex-preview {
  flex: 1 1 80px;
  min-width: 0;
  font-size: 10px;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.38);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1px 4px;
  background: transparent;
  border-radius: 2px;
  border: 1px dashed #eee;
}

.decode-sim-actions {
  flex: 0 0 auto;
}

.decode-sim-icon-btn {
  color: rgba(0, 0, 0, 0.28);
  padding: 0;
  height: 20px;
  width: 22px;
  min-width: 22px;
  font-size: 12px;
  line-height: 1;
}

.decode-sim-icon-btn:hover {
  color: rgba(0, 0, 0, 0.5);
}

.decode-sim-icon-btn :deep(.anticon) {
  font-size: 11px;
}

.decode-sim-error {
  font-size: 10px;
  color: #ff7875;
  margin: 0 0 6px;
}

.decode-sim-meta {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.38);
  margin: 0 0 6px;
  line-height: 1.35;
}

.encode-debug-wrap {
  padding: 0;
}

.encode-read-hint {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.45;
}

.encode-parse-frame-block {
  margin-bottom: 12px;
}

.encode-parse-frame-title {
  font-size: 11px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.65);
  margin-bottom: 4px;
}

.encode-full-hex {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
}

.encode-full-hex-lbl {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  flex-shrink: 0;
}

.encode-full-hex-code {
  font-size: 11px;
  line-height: 1.5;
  word-break: break-all;
  color: rgba(0, 0, 0, 0.85);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.decode-debug-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 1fr);
  gap: 16px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

/* 右侧固定栏较窄，解码区改为上下布局避免两列挤压 */
.mm-main-right .decode-debug-grid {
  grid-template-columns: 1fr;
}

.decode-debug-col {
  min-width: 0;
}

/* 左侧原始数据区略窄，避免占满整列 */
.decode-debug-input {
  max-width: min(100%, 360px);
}

.decode-textarea {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
}

.decode-textarea--compact :deep(textarea.ant-input) {
  min-height: 52px;
  max-height: 140px;
  resize: vertical;
  line-height: 1.45;
  padding-top: 6px;
  padding-bottom: 6px;
}

.decode-auto-hint {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.38);
}

.decode-pdu-coil-base {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #f0f0f0;
}

.decode-pdu-coil-base-lbl {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

.decode-pdu-coil-base-inn {
  width: 112px !important;
}

.decode-pdu-coil-base-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
  line-height: 1;
  color: rgba(0, 0, 0, 0.35);
  border: 1px solid #f0f0f0;
  cursor: default;
  user-select: none;
}

.decode-input-meta {
  margin-top: 6px;
  min-height: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.decode-input-meta--error {
  min-height: auto;
}

.decode-byte-len {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
}

.decode-parse-warn {
  font-size: 11px;
  color: #ff4d4f;
}

.decode-parse-empty {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px dashed #e8e8e8;
  line-height: 1.5;
}

.decode-parse-err {
  color: #cf1322;
  border-color: #ffccc7;
  background: #fff2f0;
}

.modbus-parse-card {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  line-height: 1.35;
}

.modbus-parse-compact {
  padding: 6px 8px;
  font-size: 11px;
}

.mp-compact-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.mp-tag-tight {
  margin: 0 !important;
  line-height: 18px !important;
  padding: 0 5px !important;
  font-size: 10px !important;
}

.mp-head-meta {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.75);
}

.mp-compact-line {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.mp-fade {
  opacity: 0.9;
}

.mp-compact-exc {
  color: #cf1322;
  font-size: 11px;
  padding: 4px 0;
}

.mp-compact-kv {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
  margin-bottom: 4px;
  font-size: 10px;
}

.mp-ck {
  color: rgba(0, 0, 0, 0.4);
}

.mp-cv {
  color: rgba(0, 0, 0, 0.75);
  font-weight: 500;
  margin-right: 4px;
}

.mp-hex-box {
  font-family: Consolas, monospace;
  font-size: 10px;
  line-height: 1.35;
  padding: 4px 6px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 2px;
  max-height: 48px;
  overflow: auto;
  word-break: break-all;
  margin-bottom: 4px;
}

.mp-reg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-bottom: 4px;
}

.mp-chip {
  font-size: 10px;
  padding: 0 5px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 2px;
  color: rgba(0, 0, 0, 0.65);
  font-family: Consolas, monospace;
}

.mp-coil-bits {
  font-family: Consolas, monospace;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.55);
  max-height: 56px;
  overflow: auto;
  line-height: 1.45;
  margin-bottom: 4px;
  word-break: break-all;
}

.mp-crc-line {
  font-size: 9px;
  color: rgba(0, 0, 0, 0.38);
  word-break: break-all;
  margin-top: 2px;
}

.mp-crc-bad {
  color: #cf1322 !important;
  font-weight: 500;
}

.mp-warn-tight {
  font-size: 9px;
  color: #d46b08;
  margin-top: 2px;
  line-height: 1.3;
}

.mp-fill-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #eee;
}

.mp-fill-hint {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.38);
  line-height: 1.35;
  flex: 1;
  min-width: 0;
}

.mp-mono {
  font-family: Consolas, monospace;
}

.fill-modal-tip {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
  margin-bottom: 8px;
  line-height: 1.5;
}

.fill-modal-form {
  margin-bottom: 0;
}

.fill-preview {
  padding: 6px 8px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 12px;
  word-break: break-all;
}

.fill-multi-reg-alert {
  margin-bottom: 10px;

  :deep(.ant-alert-description) {
    font-size: 12px;
    line-height: 1.5;
  }
}

.fill-preview-multi {
  margin: 0;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
  line-height: 1.45;
  padding: 6px 8px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 11px;
}

/* PDU 与映射融合区 */
.mp-pdu-fusion {
  margin-top: 6px;
  padding: 8px 8px 6px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.mp-pdu-fusion-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 6px;
  font-size: 11px;
  line-height: 1.4;
}

.mp-pdu-fusion-ttl {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.78);
}

.mp-pdu-fusion-meta {
  color: rgba(0, 0, 0, 0.45);
  font-weight: 400;
}

.mp-pdu-fusion-badge {
  font-size: 10px;
  padding: 0 6px;
  line-height: 18px;
  border-radius: 2px;
  border: 1px solid transparent;
}

.mp-pdu-fusion-badge--muted {
  color: rgba(0, 0, 0, 0.45);
  background: #fff;
  border-color: #f0f0f0;
}

.mp-pdu-fusion-badge--ok {
  color: #389e0d;
  background: rgba(82, 196, 26, 0.08);
  border-color: rgba(82, 196, 26, 0.25);
}

.mp-pdu-fusion-badge--warn {
  color: #d46b08;
  background: rgba(250, 173, 20, 0.1);
  border-color: rgba(250, 173, 20, 0.35);
}

.mp-pdu-fusion-badge--err {
  color: #cf1322;
  background: rgba(255, 77, 79, 0.08);
  border-color: rgba(255, 77, 79, 0.25);
}

.mp-pdu-fusion-foot {
  margin-top: 6px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.38);
  line-height: 1.35;
}

.mp-dvm-alert {
  margin-top: 6px;
  font-size: 12px;
}

.mp-dvm-alert--standalone {
  margin-top: 8px;
}

.dvm-byte-idx {
  text-align: center;
  font-size: 9px;
  color: rgba(0, 0, 0, 0.38);
  line-height: 1.2;
  margin-bottom: 2px;
  font-family: ui-monospace, monospace;
}

.dvm-byte-strip--plain {
  padding-top: 0;
}

.dvm-byte-bits--plain {
  opacity: 0.85;
}

.dvm-bit--plain {
  background: #f5f5f5 !important;
  /* 边框由 dvm-bit-val-0 / dvm-bit-val-1 按位值着色 */
}

.decode-json-details--in-card {
  margin-top: 8px;
}

.decode-visual-fallback--embedded {
  margin-top: 6px;
}

/* 解码结果：PDU 字节 ↔ 属性 同色对齐 */
.decode-visual-map {
  margin-top: 6px;
  padding: 8px 10px;
  background: #fbfbfb;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  overflow-x: auto;
}

.decode-visual-map--embedded {
  margin-top: 0;
  padding: 4px 0 0;
  background: transparent;
  border: none;
  border-radius: 0;
}

.dvm-subhead {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 4px;
  line-height: 1.45;
}

.dvm-sub-ttl {
  font-weight: 600;
}

.dvm-sub-meta {
  color: rgba(0, 0, 0, 0.45);
  font-weight: 400;
}

.dvm-hint {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.38);
  margin-bottom: 8px;
  line-height: 1.35;
}

.dvm-byte-strip {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: flex-start;
  overflow-x: auto;
  padding: 2px 0 4px;
}

/* 保持/输入：每行 4 个寄存器 = 8 字节，自动换行 */
.dvm-byte-strip--word {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 8px;
  width: 100%;
  overflow-x: visible;
  flex-wrap: unset;
}

.dvm-byte-strip--word .dvm-reg-wrap {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

/* 线圈/离散：每行 8 个字节，自动换行；单列加宽便于读 Hex 与位格 */
.dvm-byte-strip--bit {
  display: grid;
  grid-template-columns: repeat(8, minmax(112px, 1fr));
  gap: 14px 12px;
  width: 100%;
  overflow-x: visible;
  flex-wrap: unset;
}

/* 未解码预览：寄存器字数据按 8 字节换行 */
.dvm-byte-strip--word-plain {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px 8px;
  width: 100%;
  overflow-x: visible;
  flex-wrap: unset;
}

/* 保持/输入：字内两字节格拉满寄存器框，略增大 Hex/位格 */
.dvm-byte-strip--word .dvm-reg-inner {
  width: 100%;
}

.dvm-byte-strip--word .dvm-byte-cell {
  flex: 1 1 0;
  width: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.dvm-byte-strip--word .dvm-byte-hex {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 4px;
  font-size: 11px;
  min-height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dvm-byte-strip--word .dvm-byte-bits {
  width: 100%;
  justify-content: space-between;
  gap: 2px;
  margin-top: 4px;
}

.dvm-byte-strip--word .dvm-bit {
  flex: 1 1 0;
  min-width: 0;
  height: 12px;
}

/* 外层：寄存器/字节块细边框（字=2 字节，线圈=1 字节） */
.dvm-reg-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 3px 4px 4px;
  border: 1px solid rgba(0, 0, 0, 0.09);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.02);
}

.dvm-reg-wrap--coil {
  padding: 4px 6px 6px;
}

/* 仅加粗语义上的「现有」描边：保持与默认相同的 1px 盒阴影厚度，避免悬停时外圈变粗导致滚动区跳动 */
.dvm-reg-wrap--hover {
  border-color: rgba(24, 144, 255, 0.55) !important;
  background: rgba(24, 144, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(24, 144, 255, 0.38);
}

.dvm-reg-chip {
  font-size: 9px;
  line-height: 1;
  color: rgba(0, 0, 0, 0.38);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  user-select: none;
}

.dvm-reg-inner {
  display: flex;
  flex-direction: row;
  gap: 3px;
  align-items: flex-start;
}

.dvm-reg-inner--single {
  gap: 0;
  width: 100%;
}

.dvm-byte-cell {
  flex: 0 0 auto;
  width: 56px;
}

/* 线圈块内：字节格铺满列宽，Hex 与 8 位同宽 */
.dvm-byte-strip--bit .dvm-reg-wrap {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.dvm-byte-strip--bit .dvm-reg-inner--single,
.dvm-byte-strip--bit .dvm-byte-cell {
  width: 100%;
}

.dvm-byte-strip--bit .dvm-byte-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.dvm-byte-strip--bit .dvm-byte-hex {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 600;
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dvm-byte-strip--bit .dvm-byte-bits {
  width: 100%;
  justify-content: space-between;
  gap: 5px;
  margin-top: 6px;
}

.dvm-byte-strip--bit .dvm-bit {
  flex: 1 1 0;
  min-width: 0;
  height: 18px;
}

/* 线圈：位序号（MSB→LSB 与格对齐） */
.dvm-byte-strip--bit .dvm-bit-meta-row {
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
  gap: 5px;
  margin-top: 6px;
  align-items: center;
}

.dvm-byte-strip--bit .dvm-bit-idx-lbl {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
  font-size: 9px;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.38);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  user-select: none;
}

.dvm-byte-strip--plain .dvm-byte-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 0;
}

.dvm-byte-strip--plain .dvm-byte-hex {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 4px;
  font-size: 11px;
  min-height: 22px;
}

/* 未解码的读线圈/离散：与已映射区一致，单字节 Hex 加宽 */
.dvm-byte-strip--plain.dvm-byte-strip--bit .dvm-byte-hex {
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 600;
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dvm-byte-strip--plain .dvm-byte-bits {
  width: 100%;
  justify-content: space-between;
  gap: 3px;
  margin-top: 4px;
}

.dvm-byte-strip--plain .dvm-bit {
  flex: 1 1 0;
  min-width: 0;
  height: 14px;
}

.dvm-byte-strip--plain.dvm-byte-strip--bit .dvm-bit {
  height: 18px;
}

.dvm-byte-hex {
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  padding: 2px 1px;
  border-radius: 2px;
  border: 1px solid transparent;
  line-height: 1.2;
}

.dvm-byte-bits {
  display: flex;
  flex-direction: row;
  gap: 0;
  margin-top: 2px;
  justify-content: center;
}

.dvm-bit {
  box-sizing: border-box;
  width: 4px;
  min-width: 4px;
  height: 10px;
  border-radius: 1px;
  border: 0.5px solid transparent;
  flex-shrink: 0;
}

/* 按位（线圈）：位格以底色区分 0/1；下边框表示映射色号或悬停 */
.dvm-byte-strip--bit .dvm-bit {
  border: none !important;
  border-radius: 4px;
  border-bottom: 2px solid transparent !important;
  box-sizing: border-box;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-0 {
  border-bottom-color: rgba(22, 119, 255, 0.42) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-1 {
  border-bottom-color: rgba(82, 196, 26, 0.42) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-2 {
  border-bottom-color: rgba(250, 173, 20, 0.48) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-3 {
  border-bottom-color: rgba(196, 132, 255, 0.5) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-4 {
  border-bottom-color: rgba(19, 194, 194, 0.45) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-5 {
  border-bottom-color: rgba(255, 120, 117, 0.45) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-6 {
  border-bottom-color: rgba(0, 0, 0, 0.2) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-7 {
  border-bottom-color: rgba(47, 84, 235, 0.42) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-t-x {
  border-bottom-color: rgba(0, 0, 0, 0.08) !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-bit-val-0 {
  background: #e8e8e8 !important;
}

.dvm-byte-strip--bit .dvm-bit.dvm-bit-val-1 {
  background: #bae7ff !important;
}

/* 与默认同为 2px 底边，只改颜色，不增厚度、不加额外阴影，避免位格高度变化 */
.dvm-byte-strip--bit .dvm-bit.dvm-bit--hover-sel {
  border-bottom-color: rgba(250, 140, 22, 0.95) !important;
}

.dvm-prop-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dvm-prop-compact {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 8px;
  font-size: 10px;
  line-height: 1.35;
  padding: 2px 0;
  border-bottom: 1px dashed #f0f0f0;
}

.dvm-prop-compact:last-child {
  border-bottom: none;
}

.dvm-prop-compact--hover {
  background: rgba(24, 144, 255, 0.1);
  border-radius: 4px;
}

.dvm-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  margin-top: 3px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.dvm-prop-id {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.78);
  flex: 0 0 auto;
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dvm-prop-val {
  font-family: ui-monospace, monospace;
  color: rgba(0, 0, 0, 0.82);
  word-break: break-word;
  flex: 1 1 120px;
  min-width: 0;
}

.dvm-prop-meta {
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 9px;
  color: rgba(0, 0, 0, 0.42);
  padding-left: 13px;
}

.dvm-prop-range {
  font-family: ui-monospace, monospace;
}

.dvm-prop-reg {
  opacity: 0.85;
}

.dvm-warns {
  margin-top: 8px;
  font-size: 10px;
  color: #d46b08;
  line-height: 1.45;
}

.dvm-unmapped {
  margin-top: 6px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.45);
}

.dvm-t-x {
  background: #fafafa;
  border-color: #eee !important;
  color: rgba(0, 0, 0, 0.32);
}

.dvm-t-x.dvm-byte-hex {
  border-style: dashed;
}

/* 同字节内多个属性各占不同位：byteTone 无法取单一色号，用实线中性底，避免与「未映射」虚线混淆 */
.dvm-byte-hex.dvm-byte-hex--mixed {
  border-style: solid !important;
  border-color: #d9d9d9 !important;
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.78);
}

.dvm-t-0 {
  background: rgba(22, 119, 255, 0.09);
  border-color: rgba(22, 119, 255, 0.35);
  color: #0958d9;
}

.dvm-bit.dvm-t-0,
.dvm-dot.dvm-t-0 {
  background: rgba(22, 119, 255, 0.22);
  border-color: rgba(22, 119, 255, 0.45);
  color: transparent;
}

.dvm-t-1 {
  background: rgba(82, 196, 26, 0.1);
  border-color: rgba(82, 196, 26, 0.35);
  color: #389e0d;
}

.dvm-bit.dvm-t-1,
.dvm-dot.dvm-t-1 {
  background: rgba(82, 196, 26, 0.25);
  border-color: rgba(82, 196, 26, 0.45);
  color: transparent;
}

.dvm-t-2 {
  background: rgba(250, 173, 20, 0.12);
  border-color: rgba(250, 173, 20, 0.4);
  color: #d46b08;
}

.dvm-bit.dvm-t-2,
.dvm-dot.dvm-t-2 {
  background: rgba(250, 173, 20, 0.28);
  border-color: rgba(250, 173, 20, 0.5);
  color: transparent;
}

.dvm-t-3 {
  background: rgba(211, 131, 255, 0.12);
  border-color: rgba(211, 131, 255, 0.38);
  color: #722ed1;
}

.dvm-bit.dvm-t-3,
.dvm-dot.dvm-t-3 {
  background: rgba(211, 131, 255, 0.26);
  border-color: rgba(196, 132, 255, 0.55);
  color: transparent;
}

.dvm-t-4 {
  background: rgba(19, 194, 194, 0.1);
  border-color: rgba(19, 194, 194, 0.35);
  color: #08979c;
}

.dvm-bit.dvm-t-4,
.dvm-dot.dvm-t-4 {
  background: rgba(19, 194, 194, 0.24);
  border-color: rgba(19, 194, 194, 0.48);
  color: transparent;
}

.dvm-t-5 {
  background: rgba(255, 120, 117, 0.1);
  border-color: rgba(255, 120, 117, 0.38);
  color: #cf1322;
}

.dvm-bit.dvm-t-5,
.dvm-dot.dvm-t-5 {
  background: rgba(255, 120, 117, 0.24);
  border-color: rgba(255, 120, 117, 0.48);
  color: transparent;
}

.dvm-t-6 {
  background: rgba(140, 140, 140, 0.12);
  border-color: rgba(0, 0, 0, 0.14);
  color: rgba(0, 0, 0, 0.65);
}

.dvm-bit.dvm-t-6,
.dvm-dot.dvm-t-6 {
  background: rgba(0, 0, 0, 0.12);
  border-color: rgba(0, 0, 0, 0.22);
  color: transparent;
}

.dvm-t-7 {
  background: rgba(47, 84, 235, 0.1);
  border-color: rgba(47, 84, 235, 0.32);
  color: #2f54eb;
}

.dvm-bit.dvm-t-7,
.dvm-dot.dvm-t-7 {
  background: rgba(47, 84, 235, 0.22);
  border-color: rgba(47, 84, 235, 0.45);
  color: transparent;
}

/* 位实际值：细边框（重叠位不加此类） */
.dvm-bit.dvm-bit-val-0 {
  border-color: rgba(0, 0, 0, 0.12) !important;
}

.dvm-bit.dvm-bit-val-1 {
  border-color: rgba(24, 144, 255, 0.5) !important;
}

/* 按位时悬停圈选见 .dvm-byte-strip--bit .dvm-bit.dvm-bit--hover-sel */

.decode-visual-fallback {
  margin-top: 6px;
}

.dvm-fallback-alert :deep(.ant-alert-description) {
  margin-top: 6px;
}

.dvm-fallback-hex {
  font-size: 10px;
  word-break: break-all;
  margin-bottom: 8px;
  padding: 4px 6px;
  background: #fafafa;
  border-radius: 2px;
  line-height: 1.4;
}

.dvm-fallback-row {
  display: flex;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 4px;
  align-items: flex-start;
}

.dvm-fallback-k {
  flex: 0 0 auto;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
}

.dvm-fallback-v {
  flex: 1 1 auto;
  word-break: break-word;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.78);
}

.decode-json-details {
  margin-top: 10px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
}

.decode-json-details summary {
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
}

.decode-json-details .debug-output {
  margin-top: 6px;
  font-size: 11px;
  max-height: 220px;
  overflow: auto;
}

.debug-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  margin-bottom: 4px;
}

.debug-output {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.frame-label {
  display: inline-block;
  width: 44px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
}

.encode-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.encode-eq {
  color: rgba(0, 0, 0, 0.45);
  font-size: 14px;
  flex-shrink: 0;
}

.drawer-hint {
  margin-top: 4px;
}

.form-help {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 4px;
  line-height: 1.5;

  code {
    background: #f5f5f5;
    padding: 0 3px;
    border-radius: 2px;
    font-size: 11px;
    font-family: Consolas, monospace;
  }
}

.modbus-addr-guide {
  margin-top: 8px;
  padding: 8px 10px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;

  .guide-title {
    font-weight: 600;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.65);
    margin-bottom: 6px;
  }

  .guide-list {
    margin: 0;
    padding-left: 18px;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.55);
    line-height: 1.55;

    li {
      margin-bottom: 4px;
    }
  }

  .guide-foot {
    margin-top: 6px;
    font-size: 10px;
    color: rgba(0, 0, 0, 0.4);
    line-height: 1.45;
  }
}

/* 表格内：选项结构（弹出层样式见下方全局块） */
.mm-codec-opt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}
</style>

<style lang="less">
/* 解析器下拉挂载在 body，需全局样式 */
.mm-codec-select-dropdown.ant-select-dropdown {
  min-width: 280px !important;
  max-width: min(440px, 92vw);
}

.mm-codec-select-dropdown {
  .ant-select-item-option-content {
    white-space: normal !important;
  }

  .mm-codec-opt-title {
    font-weight: 600;
    font-size: 12px;
    line-height: 1.35;
    color: rgba(0, 0, 0, 0.88);
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .mm-codec-opt-desc {
    font-size: 11px;
    line-height: 1.45;
    color: rgba(0, 0, 0, 0.45);
  }

  .ant-select-item-option {
    padding-top: 8px;
    padding-bottom: 8px;
  }
}
</style>
