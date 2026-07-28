const path = require('path');
const fs = require('fs');
const os = require('os');

const envFilePath = path.join(__dirname, '..', '.env');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shufa-env-'));
const originalCwd = process.cwd();
process.chdir(tmpDir);

const originalEnv = { ...process.env };
process.env.PORT = '3481';
process.env.HOST = '0.0.0.0';

const envContent = 'PORT=3000\nHOST=127.0.0.1\n';
fs.writeFileSync(path.join(tmpDir, '.env'), envContent);

const configPath = path.join(__dirname, '..', 'lib', 'config.js');
const config = require(configPath);

const passed = config.port === 3481 && process.env.PORT === '3481' && process.env.HOST === '0.0.0.0';
console.log(JSON.stringify({ passed, resolvedPort: config.port, resolvedHost: process.env.HOST }, null, 2));

process.env = originalEnv;
process.chdir(originalCwd);
if (!passed) {
  process.exit(1);
}
