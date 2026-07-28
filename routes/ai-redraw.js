const express = require('express');
const nanoBanana = require('../lib/nanoBanana');
const aiRedrawHistory = require('../lib/aiRedrawHistory');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/status', requireAuth, (_req, res) => {
  res.json(nanoBanana.getStatus());
});

router.get('/history', requireAuth, (req, res) => {
  res.json(aiRedrawHistory.listHistory(req.user.id));
});

router.get('/history/:id/:kind', requireAuth, (req, res) => {
  const kind = req.params.kind === 'source' ? 'source' : 'result';
  if (req.params.kind !== 'source' && req.params.kind !== 'result') {
    return res.status(400).json({ error: '无效资源类型' });
  }

  const file = aiRedrawHistory.getImagePath(req.user.id, req.params.id, kind);
  if (!file) return res.status(404).json({ error: '记录不存在' });

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  return res.sendFile(file.path);
});

router.delete('/history/:id', requireAuth, (req, res) => {
  const ok = aiRedrawHistory.deleteRecord(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ error: '记录不存在' });
  res.json({ ok: true, ...aiRedrawHistory.listHistory(req.user.id) });
});

router.post('/', requireAuth, async (req, res) => {
  const {
    imageBase64,
    mimeType,
    prompt,
    preset,
    provider,
    model,
    size,
    resolution,
    sourceWidth,
    sourceHeight,
  } = req.body || {};

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: '请上传图片' });
  }

  const raw = imageBase64.replace(/^data:[^;]+;base64,/, '');
  if (raw.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: '图片过大，请使用 10MB 以内的图片' });
  }

  try {
    const result = await nanoBanana.redrawImage({
      imageBase64: raw,
      mimeType: mimeType || 'image/png',
      prompt,
      preset,
      provider,
      model,
      size,
      resolution,
      sourceWidth: Number(sourceWidth) || undefined,
      sourceHeight: Number(sourceHeight) || undefined,
    });

    let historyItem = null;
    try {
      historyItem = aiRedrawHistory.saveRecord(req.user.id, {
        sourceBase64: raw,
        sourceMimeType: mimeType || 'image/png',
        resultBase64: result.imageBase64,
        resultMimeType: result.mimeType || 'image/png',
        preset,
        resolution,
        size: result.size || size || null,
        sourceWidth: Number(sourceWidth) || undefined,
        sourceHeight: Number(sourceHeight) || undefined,
      });
    } catch (saveErr) {
      console.warn('[ai-redraw] history save failed:', saveErr.message);
    }

    res.json({
      ok: true,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      size: result.size || null,
      historyItem,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const providerStatus = nanoBanana.getStatus();
    const providerLabel = providerStatus?.providerLabel || providerStatus?.provider || '当前线路';
    const normalizedMessage = /fetch failed/i.test(detail)
      ? `${providerLabel} 网络请求失败，请检查 NAS 外网访问和对应 API 配置`
      : (detail || '重绘失败');

    console.error('[ai-redraw] redraw failed:', {
      provider: providerStatus?.provider || 'unknown',
      message: detail,
      stack: err instanceof Error ? err.stack : undefined,
    });

    res.status(err.status || 500).json({ error: normalizedMessage });
  }
});

module.exports = router;
