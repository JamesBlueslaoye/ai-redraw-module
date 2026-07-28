/**
 * 按用户保存 AI 重绘历史：元数据 JSON + 源图/结果图文件。
 * data/users/<userId>/ai_redraw_history.json
 * data/users/<userId>/ai-redraw/<id>-source.* | <id>-result.*
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const HISTORY_FILE = 'ai_redraw_history.json';
const MEDIA_DIRNAME = 'ai-redraw';
const MAX_ITEMS = 50;

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function userRoot(userId) {
  return path.join(config.dataDir, 'users', userId);
}

function historyPath(userId) {
  return path.join(userRoot(userId), HISTORY_FILE);
}

function mediaDir(userId) {
  return path.join(userRoot(userId), MEDIA_DIRNAME);
}

function ensureDirs(userId) {
  const root = userRoot(userId);
  const media = mediaDir(userId);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(media)) fs.mkdirSync(media, { recursive: true });
  return media;
}

function extForMime(mimeType) {
  const mime = String(mimeType || 'image/png').toLowerCase().split(';')[0];
  return MIME_EXT[mime] || 'png';
}

function readHistory(userId) {
  const fp = historyPath(userId);
  if (!fs.existsSync(fp)) return { items: [] };
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return {
      items: Array.isArray(data.items) ? data.items : [],
    };
  } catch {
    return { items: [] };
  }
}

function writeHistory(userId, data) {
  ensureDirs(userId);
  const payload = {
    items: Array.isArray(data.items) ? data.items : [],
    _updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(historyPath(userId), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function safeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function createId() {
  return `ar_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function writeImageFile(userId, basename, base64, mimeType) {
  const dir = ensureDirs(userId);
  const ext = extForMime(mimeType);
  const filename = `${basename}.${ext}`;
  const fp = path.join(dir, filename);
  const raw = Buffer.from(String(base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  fs.writeFileSync(fp, raw);
  return { filename, mimeType: String(mimeType || 'image/png').split(';')[0], bytes: raw.length };
}

function resolveMediaFile(userId, filename) {
  if (!filename || filename.includes('..') || path.isAbsolute(filename)) return null;
  const dir = mediaDir(userId);
  const fp = path.resolve(dir, filename);
  if (!fp.startsWith(path.resolve(dir) + path.sep) && fp !== path.resolve(dir)) return null;
  if (!fs.existsSync(fp)) return null;
  return fp;
}

function unlinkQuiet(userId, filename) {
  const fp = resolveMediaFile(userId, filename);
  if (!fp) return;
  try {
    fs.unlinkSync(fp);
  } catch {
    /* ignore */
  }
}

function pruneOverflow(userId, items) {
  const kept = items.slice(0, MAX_ITEMS);
  const dropped = items.slice(MAX_ITEMS);
  dropped.forEach((item) => {
    unlinkQuiet(userId, item.sourceFilename);
    unlinkQuiet(userId, item.resultFilename);
  });
  return kept;
}

function publicItem(item) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    preset: item.preset || 'enhance',
    resolution: item.resolution || 'auto',
    size: item.size || null,
    mimeType: item.mimeType || 'image/png',
    sourceMimeType: item.sourceMimeType || 'image/png',
    sourceWidth: item.sourceWidth || null,
    sourceHeight: item.sourceHeight || null,
    resultUrl: `/api/tools/ai-redraw/history/${encodeURIComponent(item.id)}/result`,
    sourceUrl: `/api/tools/ai-redraw/history/${encodeURIComponent(item.id)}/source`,
  };
}

function listHistory(userId) {
  const { items } = readHistory(userId);
  return {
    count: items.length,
    max: MAX_ITEMS,
    items: items.map(publicItem),
  };
}

function getItem(userId, id) {
  const safe = safeId(id);
  if (!safe) return null;
  const { items } = readHistory(userId);
  return items.find((item) => item.id === safe) || null;
}

function getImagePath(userId, id, kind) {
  const item = getItem(userId, id);
  if (!item) return null;
  const filename = kind === 'source' ? item.sourceFilename : item.resultFilename;
  const fp = resolveMediaFile(userId, filename);
  if (!fp) return null;
  return {
    path: fp,
    mimeType: kind === 'source'
      ? (item.sourceMimeType || 'image/png')
      : (item.mimeType || 'image/png'),
    item,
  };
}

function saveRecord(userId, {
  sourceBase64,
  sourceMimeType,
  resultBase64,
  resultMimeType,
  preset,
  resolution,
  size,
  sourceWidth,
  sourceHeight,
}) {
  if (!userId) throw Object.assign(new Error('未登录'), { status: 401 });
  if (!sourceBase64 || !resultBase64) {
    throw Object.assign(new Error('缺少源图或结果图'), { status: 400 });
  }

  const id = createId();
  const sourceFile = writeImageFile(userId, `${id}-source`, sourceBase64, sourceMimeType || 'image/png');
  const resultFile = writeImageFile(userId, `${id}-result`, resultBase64, resultMimeType || 'image/png');

  const item = {
    id,
    createdAt: new Date().toISOString(),
    preset: preset || 'enhance',
    resolution: resolution || 'auto',
    size: size || null,
    mimeType: resultFile.mimeType,
    sourceMimeType: sourceFile.mimeType,
    sourceFilename: sourceFile.filename,
    resultFilename: resultFile.filename,
    sourceBytes: sourceFile.bytes,
    resultBytes: resultFile.bytes,
    sourceWidth: sourceWidth || null,
    sourceHeight: sourceHeight || null,
  };

  const history = readHistory(userId);
  history.items = pruneOverflow(userId, [item, ...history.items]);
  writeHistory(userId, history);
  return publicItem(item);
}

function deleteRecord(userId, id) {
  const safe = safeId(id);
  if (!safe) return false;
  const history = readHistory(userId);
  const idx = history.items.findIndex((item) => item.id === safe);
  if (idx < 0) return false;

  const [removed] = history.items.splice(idx, 1);
  unlinkQuiet(userId, removed.sourceFilename);
  unlinkQuiet(userId, removed.resultFilename);
  writeHistory(userId, history);
  return true;
}

module.exports = {
  MAX_ITEMS,
  listHistory,
  getItem,
  getImagePath,
  saveRecord,
  deleteRecord,
  publicItem,
};
