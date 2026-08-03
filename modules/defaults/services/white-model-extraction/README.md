# 区域管理白模提取

本目录收纳区域管理里的“平面图 → 白模结果”相关代码。

- `projectAreaWhiteModelExtraction.ts`：白模 job、候选结果、发布状态和复核信息的原型运行层。
- `generate-source-floorplan-white-model.mjs`：读取真实源平面图并生成当前单张源图纸白模。
- `generate-spatial-white-model.mjs`：历史高保真白模底图生成器，保留在这里作为区域管理白模提取资产的可复现脚本。

空间态势只消费区域管理发布后的白模 `imageUrl`，不在空间态势模块里生成白模。

