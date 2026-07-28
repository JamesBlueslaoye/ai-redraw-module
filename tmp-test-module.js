const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
const nanoBanana = require('./lib/nanoBanana');
(async () => {
  const imgBuffer = fs.readFileSync('/tmp/test-image.png');
  try {
    const result = await nanoBanana.redrawImage({ imageBase64: imgBuffer.toString('base64'), mimeType: 'image/png' });
    console.log('ok', result.mimeType, result.imageBase64.length);
  } catch (err) {
    console.error('ERR', err.message);
    console.error(err.status);
  }
})();
