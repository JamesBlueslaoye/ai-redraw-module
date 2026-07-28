const express = require('express');
const store = require('../lib/store');
const dashboard = require('../lib/dashboard');
const reports = require('../lib/reports');
const userWorkspace = require('../lib/userWorkspace');
const users = require('../lib/users');
const nanoBanana = require('../lib/nanoBanana');
const aiRedrawHistory = require('../lib/aiRedrawHistory');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  userWorkspace.seedAll(req.user.id, users.findById(req.user.id) || req.user);
  const payload = dashboard.getDashboardPayload(req.user.id);
  const profile = users.readProfile(req.user.id);
  res.json({
    ...payload,
    user: req.user,
    profile,
    workspaceKeys: userWorkspace.listKeys(),
  });
});

router.get('/workspace', requireAuth, (req, res) => {
  const keys = userWorkspace.listKeys();
  const data = {};
  keys.forEach(({ key }) => {
    data[key] = userWorkspace.readKey(req.user.id, key, req.user);
  });
  res.json({ keys, data });
});

router.get('/workspace/keys', requireAuth, (_req, res) => {
  res.json({ keys: userWorkspace.listKeys() });
});

router.get('/workspace/:key', requireAuth, (req, res) => {
  const key = store.safeName(req.params.key);
  if (!userWorkspace.isRegistered(key)) {
    return res.status(404).json({ error: '未知的数据类型' });
  }
  res.json(userWorkspace.readKey(req.user.id, key, req.user));
});

router.put('/workspace/:key', requireAuth, (req, res) => {
  const key = store.safeName(req.params.key);
  if (!userWorkspace.isRegistered(key)) {
    return res.status(404).json({ error: '未知的数据类型' });
  }
  const data = userWorkspace.writeKey(req.user.id, key, req.body);
  res.json({ ok: true, data });
});

router.patch('/workspace/:key', requireAuth, (req, res) => {
  const key = store.safeName(req.params.key);
  if (!userWorkspace.isRegistered(key)) {
    return res.status(404).json({ error: '未知的数据类型' });
  }
  const data = userWorkspace.patchKey(req.user.id, key, req.body, req.user);
  res.json({ ok: true, data });
});

router.get('/page-state/:pageKey', requireAuth, (req, res) => {
  const pageKey = store.safeName(req.params.pageKey);
  const state = userWorkspace.readPageState(req.user.id, pageKey);
  res.json(state || {});
});

router.put('/page-state/:pageKey', requireAuth, (req, res) => {
  const pageKey = store.safeName(req.params.pageKey);
  const state = userWorkspace.savePageState(req.user.id, pageKey, req.body || {});
  res.json({ ok: true, state });
});

router.get('/modules', requireAuth, (req, res) => {
  res.json(userWorkspace.readKey(req.user.id, 'modules', req.user));
});

router.put('/modules', requireAuth, (req, res) => {
  userWorkspace.writeKey(req.user.id, 'modules', req.body);
  res.json({ success: true });
});

router.get('/panels', requireAuth, (req, res) => {
  res.json(userWorkspace.readKey(req.user.id, 'panels', req.user));
});

router.put('/panels', requireAuth, (req, res) => {
  userWorkspace.writeKey(req.user.id, 'panels', req.body);
  res.json({ success: true });
});

router.get('/tools', requireAuth, (req, res) => {
  res.json(userWorkspace.readKey(req.user.id, 'tools', req.user));
});

router.put('/tools', requireAuth, (req, res) => {
  userWorkspace.writeKey(req.user.id, 'tools', req.body);
  res.json({ success: true });
});

/** @deprecated 请使用 /api/workspace/:key */
router.get('/data/:name', requireAuth, (req, res) => {
  const name = store.safeName(req.params.name);
  const data = userWorkspace.isRegistered(name)
    ? userWorkspace.readKey(req.user.id, name, req.user)
    : users.readUserData(req.user.id, name);
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
});

/** @deprecated 请使用 PUT /api/workspace/:key */
router.post('/data/:name', requireAuth, (req, res) => {
  const name = store.safeName(req.params.name);
  if (userWorkspace.isRegistered(name)) {
    userWorkspace.writeKey(req.user.id, name, req.body);
  } else {
    users.writeUserData(req.user.id, name, req.body);
  }
  res.json({ success: true });
});

router.get('/reports/status', requireAuth, (_req, res) => {
  res.json({
    ready: reports.isReady(),
    dir: reports.getReportsDir(),
  });
});

router.get('/reports', requireAuth, (req, res) => {
  const list = reports.listReports();
  const ui = userWorkspace.readKey(req.user.id, 'reports_ui', req.user);
  res.json({ ...list, ui });
});

router.get('/reports/:id', requireAuth, (req, res) => {
  const report = reports.readReport(req.params.id);
  if (report.error) return res.status(404).json(report);

  const ui = userWorkspace.readKey(req.user.id, 'reports_ui', req.user);
  const history = Array.isArray(ui.readHistory) ? ui.readHistory : [];
  const id = req.params.id;
  const nextHistory = [id, ...history.filter((x) => x !== id)].slice(0, 50);
  userWorkspace.patchKey(req.user.id, 'reports_ui', {
    activeId: id,
    readHistory: nextHistory,
  }, req.user);

  res.json(report);
});

router.get('/tools/ai-redraw/status', requireAuth, (_req, res) => {
  res.json(nanoBanana.getStatus());
});

router.get('/tools/ai-redraw/history', requireAuth, (req, res) => {
  res.json(aiRedrawHistory.listHistory(req.user.id));
});

router.get('/tools/ai-redraw/history/:id/:kind', requireAuth, (req, res) => {
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

router.delete('/tools/ai-redraw/history/:id', requireAuth, (req, res) => {
  const ok = aiRedrawHistory.deleteRecord(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ error: '记录不存在' });
  res.json({ ok: true, ...aiRedrawHistory.listHistory(req.user.id) });
});

router.post('/tools/ai-redraw', requireAuth, async (req, res) => {
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
    res.status(err.status || 500).json({ error: err.message || '重绘失败' });
  }
});

module.exports = router;
