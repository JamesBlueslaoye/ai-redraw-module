# AI 重绘：功能、线路与 API 配置说明

> 整理日期：2026-07-14  
> 模块位置：Dashboard「模块 4 · AI 重绘」  
> 代码核心：`lib/nanoBanana.js`、`lib/aiRedrawHistory.js`、`lib/config.js`、`routes/api.js`、`assets/app.js`

---

## 1. 费用估算（Nano Banana 2）

你按实际账单估算：**每张图约消耗 12–16 积分**。平台报价：**1000 积分 = 5 美元 ≈ 35 人民币**。

| 项目 | 计算 | 结果 |
|------|------|------|
| 单积分（美元） | `5 ÷ 1000` | **$0.005** |
| 单积分（人民币） | `35 ÷ 1000` | **¥0.035** |
| 低耗（12 积分） | `12 × 0.005` / `12 × 0.035` | **约 $0.06 / ¥0.42** |
| 高耗（16 积分） | `16 × 0.005` / `16 × 0.035` | **约 $0.08 / ¥0.56** |
| **平均（按 14 积分）** | `14 × 0.005` / `14 × 0.035` | **约 $0.07 / ¥0.49** |

粗算产能：

- 按 12 积分/张：1000 积分 ≈ **83** 张
- 按 14 积分/张：1000 积分 ≈ **71** 张
- 按 16 积分/张：1000 积分 ≈ **62** 张

**结论：用 Nano Banana 2 重绘，平均大约 ¥0.45–0.55 / 张，中间值约 ¥0.5 / 张。**

> 实际扣费会随分辨率（1K / 1.5K / 2K）、提示词复杂度、失败重试等波动。费用以 [nanobananaapi.ai](https://nanobananaapi.ai) 账户账单为准。  
> 若选「通义千问」线路，走阿里云/百炼计费，不扣 Banana 积分。

---

## 2. 今天落地的能力概览

### 2.1 界面能力

| 能力 | 说明 |
|------|------|
| 线路切换 | **Nano Banana 2** / **通义千问**（后端按已配置 Key 显示可用线路） |
| 重绘方案 | `enhance` 光影质感 · `angle` 约 15° · `angle-45` 约 45° |
| 分辨率 | `auto` / `1024`(1K) / `1536`(1.5K，默认) / `2048`(2K)；**比例跟随原图**，不做固定裁剪 |
| 结果区加载 | 生成中右侧显示进度环，隐藏上一张结果，避免误以为「没在跑」 |
| 历史记录 | 按登录用户保存，源图 + 结果图；可回看、删除；单用户最多约 50 条 |

### 2.2 Banana 模型策略（重要）

当前 **只保留 Nano Banana 2**：

- 前端不再提供旧版 `nanobanana` / `nanobanana-pro`
- 后端 `nanobanana_ai` 线路强制模型名 `nanobanana-2`
- API 固定调用 `…/generate-2`（异步提交 + 轮询）

### 2.3 千问线路为何「会消失」又加回

之前默认 provider 切到 Banana、且界面「模型」下拉只服务 Banana 时，看起来像千问没了——其实 **Key 还在**，只是没有线路切换入口。

现在：

- 默认仍是 `AI_REDRAW_PROVIDER=nanobanana_ai`
- 只要 `.env` 里同时有 `NANO_BANANA_API_KEY` 与 `DASHSCOPE_API_KEY`，界面「线路」就能在两者间切换
- 请求体会带 `provider`，服务端按所选线路真正调用，而不是只改显示文案

---

## 3. Provider 与推荐用法

| Provider ID | 界面名 | 用途 | 现状 |
|-------------|--------|------|------|
| `nanobanana_ai` | Nano Banana 2 | 主推效果线路；国内可访问异步 API | **生产在用** |
| `qwen` | 通义千问 | 省 Banana 积分 / 备用 | **生产可用（需 Key）** |
| `proxy` | Pixapi / nanobananaapi.dev | 同步 edit | **易 524 超时**，平台可能仍扣积分，不推荐 |
| `google` | Google 直连 | Gemini Image | Mac/NAS 常超时，不可用 |
| `volcengine` | 火山方舟 | 备用代码路径 | 未作为日常线路开放 |

---

## 4. 环境变量（`.env`）

文件位置：

- 仓库模板：`.env.example`
- 正式配置（勿提交 Git）：`/Volumes/docker/pipeline/.env`（NAS）
- 本地开发：项目根目录 `.env`

### 4.1 关键配置项

```bash
# 默认线路
AI_REDRAW_PROVIDER=nanobanana_ai

# Nano Banana 2（nanobananaapi.ai）
NANO_BANANA_API_KEY=你的key
# 可选专用名（优先生效）：
# NANO_BANANA_AI_API_KEY=

# 通义千问
DASHSCOPE_API_KEY=你的key
QWEN_API_URL=https://…/multimodal-generation/generation   # 百炼自定义网关时填写
QWEN_MODEL=qwen-image-2.0                                  # 你当前百炼模型名
```

### 4.2 不要乱写的项

| 变量 | 注意 |
|------|------|
| `AI_REDRAW_API_URL` | **建议留空**。若误填阿里云地址，会污染 Banana 线路；若填非 `nanobananaapi.ai` 的地址，Banana 会回退默认官方 Base URL |
| `AI_REDRAW_MODEL` | Banana 线路已忽略，强制 `nanobanana-2`；千问请用 `QWEN_MODEL` |

### 4.3 配置加载机制（踩过的坑）

`lib/config.js` 启动时会执行 `loadEnvFile()`：

- **磁盘上的 `.env` 会覆盖** Docker 创建时注入进容器的旧环境变量
- 目的：避免「NAS 文件已改成 Banana，容器里还是 qwen」

因此：

1. 改 `.env` 后仍需 **重启 Node 进程 / 容器**（`require` 不会热更新）
2. 仅改 `assets/app.js` 等静态资源，若 volume 挂载，刷新页面即可；改 `lib/*` 必须重启

重启（在 NAS 上）：

```bash
cd /volume1/docker/pipeline && ./scripts/deploy-docker.sh
```

从 Mac 同步代码（**不会覆盖** NAS 上的 `.env`）：

```bash
bash scripts/deploy-to-nas.sh
```

---

## 5. Nano Banana 2 调用流程

代码：`redrawViaNanobananaAi`（`lib/nanoBanana.js`）

```
上传原图(base64)
    │
    ▼
临时外链：litterbox.catbox.moe（API 要求 imageUrls，不能只传 data URI）
    │
    ▼
POST  https://api.nanobananaapi.ai/api/v1/nanobanana/generate-2
      Authorization: Bearer <NANO_BANANA_API_KEY>
      body: prompt, imageUrls, aspectRatio, resolution, outputFormat, callBackUrl
    │
    ▼
拿到 taskId
    │
    ▼
轮询 GET …/record-info?taskId=…
      successFlag=1 → resultImageUrl
      2/3 → 失败
    │
    ▼
拉取结果图 → 返回 base64 → 写入用户历史
```

要点：

- **异步**：真实大图约几十秒（实测约 50s 量级），同步代理（`.dev`）易 524 且可能已扣费
- `callBackUrl` 目前占位为 `https://httpbin.org/post`（平台字段要求）；实际结果靠轮询获取
- `resolution` 映射自界面 1K / 1.5K / 2K；`aspectRatio` 由原图像素比例估算

Key 获取：<https://nanobananaapi.ai/api-key>

---

## 6. 通义千问调用流程

代码：`redrawViaQwen`

```
POST  <QWEN_API_URL 或 DashScope 默认>
Authorization: Bearer <DASHSCOPE_API_KEY>
body: model + multimodal messages（image data URI + text prompt）
      parameters: size / negative_prompt / watermark=false …
    │
    ▼
解析返回中的图片 URL 或 base64 → 写历史
```

默认官方 URL（未设 `QWEN_API_URL` 时）：

`https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`

当前 NAS 使用的是百炼自定义域名 + `QWEN_MODEL=qwen-image-2.0`。

---

## 7. 前端与后端 API

均需登录（`requireAuth`）。

| 方法 | 路径 | 作用 |
|------|------|------|
| `GET` | `/api/tools/ai-redraw/status` | 就绪状态、默认线路、`lineOptions`、方案/分辨率预设 |
| `POST` | `/api/tools/ai-redraw` | 执行重绘；body 含 `imageBase64`、`preset`、`provider`、`resolution`、`sourceWidth/Height` 等 |
| `GET` | `/api/tools/ai-redraw/history` | 当前用户历史列表 |
| `GET` | `/api/tools/ai-redraw/history/:id/source\|result` | 取历史图文件 |
| `DELETE` | `/api/tools/ai-redraw/history/:id` | 删除一条历史 |

`POST` 成功后自动保存历史（失败不影响主结果返回）。

历史落盘：

```
data/users/<userId>/ai_redraw_history.json
data/users/<userId>/ai-redraw/<id>-source.*
data/users/<userId>/ai-redraw/<id>-result.*
```

---

## 8. 提示词方案（服务端预设）

定义于 `lib/nanoBanana.js` 的 `PROMPT_PRESETS`：

| ID | 名称 | 行为 |
|----|------|------|
| `enhance` | 光影质感增强 | 尽量不改构图与内容，加强光影、材质、清晰度 |
| `angle` | 微角度约 15° | 以书法场景锚点为准，轻微三分之四视角 + 侧墙景深 |
| `angle-45` | 强角度约 45° | 更强对角线视角，扩侧墙/地面/天花板 |

可自定义 `prompt` / `negativePrompt` 覆盖（一般 UI 走 preset）。

---

## 9. 本地测试

```bash
# 需已配置对应 Key
node scripts/test-ai-redraw.js
```

会打印 `getStatus()` 并尝试一次重绘（视网络与积分而定）。

---

## 10. 排障清单

| 现象 | 常见原因 | 处理 |
|------|----------|------|
| 界面写 Banana，实际像千问 | 容器未重启 / Docker 旧 env | 改 `.env` 后重启容器；确认 `loadEnvFile` 已生效 |
| 「千问没了」 | 只配了 Banana Key，或界面无线路下拉 | 配齐 `DASHSCOPE_API_KEY`；部署含线路切换的新版前端并硬刷新 |
| Banana 524 / 超时仍扣费 | 用了 `.dev` 同步代理 | 只用 `nanobanana_ai` + `generate-2` 异步 |
| Google 超时 | NAS/Mac 访问不了 Google | 不要用 `google` provider |
| Banana 报图 URL 无效 | 直接传 data URI | 必须走 litterbox 临时图床 |
| 改了 `.env` 不生效 | Node 未重启 | `deploy-docker.sh` 重启 |
| Mac 改代码 NAS 没变 | 未 rsync | `bash scripts/deploy-to-nas.sh`（排除 `.env`） |

---

## 11. 今天踩坑与结论（速记）

1. **Google 直连**：本网不通。  
2. **Pixapi / nanobananaapi.dev 同步 edit**：易 524，欢迎积分也被空烧——**弃用**。  
3. **nanobananaapi.ai 异步 `generate-2` + 轮询**：可稳定出图，作为主线路。  
4. **图片必须公网 URL**：走 litterbox 临时上传。  
5. **环境变量陷阱**：Docker 注入的旧 `AI_REDRAW_*` 会盖掉文件配置 → 用 `loadEnvFile()` 让磁盘 `.env` 优先；清空错误的 `AI_REDRAW_API_URL`。  
6. **「模型下拉 ≠ 线路」**：早期前端下拉改不了后端 provider，造成错觉；现改为「线路」真正传 `provider`。  
7. **只留 Banana 2**：旧版/Pro 效果与计费都不合适当前用法。  
8. **千问保留作低成本/备用**，与 Banana 并存可选。

---

## 12. 相关文件索引

| 文件 | 职责 |
|------|------|
| `lib/nanoBanana.js` | Provider、提示词、分辨率、Banana/千问实现 |
| `lib/aiRedrawHistory.js` | 用户级历史存取 |
| `lib/config.js` | `.env` 加载与配置导出 |
| `routes/api.js` | REST 路由 |
| `assets/app.js` / `assets/styles.css` | 模块 UI |
| `.env.example` | 配置模板 |
| `scripts/deploy-to-nas.sh` | 同步到 `/Volumes/docker/pipeline` |
| `scripts/deploy-docker.sh` | NAS 上重建/重启容器 |
| `scripts/test-ai-redraw.js` | 命令行试跑 |

---

*文档随 2026-07-14 AI 重绘联调结论编写；若平台调价或换模型，请以账户账单与官方文档为准更新第 1、5 节。*
