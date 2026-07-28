#!/usr/bin/env node
/**
 * 测试 AI 重绘线路。
 * 用法：DASHSCOPE_API_KEY=xxx node scripts/test-ai-redraw.js
 * 或：AI_REDRAW_PROVIDER=volcengine ARK_API_KEY=xxx node scripts/test-ai-redraw.js
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
}

loadEnvFile();

const nanoBanana = require('../lib/nanoBanana');

const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAMAjAsK7+PTMRPLhGQd7QJnESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ESJ3ES53Vg6wNShQF/fRSLfgAAAABJRU5ErkJggg==';

async function main() {
  const status = nanoBanana.getStatus();
  console.log('线路状态:', JSON.stringify({
    ready: status.ready,
    provider: status.provider,
    providerLabel: status.providerLabel,
    model: status.model,
    apiUrl: status.apiUrl,
    keyPrefix: status.ready ? 'configured' : null,
  }, null, 2));

  if (!status.ready) {
    console.error('\n❌ 未配置 API Key（DASHSCOPE_API_KEY / ARK_API_KEY / NANO_BANANA_API_KEY）');
    process.exit(1);
  }

  console.log('\n正在发送真实 PNG 测试图片进行重绘，请稍候…');
  const start = Date.now();

  try {
    const result = await nanoBanana.redrawImage({
      imageBase64: TEST_IMAGE_BASE64,
      mimeType: 'image/png',
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const outBytes = Buffer.from(result.imageBase64, 'base64').length;
    console.log(`\n✅ 重绘成功 (${elapsed}s)`);
    console.log(`   输出格式: ${result.mimeType}`);
    console.log(`   输出大小: ${outBytes} bytes`);
    process.exit(0);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\n❌ 重绘失败 (${elapsed}s): ${err.message}`);
    process.exit(1);
  }
}

main();
