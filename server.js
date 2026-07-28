const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./lib/config');
const aiRedrawRoutes = require('./routes/ai-redraw');

const app = express();
const root = __dirname;
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT) || config.port;

if (!fs.existsSync(path.join(root, 'data'))) {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
}

app.use(express.json({ limit: '20mb' }));

// Demo auth injector: replace with real auth in your project.
app.use((req, _res, next) => {
  req.user = { id: process.env.DEMO_USER_ID || 'demo-user' };
  next();
});

app.use('/api/tools/ai-redraw', aiRedrawRoutes);
app.use('/public', express.static(path.join(root, 'public')));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ai-redraw-module',
    provider: process.env.AI_REDRAW_PROVIDER || 'auto',
    dataDir: config.dataDir,
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(root, 'public', 'index.html'));
});

app.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  console.log(`AI Redraw module demo running: http://${displayHost}:${port}`);
  console.log(`To access from other devices on your LAN, use http://<NAS_IP>:${port}`);
});
