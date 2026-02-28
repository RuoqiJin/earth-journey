# 离线逐帧录制架构

## 问题

当前 `captureStream(fps)` + `MediaRecorder` 实时录制有固有缺陷：
- `setTimeout(1000/fps)` 无法保证精确帧间隔 → 卡顿
- 浏览器 GC、GPU 同步延迟导致掉帧
- 两套录制路径（透明用 PNG，普通用 WebM）维护成本高

## 方案

统一所有主题为 **逐帧离线渲染**：

1. `preserveDrawingBuffer: true` — 确保 `toBlob()` 可靠
2. 去掉 `captureStream` + `MediaRecorder`
3. 每帧：`scene.render()` → `canvas.toBlob('image/png')` → 流式上传
4. 帧间不 setTimeout，而是等渲染完成后立即捕获下一帧（离线模式无需实时）
5. 服务端 FFmpeg 组装：透明→ProRes 4444，普通→MP4 H.264

## 帧上传策略

逐帧 POST 到 `/api/frames` 避免内存堆积：
- `POST /api/frames/init` → 返回 sessionId
- `POST /api/frames/:sessionId/:frameNum` → 存 PNG 到 tmpdir
- `POST /api/frames/:sessionId/finalize` → FFmpeg 拼装 → 返回视频

## 改动

| 文件 | 改动 |
|------|------|
| GlobeViewer.tsx | contextOptions 加 preserveDrawingBuffer；统一录制为逐帧 toBlob；去掉 captureStream/MediaRecorder |
| api/convert-video/route.ts | 保留，用于最终 FFmpeg 转换 |
| api/frames/route.ts | 新增，帧流式上传 API |
