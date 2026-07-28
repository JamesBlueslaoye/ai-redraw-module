const fs = require('fs');
const path = require('path');

/**
 * 从项目根目录 .env 加载配置。
 * 磁盘上的 .env（NAS 挂载）优先于 Docker 创建时写入的旧环境变量，
 * 避免「文件已改成 nanobanana，容器里却仍是 qwen」。
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!key) return;
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  });
}

loadEnvFile();

const MAC_REPORTS_DIR =
  '/Volumes/毛草乐园公共资料/MaocoLandShare/Docker资料/报告MD';

const CANDIDATE_DIRS = [
  process.env.REPORTS_DIR,
  '/volumes/reports',                                                    // Docker：symlink 挂载点
  path.join(__dirname, '..', '报告MD'),                                   // 本地/Mac 通过 symlink
  path.join(__dirname, '..', 'reports'),
  '/volume1/毛草乐园公共资料/MaocoLandShare/Docker资料/报告MD',
  MAC_REPORTS_DIR,
].filter(Boolean);

function resolveReportsDir() {
  for (const dir of CANDIDATE_DIRS) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        return dir;
      }
    } catch {
      /* 跳过无权限路径 */
    }
  }
  return process.env.REPORTS_DIR || '/volumes/reports';
}

const reportsDir = resolveReportsDir();

module.exports = {
  port: Number(process.env.PORT) || 3481,
  dataDir: path.resolve(__dirname, '..', 'data'),
  nasHost: process.env.NAS_HOST || '192.168.1.15',
  mempalacePort: Number(process.env.MEMPALACE_PORT) || 8000,
  webgamePort: Number(process.env.WEBGAME_PORT) || 1234,
  toyDevPort: Number(process.env.TOY_DEV_PORT) || 3457,
  spriteYaoyaoPort: Number(process.env.SPRITE_YAOYAO_PORT) || 3458,
  roomDecoratorPort: Number(process.env.ROOM_DECORATOR_PORT) || 3459,
  serviceName: 'maoco-pipeline',
  reportsDir,
  sessionHours: Number(process.env.MAOCO_SESSION_HOURS) || 72,
  allowRegister: process.env.MAOCO_ALLOW_REGISTER !== 'false',
  requireLogin: process.env.MAOCO_REQUIRE_LOGIN !== 'false',
  // AI 重绘：provider 可选 nanobanana_ai | qwen | volcengine | proxy | google
  aiRedrawProvider: process.env.AI_REDRAW_PROVIDER || process.env.NANO_BANANA_PROVIDER || '',
  aiRedrawModel: process.env.AI_REDRAW_MODEL || process.env.NANO_BANANA_MODEL || '',
  aiRedrawApiUrl: process.env.AI_REDRAW_API_URL || process.env.NANO_BANANA_API_URL || '',
  qwenApiUrl: process.env.QWEN_API_URL || '',
  qwenModel: process.env.QWEN_MODEL || '',
  qwenApiKey: process.env.QWEN_API_KEY || '',
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || '',
  arkApiKey: process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY || '',
  volcengineImageSize: process.env.VOLCENGINE_IMAGE_SIZE || '2K',
  // NanoBananaAPI.ai（异步）优先读专用 Key，否则回退通用 Key
  nanoBananaAiApiKey: process.env.NANO_BANANA_AI_API_KEY || '',
  // 兼容旧配置名
  nanoBananaProvider: process.env.AI_REDRAW_PROVIDER || process.env.NANO_BANANA_PROVIDER || '',
  nanoBananaApiKey: process.env.NANO_BANANA_API_KEY || process.env.GEMINI_API_KEY || '',
  nanoBananaModel: process.env.AI_REDRAW_MODEL || process.env.NANO_BANANA_MODEL || '',
  nanoBananaApiUrl: process.env.AI_REDRAW_API_URL || process.env.NANO_BANANA_API_URL || '',
};
