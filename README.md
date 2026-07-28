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
- source-snapshots/：原项目快照（用于对照迁移）

## 快速运行（独立 Demo）

1. 安装依赖

npm install

2. 准备环境变量（至少配置一个 provider key）

cp .env.example .env

3. 启动

npm start

4. 打开页面

http://127.0.0.1:3480

## NAS 部署说明（适合 Synology / 其他 Linux NAS）

1. 把项目目录上传到 NAS，进入项目根目录。
2. 安装依赖：

npm install

3. 复制环境变量模板：

cp .env.example .env

4. 编辑 .env，至少填入：

```bash
HOST=0.0.0.0
PORT=3480
AI_REDRAW_PROVIDER=nanobanana_ai
NANO_BANANA_API_KEY=your_key
```

5. 直接后台启动：

chmod +x scripts/deploy-nas.sh
./scripts/deploy-nas.sh

6. 在局域网里访问：

http://<NAS_IP>:3480/

7. 如果 NAS 自带防火墙/端口转发，请放行 3480 端口。

### 说明

- 服务默认监听 0.0.0.0，便于从 NAS 局域网内的其他设备访问。
- 如果你想换成别的端口，把 .env 里的 PORT 改掉即可。
- 若后续需要长期运行，建议在 NAS 的任务计划或 PM2 中注册自启动。

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
