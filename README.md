# AI 重绘模块（独立版）

这个目录已经从 Maoco Pipeline 中拆分为可独立运行模块，包含后端 API、历史存储和最小前端验证页。

## 目录结构

- lib/nanoBanana.js：重绘核心（provider 选择、API 调用、参数处理）
- lib/aiRedrawHistory.js：按用户存储重绘历史（源图与结果图）
- lib/config.js：环境变量加载与路径配置
- routes/ai-redraw.js：独立 API 路由
- middleware/auth.js：最小鉴权占位（可替换）
- public/index.html：独立验证页
- public/ai-redraw.client.js：前端调用逻辑
- public/ai-redraw.css：前端样式
- server.js：最小可运行 Demo 服务
- scripts/test-ai-redraw.js：命令行重绘连通性测试

## 快速运行（独立 Demo）

1. 安装依赖

npm install

2. 准备环境变量（至少配置一个 provider key）

cp .env.example .env

3. 启动

npm start

4. 打开页面

http://127.0.0.1:3481

## NAS 部署工作流（本地推送 -> NAS 本地构建）

这套流程不再走 GHCR 镜像拉取，而是：

1. 本地开发
2. 把项目同步到 NAS
3. NAS 上用同一份 `docker-compose.yaml` 本地 `build`
4. 静态前端改动直接刷新网页即可

### 第一步：本地开发后同步到 NAS

```bash
bash scripts/deploy-to-nas.sh
```

这个脚本会把当前项目同步到：

```text
/Volumes/docker/AIredrawtool
```

同步时会保留 NAS 上的 `.env` 和 `data/`，避免覆盖密钥和历史数据。

### 第二步：NAS 上重新构建并启动

在 NAS 的可视化 Docker 项目里，使用 `/Volumes/docker/AIredrawtool/docker-compose.yaml` 重新部署或重建即可。

如果你在 NAS 上用命令行，等价操作是：

```bash
cd /Volumes/docker/AIredrawtool
docker compose up -d --build
```

### 第三步：访问

```text
http://<NAS_IP>:3481/
```

### 说明

- 这套模式不会再从 GitHub 拉镜像。
- GitHub 的作用只保留为代码备份。
- `public/*` 已通过挂载目录直接从 NAS 读取。只改前端静态文件时，同步到 NAS 后直接刷新浏览器即可，不需要重新部署。
- 如果改了 `lib/*`、`server.js`、`routes/*`、`package.json`、`Dockerfile` 或 `docker-compose.yaml`，需要在 NAS 重新部署/重建一次。
- 如果想保留旧数据，`data/` 不会被同步脚本覆盖。

## 必填环境变量（最小）

```bash
AI_REDRAW_PROVIDER=nanobanana_ai
NANO_BANANA_API_KEY=your_key
```

可选千问线路：

```bash
DASHSCOPE_API_KEY=your_key
QWEN_MODEL=qwen-image-edit-plus
QWEN_API_URL=
```

## API 路径

挂载前缀：/api/tools/ai-redraw

- GET /status
- POST /
- GET /history
- GET /history/:id/source
- GET /history/:id/result
- DELETE /history/:id

## 接入到你的现有 Express 项目

1. 复制 lib、routes、middleware 文件到你的工程。
2. 在你的认证流程中确保 req.user.id 可用。
3. 挂载路由：

```js
const aiRedrawRoutes = require('./routes/ai-redraw');
app.use('/api/tools/ai-redraw', aiRedrawRoutes);
```

## 说明

- 当前 server.js 使用 demo 用户注入（req.user = { id: 'demo-user' }），仅用于本地验证。
- 生产环境请替换为真实认证中间件。
- 历史数据默认写入 data/users/<userId>/ai-redraw。
