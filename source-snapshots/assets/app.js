const state = {
  panels: [],
  activeTab: 'module-1',
  user: null,
  profile: null,
};

let profileSaveTimer = null;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'className') node.className = val;
    else if (key === 'text') node.textContent = val;
    else if (key === 'html') node.innerHTML = val;
    else node.setAttribute(key, val);
  });
  children.forEach((child) => {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  });
  return node;
}

function renderCard(card) {
  const cardEl = el('div', { className: 'card' }, [
    el('h3', { text: card.title }),
  ]);

  (card.paragraphs || []).forEach((text) => {
    cardEl.appendChild(el('p', { text }));
  });

  if (card.items?.length) {
    const ul = el('ul');
    card.items.forEach((item) => ul.appendChild(el('li', { text: item })));
    cardEl.appendChild(ul);
  }

  (card.links || []).forEach((link) => {
    cardEl.appendChild(
      el('p', {}, [
        el('a', {
          className: 'ext-link',
          href: link.url,
          target: '_blank',
          rel: 'noopener',
          text: link.label,
        }),
      ])
    );
  });

  if (card.tag) {
    cardEl.appendChild(el('span', {
      className: `tag ${card.tag.class}`,
      text: card.tag.text,
    }));
  }

  return cardEl;
}

function renderPanel(panel, isActive) {
  const panelEl = el('div', {
    className: `panel${isActive ? ' active' : ''}`,
    id: `panel-${panel.key}`,
  });

  panelEl.appendChild(el('div', { className: 'panel-header' }, [
    el('h1', { text: panel.title }),
    el('p', { className: 'panel-desc', text: panel.desc }),
  ]));

  const body = el('div', { className: 'panel-body' });
  panel.cards.forEach((card) => body.appendChild(renderCard(card)));
  panelEl.appendChild(body);

  return panelEl;
}

function renderNav(panels) {
  const tabBar = document.getElementById('tab-bar');
  const sidebarNav = document.getElementById('sidebar-nav');
  tabBar.innerHTML = '';
  sidebarNav.innerHTML = '';

  panels.forEach((panel, index) => {
    const isActive = panel.key === state.activeTab;

    const tab = el('button', {
      className: `tab${isActive ? ' active' : ''}`,
      'data-tab': panel.key,
      type: 'button',
    }, [
      el('span', { className: 'tab-icon', text: '◈' }),
      el('span', { className: 'tab-label', text: panel.title.replace(' & ', ' &\u00a0') }),
    ]);
    tab.addEventListener('click', () => switchTab(panel.key));
    tabBar.appendChild(tab);

    const sideItem = el('a', {
      className: `side-item${isActive ? ' active' : ''}`,
      'data-tab': panel.key,
      href: `#${panel.key}`,
    }, [
      el('span', { className: 'side-icon', text: '◈' }),
      el('span', { className: 'side-label', text: panel.title }),
    ]);
    sideItem.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(panel.key);
      toggleSidebar(false);
    });
    sidebarNav.appendChild(sideItem);

    if (index === 0 && !window.location.hash) state.activeTab = panel.key;
  });
}

function renderContent(panels) {
  const content = document.getElementById('content');
  content.innerHTML = '';
  panels.forEach((panel) => {
    content.appendChild(renderPanel(panel, panel.key === state.activeTab));
  });
}

function switchTab(tabId) {
  if (!state.panels.some((p) => p.key === tabId)) return;
  state.activeTab = tabId;

  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  document.querySelectorAll('.side-item').forEach((s) => {
    s.classList.toggle('active', s.dataset.tab === tabId);
  });
  document.querySelectorAll('.panel').forEach((p) => {
    p.classList.toggle('active', p.id === `panel-${tabId}`);
  });

  history.replaceState(null, '', `#${tabId}`);
  setReportsLayoutMode(tabId === 'module-5');
  setToolsLayoutMode(tabId === 'module-4');
  scheduleProfileSave({ lastActiveTab: tabId });
  syncPageVisit(tabId);
}

function toggleSidebar(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('sidebar-open');
  document.body.classList.toggle('sidebar-open', open);
}

const CATEGORY_STYLE = {
  crowdfunding: { label: '众筹', color: '#9A6700', bg: '#FDF4D8' },
  market: { label: '市场', color: '#185FA5', bg: '#E8F2FC' },
  product: { label: '产品', color: '#534AB7', bg: '#EEEDFE' },
  internal: { label: '内部', color: '#3B6D11', bg: '#EAF3DE' },
  general: { label: '综合', color: '#5F5E5A', bg: '#F0EFEB' },
};

let reportState = { reports: [], activeId: null, query: '', category: 'all' };

function syncReportsUi() {
  MaocoUserSync.schedulePatch('reports_ui', {
    query: reportState.query,
    category: reportState.category,
    activeId: reportState.activeId,
  });
}

function syncPageVisit(pageKey) {
  MaocoUserSync.savePageState(pageKey, { lastVisitedAt: new Date().toISOString() });
}

function setReportsLayoutMode(active) {
  document.querySelector('.content')?.classList.toggle('content--reports', active);
}

function setToolsLayoutMode(active) {
  document.querySelector('.content')?.classList.toggle('content--tools', active);
}

function categoryBadge(category, className = 'report-badge') {
  const style = CATEGORY_STYLE[category] || CATEGORY_STYLE.general;
  return el('span', {
    className,
    text: style.label,
    style: `background:${style.bg};color:${style.color}`,
  });
}

function filterReports(reports) {
  const q = reportState.query.trim().toLowerCase();
  return reports.filter((report) => {
    const matchCat = reportState.category === 'all' || report.category === reportState.category;
    if (!matchCat) return false;
    if (!q) return true;
    const haystack = `${report.title} ${report.summary || ''} ${report.filename}`.toLowerCase();
    return haystack.includes(q);
  });
}

function renderReportList() {
  const listEl = document.getElementById('report-list');
  const countEl = document.getElementById('report-count');
  if (!listEl || !countEl) return;

  const filtered = filterReports(reportState.reports);
  countEl.textContent = filtered.length === reportState.reports.length
    ? `共 ${reportState.reports.length} 篇`
    : `显示 ${filtered.length} / ${reportState.reports.length} 篇`;

  listEl.innerHTML = '';
  if (!filtered.length) {
    listEl.appendChild(el('li', { className: 'report-list-empty', text: '没有匹配的报告' }));
    return;
  }

  filtered.forEach((report) => {
    const item = el('li', {
      className: `report-card${reportState.activeId === report.id ? ' active' : ''}`,
      'data-id': report.id,
    });
    const topRow = el('div', { className: 'report-card-top' });
    topRow.appendChild(categoryBadge(report.category, 'report-card-cat'));
    topRow.appendChild(el('time', { className: 'report-card-date', text: report.date }));
    item.appendChild(topRow);
    item.appendChild(el('h4', { className: 'report-card-title', text: report.title }));
    if (report.summary) {
      item.appendChild(el('p', { className: 'report-card-summary', text: report.summary }));
    }
    item.addEventListener('click', () => openReport(report.id));
    listEl.appendChild(item);
  });
}

function renderCategoryFilters() {
  const wrap = document.getElementById('report-filters');
  if (!wrap) return;
  wrap.innerHTML = '';

  const categories = ['all', ...new Set(reportState.reports.map((r) => r.category))];
  categories.forEach((cat) => {
    const label = cat === 'all' ? '全部' : (CATEGORY_STYLE[cat]?.label || '综合');
    const btn = el('button', {
      className: `report-filter${reportState.category === cat ? ' active' : ''}`,
      type: 'button',
      text: label,
    });
    btn.addEventListener('click', () => {
      reportState.category = cat;
      renderCategoryFilters();
      renderReportList();
      syncReportsUi();
    });
    wrap.appendChild(btn);
  });
}

async function loadReports() {
  const panel = document.getElementById('panel-module-5');
  if (!panel) return;

  panel.querySelector('.panel-header')?.classList.add('visually-hidden');

  const body = panel.querySelector('.panel-body');
  body.className = 'panel-body reports-workspace';
  body.innerHTML = '';

  const sidebar = el('aside', { className: 'reports-catalog' }, [
    el('div', { className: 'reports-catalog-head' }, [
      el('div', { className: 'reports-catalog-title' }, [
        el('h3', { text: '报告库' }),
        el('p', { className: 'reports-catalog-count', id: 'report-count', text: '加载中...' }),
      ]),
      el('div', { className: 'reports-search' }, [
        el('input', {
          type: 'search',
          id: 'report-search',
          placeholder: '搜索标题或摘要…',
          autocomplete: 'off',
        }),
      ]),
      el('div', { className: 'reports-filters', id: 'report-filters' }),
    ]),
    el('ul', { className: 'reports-list', id: 'report-list' }),
  ]);

  const reader = el('section', { className: 'reports-reader', id: 'report-detail' }, [
    el('div', { className: 'reports-reader-empty' }, [
      el('div', { className: 'reports-reader-empty-icon', text: '📄' }),
      el('h4', { text: '选择一篇报告开始阅读' }),
      el('p', { text: '左侧列表支持搜索与分类筛选' }),
    ]),
  ]);

  body.appendChild(sidebar);
  body.appendChild(reader);

  const searchInput = document.getElementById('report-search');
  searchInput?.addEventListener('input', (e) => {
    reportState.query = e.target.value;
    renderReportList();
    syncReportsUi();
  });

  const reportsUi = await MaocoUserSync.get('reports_ui').catch(() => ({}));
  if (reportsUi.query) reportState.query = reportsUi.query;
  if (reportsUi.category) reportState.category = reportsUi.category;
  if (reportsUi.activeId) reportState.activeId = reportsUi.activeId;
  if (searchInput && reportState.query) searchInput.value = reportState.query;

  try {
    const data = await MaocoAuth.apiFetch('/api/reports');
    if (data.ui) {
      if (data.ui.query) reportState.query = data.ui.query;
      if (data.ui.category) reportState.category = data.ui.category;
      if (data.ui.activeId) reportState.activeId = data.ui.activeId;
      if (searchInput && reportState.query) searchInput.value = reportState.query;
    }

    if (!data.ready) {
      document.getElementById('report-count').textContent = '目录不可访问';
      document.getElementById('report-list').appendChild(el('li', {
        className: 'report-list-empty',
        text: data.dir || '未配置',
      }));
      return;
    }

    if (!data.reports.length) {
      document.getElementById('report-count').textContent = '暂无报告';
      document.getElementById('report-list').appendChild(el('li', {
        className: 'report-list-empty',
        text: '目录中暂无 .md 报告',
      }));
      return;
    }

    reportState.reports = data.reports;
    renderCategoryFilters();
    renderReportList();
    const openId = reportState.activeId && data.reports.some((r) => r.id === reportState.activeId)
      ? reportState.activeId
      : data.reports[0].id;
    openReport(openId);
  } catch (err) {
    document.getElementById('report-count').textContent = '加载失败';
    console.error(err);
  }
}

function setActiveReportItem(id) {
  document.querySelectorAll('.report-card').forEach((item) => {
    item.classList.toggle('active', item.dataset.id === id);
  });
}

async function openReport(id) {
  const detail = document.getElementById('report-detail');
  if (!detail) return;

  const reportMeta = reportState.reports.find((r) => r.id === id);
  reportState.activeId = id;
  setActiveReportItem(id);
  syncReportsUi();

  detail.innerHTML = '';
  detail.appendChild(el('div', { className: 'reports-reader-loading' }, [
    el('div', { className: 'reports-reader-loading-bar' }),
    el('p', { text: '正在加载报告…' }),
  ]));

  try {
    const data = await MaocoAuth.apiFetch(`/api/reports/${encodeURIComponent(id)}`);
    if (data.error) throw new Error(data.error);

    detail.innerHTML = '';
    const article = el('article', { className: 'report-article' });

    const head = el('header', { className: 'report-article-head' });
    if (reportMeta) head.appendChild(categoryBadge(reportMeta.category, 'report-article-cat'));
    head.appendChild(el('h1', { text: data.title }));
    head.appendChild(el('div', { className: 'report-article-meta' }, [
      el('time', { text: data.date }),
      reportMeta?.filename
        ? el('span', { className: 'report-article-file', text: reportMeta.filename })
        : null,
    ].filter(Boolean)));
    article.appendChild(head);

    const content = el('div', { className: 'report-article-body markdown-body' });
    content.innerHTML = data.html || '';
    article.appendChild(content);
    detail.appendChild(article);
  } catch (err) {
    detail.innerHTML = '';
    detail.appendChild(el('div', { className: 'reports-reader-empty' }, [
      el('div', { className: 'reports-reader-empty-icon', text: '⚠️' }),
      el('h4', { text: '无法加载报告' }),
      el('p', { text: '请稍后重试或检查文件是否存在' }),
    ]));
  }
}

const AI_REDRAW_RESOLUTION_PRESETS = [
  { id: 'auto', target: null },
  { id: '1024', target: 1024 },
  { id: '1536', target: 1536 },
  { id: '2048', target: 2048 },
];

const AI_REDRAW_PROMPT_PRESETS = [
  { id: 'enhance', label: '光影质感增强', statusText: '光影与质感' },
  { id: 'angle', label: '微角度视角', statusText: '微角度视角' },
  { id: 'angle-45', label: '强角度视角', statusText: '45° 强角度视角' },
];

const aiRedrawState = {
  sourceFile: null,
  sourceDataUrl: null,
  sourceWidth: 0,
  sourceHeight: 0,
  resultDataUrl: null,
  loading: false,
  resolution: '1536',
  preset: 'enhance',
  model: 'nanobanana-2',
  provider: 'nanobanana_ai',
  history: [],
  historyMax: 50,
  activeHistoryId: null,
};

function aiRedrawPresetLabel(presetId) {
  return getAiRedrawPresetMeta(presetId).label;
}

function formatAiRedrawTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

function aiRedrawRoundTo16(value) {
  return Math.round(value / 16) * 16;
}

function computeAiRedrawOutputSize(sourceWidth, sourceHeight, presetId) {
  const preset = AI_REDRAW_RESOLUTION_PRESETS.find((item) => item.id === presetId);
  if (!preset?.target || !sourceWidth || !sourceHeight) return null;

  const area = preset.target * preset.target;
  const aspect = sourceWidth / sourceHeight;
  let width = aiRedrawRoundTo16(Math.sqrt(area * aspect));
  let height = aiRedrawRoundTo16(Math.sqrt(area / aspect));
  width = Math.min(2048, Math.max(512, width));
  height = Math.min(2048, Math.max(512, height));
  return { width, height, label: `${width}×${height}` };
}

function getAiRedrawResolution() {
  return document.getElementById('ai-redraw-resolution')?.value || aiRedrawState.resolution;
}

function getAiRedrawPreset() {
  return document.getElementById('ai-redraw-preset')?.value || aiRedrawState.preset;
}

function getAiRedrawProvider() {
  return document.getElementById('ai-redraw-provider')?.value || aiRedrawState.provider;
}

function getAiRedrawPresetMeta(presetId = getAiRedrawPreset()) {
  return AI_REDRAW_PROMPT_PRESETS.find((item) => item.id === presetId) || AI_REDRAW_PROMPT_PRESETS[0];
}

function updateAiRedrawSizeHint() {
  const hint = document.getElementById('ai-redraw-size-hint');
  if (!hint) return;

  const resolution = getAiRedrawResolution();
  aiRedrawState.resolution = resolution;

  if (resolution === 'auto') {
    hint.textContent = '自动模式：约 1024² 像素，速度较快';
    return;
  }

  if (!aiRedrawState.sourceWidth || !aiRedrawState.sourceHeight) {
    hint.textContent = '上传图片后显示预计输出尺寸';
    return;
  }

  const size = computeAiRedrawOutputSize(
    aiRedrawState.sourceWidth,
    aiRedrawState.sourceHeight,
    resolution,
  );
  hint.textContent = size ? `预计输出 ${size.label}（跟随原图比例）` : '';
}

function readImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('无法读取图片尺寸'));
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('无法读取图片'));
    reader.readAsDataURL(file);
  });
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { mimeType: 'image/png', imageBase64: dataUrl };
  return { mimeType: match[1], imageBase64: match[2] };
}

function renderAiRedrawPreview() {
  const sourceImg = document.getElementById('ai-redraw-source-img');
  const resultImg = document.getElementById('ai-redraw-result-img');
  const resultWrap = document.getElementById('ai-redraw-result-wrap');
  const emptyHint = document.getElementById('ai-redraw-result-empty');
  const loadingEl = document.getElementById('ai-redraw-result-loading');
  const btnRedraw = document.getElementById('ai-redraw-btn');
  const btnDownload = document.getElementById('ai-redraw-download');

  if (sourceImg) {
    sourceImg.src = aiRedrawState.sourceDataUrl || '';
    sourceImg.hidden = !aiRedrawState.sourceDataUrl;
  }

  const emptySource = document.getElementById('ai-redraw-source-empty');
  if (emptySource) emptySource.hidden = Boolean(aiRedrawState.sourceDataUrl);

  const showResult = Boolean(aiRedrawState.resultDataUrl) && !aiRedrawState.loading;
  if (resultImg) {
    resultImg.src = aiRedrawState.resultDataUrl || '';
    resultImg.hidden = !showResult;
  }
  if (resultWrap) {
    resultWrap.classList.toggle('has-result', showResult);
    resultWrap.classList.toggle('is-loading', aiRedrawState.loading);
  }
  if (emptyHint) emptyHint.hidden = showResult || aiRedrawState.loading;
  if (loadingEl) loadingEl.hidden = !aiRedrawState.loading;

  if (btnRedraw) {
    btnRedraw.disabled = !aiRedrawState.sourceDataUrl || aiRedrawState.loading;
    btnRedraw.textContent = aiRedrawState.loading ? '重绘中…' : 'AI 重绘';
  }
  if (btnDownload) btnDownload.hidden = !showResult;
  updateAiRedrawSizeHint();
  renderAiRedrawHistory();
}

function renderAiRedrawHistory() {
  const listEl = document.getElementById('ai-redraw-history-list');
  const countEl = document.getElementById('ai-redraw-history-count');
  const emptyEl = document.getElementById('ai-redraw-history-empty');
  if (!listEl) return;

  if (countEl) {
    countEl.textContent = aiRedrawState.history.length
      ? `${aiRedrawState.history.length} 条`
      : '暂无';
  }

  listEl.innerHTML = '';
  if (!aiRedrawState.history.length) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  aiRedrawState.history.forEach((item) => {
    const card = el('li', {
      className: `ai-redraw-history-item${aiRedrawState.activeHistoryId === item.id ? ' active' : ''}`,
      'data-id': item.id,
    });

    const thumb = el('img', {
      className: 'ai-redraw-history-thumb',
      src: item.resultUrl,
      alt: '历史结果',
      loading: 'lazy',
    });
    thumb.addEventListener('error', () => {
      thumb.replaceWith(el('div', { className: 'ai-redraw-history-thumb ai-redraw-history-thumb--empty', text: '无图' }));
    });

    const meta = el('div', { className: 'ai-redraw-history-meta' }, [
      el('span', { className: 'ai-redraw-history-preset', text: aiRedrawPresetLabel(item.preset) }),
      el('time', { className: 'ai-redraw-history-time', text: formatAiRedrawTime(item.createdAt) }),
    ]);

    const delBtn = el('button', {
      className: 'ai-redraw-history-delete',
      type: 'button',
      title: '删除记录',
      text: '×',
    });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAiRedrawHistoryItem(item.id);
    });

    card.appendChild(thumb);
    card.appendChild(meta);
    card.appendChild(delBtn);
    card.addEventListener('click', () => openAiRedrawHistoryItem(item));
    listEl.appendChild(card);
  });
}

async function loadAiRedrawHistory() {
  try {
    const data = await MaocoAuth.apiFetch('/api/tools/ai-redraw/history');
    aiRedrawState.history = Array.isArray(data.items) ? data.items : [];
    aiRedrawState.historyMax = data.max || 50;
    renderAiRedrawHistory();
  } catch (err) {
    console.warn('ai-redraw history load failed', err);
  }
}

async function openAiRedrawHistoryItem(item) {
  if (!item || aiRedrawState.loading) return;
  aiRedrawState.activeHistoryId = item.id;
  aiRedrawState.resultDataUrl = item.resultUrl;
  aiRedrawState.preset = item.preset || aiRedrawState.preset;
  aiRedrawState.resolution = item.resolution || aiRedrawState.resolution;

  const presetSelect = document.getElementById('ai-redraw-preset');
  const resolutionSelect = document.getElementById('ai-redraw-resolution');
  if (presetSelect && item.preset) presetSelect.value = item.preset;
  if (resolutionSelect && item.resolution) resolutionSelect.value = item.resolution;

  try {
    if (item.sourceUrl) {
      const sourceRes = await fetch(item.sourceUrl, { credentials: 'same-origin' });
      if (sourceRes.ok) {
        const blob = await sourceRes.blob();
        aiRedrawState.sourceDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('读取源图失败'));
          reader.readAsDataURL(blob);
        });
        const dims = await readImageDimensions(aiRedrawState.sourceDataUrl);
        aiRedrawState.sourceWidth = dims.width;
        aiRedrawState.sourceHeight = dims.height;
        aiRedrawState.sourceFile = null;
      }
    }
  } catch (err) {
    console.warn('load history source failed', err);
  }

  renderAiRedrawPreview();
}

async function deleteAiRedrawHistoryItem(id) {
  if (!id) return;
  if (!window.confirm('删除这条生成记录？图片将一并清除。')) return;
  try {
    const data = await MaocoAuth.apiFetch(`/api/tools/ai-redraw/history/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    aiRedrawState.history = Array.isArray(data.items) ? data.items : [];
    if (aiRedrawState.activeHistoryId === id) {
      aiRedrawState.activeHistoryId = null;
    }
    renderAiRedrawHistory();
  } catch (err) {
    alert(err.message || '删除失败');
  }
}

async function handleAiRedrawUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('图片不能超过 10MB');
    return;
  }

  aiRedrawState.sourceFile = file;
  aiRedrawState.sourceDataUrl = await readFileAsDataUrl(file);
  const dims = await readImageDimensions(aiRedrawState.sourceDataUrl);
  aiRedrawState.sourceWidth = dims.width;
  aiRedrawState.sourceHeight = dims.height;
  aiRedrawState.resultDataUrl = null;
  aiRedrawState.activeHistoryId = null;
  renderAiRedrawPreview();
}

async function runAiRedraw() {
  if (!aiRedrawState.sourceDataUrl || aiRedrawState.loading) return;

  aiRedrawState.loading = true;
  aiRedrawState.activeHistoryId = null;
  renderAiRedrawPreview();

  const statusEl = document.getElementById('ai-redraw-status');
  const resolution = getAiRedrawResolution();
  const preset = getAiRedrawPreset();
  const provider = getAiRedrawProvider();
  const presetMeta = getAiRedrawPresetMeta(preset);
  aiRedrawState.preset = preset;
  aiRedrawState.provider = provider;
  const outputSize = computeAiRedrawOutputSize(
    aiRedrawState.sourceWidth,
    aiRedrawState.sourceHeight,
    resolution,
  );

  if (statusEl) {
    const sizeNote = resolution === 'auto'
      ? ''
      : outputSize
        ? `（${outputSize.label}）`
        : '';
    statusEl.textContent = `正在重绘${presetMeta.statusText}${sizeNote}，通常需要 10–40 秒…`;
    statusEl.hidden = false;
    statusEl.classList.remove('ai-redraw-status--error');
  }

  try {
    const { mimeType, imageBase64 } = parseDataUrl(aiRedrawState.sourceDataUrl);
    const data = await MaocoAuth.apiFetch('/api/tools/ai-redraw', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64,
        mimeType,
        preset,
        provider,
        resolution,
        sourceWidth: aiRedrawState.sourceWidth,
        sourceHeight: aiRedrawState.sourceHeight,
      }),
    });

    aiRedrawState.resultDataUrl = `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`;
    if (data.historyItem) {
      aiRedrawState.activeHistoryId = data.historyItem.id;
      aiRedrawState.history = [
        data.historyItem,
        ...aiRedrawState.history.filter((item) => item.id !== data.historyItem.id),
      ].slice(0, aiRedrawState.historyMax || 50);
    } else {
      await loadAiRedrawHistory();
    }

    if (statusEl) {
      const actualSize = data.size ? data.size.replace('*', '×') : outputSize?.label;
      statusEl.textContent = actualSize ? `重绘完成 · ${actualSize} · 已保存到历史` : '重绘完成 · 已保存到历史';
      setTimeout(() => { statusEl.hidden = true; }, 3000);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err.message || '重绘失败';
      statusEl.classList.add('ai-redraw-status--error');
    }
  } finally {
    aiRedrawState.loading = false;
    renderAiRedrawPreview();
  }
}

async function downloadAiRedrawResult() {
  if (!aiRedrawState.resultDataUrl) return;
  const a = document.createElement('a');
  a.download = `ai-redraw-${Date.now()}.png`;

  if (aiRedrawState.resultDataUrl.startsWith('data:')) {
    a.href = aiRedrawState.resultDataUrl;
    a.click();
    return;
  }

  try {
    const res = await fetch(aiRedrawState.resultDataUrl, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('下载失败');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    alert(err.message || '下载失败');
  }
}

async function loadAiRedraw() {
  const panel = document.getElementById('panel-module-4');
  if (!panel) return;

  panel.querySelector('.panel-header')?.classList.add('visually-hidden');

  const body = panel.querySelector('.panel-body');
  body.className = 'panel-body ai-redraw-workspace';
  body.innerHTML = '';

  const workspace = el('div', { className: 'ai-redraw-layout' }, [
    el('section', { className: 'ai-redraw-panel ai-redraw-panel--source' }, [
      el('div', { className: 'ai-redraw-panel-head' }, [
        el('h3', { text: '原图' }),
        el('p', { className: 'ai-redraw-panel-desc', text: '上传需要增强质感的图片' }),
      ]),
      el('div', {
        className: 'ai-redraw-dropzone',
        id: 'ai-redraw-dropzone',
      }, [
        el('input', {
          type: 'file',
          id: 'ai-redraw-file',
          accept: 'image/*',
          hidden: 'true',
        }),
        el('div', { className: 'ai-redraw-dropzone-inner', id: 'ai-redraw-source-empty' }, [
          el('div', { className: 'ai-redraw-dropzone-icon', text: '🖼' }),
          el('p', { text: '点击或拖拽图片到此处' }),
          el('span', { className: 'ai-redraw-dropzone-hint', text: '支持 PNG / JPG / WebP，最大 10MB' }),
        ]),
        el('img', {
          id: 'ai-redraw-source-img',
          className: 'ai-redraw-preview-img',
          alt: '原图预览',
          hidden: 'true',
        }),
      ]),
    ]),
    el('section', { className: 'ai-redraw-panel ai-redraw-panel--result' }, [
      el('div', { className: 'ai-redraw-panel-head' }, [
        el('h3', { text: '重绘结果' }),
        el('p', { className: 'ai-redraw-panel-desc', text: '保持内容不变，优化光影与真实感' }),
      ]),
      el('div', { className: 'ai-redraw-result-area', id: 'ai-redraw-result-wrap' }, [
        el('div', { className: 'ai-redraw-result-empty', id: 'ai-redraw-result-empty' }, [
          el('div', { className: 'ai-redraw-dropzone-icon', text: '✨' }),
          el('p', { text: '重绘结果将显示在这里' }),
        ]),
        el('div', {
          className: 'ai-redraw-result-loading',
          id: 'ai-redraw-result-loading',
          hidden: 'true',
        }, [
          el('div', { className: 'ai-redraw-progress-ring', 'aria-hidden': 'true' }, [
            el('div', { className: 'ai-redraw-progress-ring-spin' }),
          ]),
          el('p', { className: 'ai-redraw-progress-title', text: '正在重绘' }),
          el('p', { className: 'ai-redraw-progress-dots', text: '请稍候' }),
        ]),
        el('img', {
          id: 'ai-redraw-result-img',
          className: 'ai-redraw-preview-img',
          alt: '重绘结果',
          hidden: 'true',
        }),
      ]),
    ]),
  ]);

  const historyPanel = el('section', { className: 'ai-redraw-history' }, [
    el('div', { className: 'ai-redraw-history-head' }, [
      el('div', { className: 'ai-redraw-history-title' }, [
        el('h3', { text: '我的生成历史' }),
        el('p', {
          className: 'ai-redraw-history-count',
          id: 'ai-redraw-history-count',
          text: '加载中…',
        }),
      ]),
      el('p', {
        className: 'ai-redraw-history-hint',
        text: '仅当前登录账号可见，点击可回看原图与结果',
      }),
    ]),
    el('p', {
      className: 'ai-redraw-history-empty',
      id: 'ai-redraw-history-empty',
      text: '还没有生成记录，完成一次重绘后会出现在这里',
      hidden: 'true',
    }),
    el('ul', { className: 'ai-redraw-history-list', id: 'ai-redraw-history-list' }),
  ]);

  const toolbar = el('div', { className: 'ai-redraw-toolbar' }, [
    el('button', {
      className: 'ai-redraw-btn ai-redraw-btn--primary',
      id: 'ai-redraw-btn',
      type: 'button',
      text: 'AI 重绘',
      disabled: 'true',
    }),
    el('button', {
      className: 'ai-redraw-btn ai-redraw-btn--secondary',
      id: 'ai-redraw-download',
      type: 'button',
      text: '下载结果',
      hidden: 'true',
    }),
    el('label', { className: 'ai-redraw-field' }, [
      el('span', { className: 'ai-redraw-field-label', text: '重绘方案' }),
      el('select', { className: 'ai-redraw-select', id: 'ai-redraw-preset' }, [
        el('option', { value: 'enhance', text: '光影质感增强', selected: 'true' }),
        el('option', { value: 'angle', text: '微角度视角（约 15°）' }),
        el('option', { value: 'angle-45', text: '强角度视角（约 45°）' }),
      ]),
    ]),
    el('label', { className: 'ai-redraw-field', id: 'ai-redraw-provider-field', hidden: 'true' }, [
      el('span', { className: 'ai-redraw-field-label', text: '线路' }),
      el('select', { className: 'ai-redraw-select', id: 'ai-redraw-provider' }),
    ]),
    el('label', { className: 'ai-redraw-field' }, [
      el('span', { className: 'ai-redraw-field-label', text: '生图分辨率' }),
      el('select', { className: 'ai-redraw-select', id: 'ai-redraw-resolution' }, [
        el('option', { value: 'auto', text: '自动 · 约 1K（较快）' }),
        el('option', { value: '1024', text: '1K · 约 1024²' }),
        el('option', { value: '1536', text: '1.5K · 约 1536²（推荐）', selected: 'true' }),
        el('option', { value: '2048', text: '2K · 约 2048²（最清晰）' }),
      ]),
    ]),
    el('p', {
      className: 'ai-redraw-size-hint',
      id: 'ai-redraw-size-hint',
    }),
    el('p', {
      className: 'ai-redraw-status',
      id: 'ai-redraw-status',
      hidden: 'true',
    }),
  ]);

  body.appendChild(toolbar);
  body.appendChild(workspace);
  body.appendChild(historyPanel);

  const fileInput = document.getElementById('ai-redraw-file');
  const dropzone = document.getElementById('ai-redraw-dropzone');

  dropzone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleAiRedrawUpload(file);
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleAiRedrawUpload(file);
  });

  document.getElementById('ai-redraw-btn')?.addEventListener('click', runAiRedraw);
  document.getElementById('ai-redraw-download')?.addEventListener('click', downloadAiRedrawResult);
  document.getElementById('ai-redraw-resolution')?.addEventListener('change', updateAiRedrawSizeHint);
  document.getElementById('ai-redraw-preset')?.addEventListener('change', (e) => {
    aiRedrawState.preset = e.target.value;
  });

  function updateAiRedrawLineHint(status, selectedId) {
    const hint = document.getElementById('ai-redraw-config-hint');
    const lines = status?.lineOptions || [];
    const selected = lines.find((item) => item.id === selectedId)
      || lines.find((item) => item.id === status?.provider)
      || lines[0];
    const text = selected
      ? `当前线路：${selected.label} · ${selected.model}`
      : `当前线路：${status?.providerLabel || status?.provider || '未配置'}`;
    if (hint) {
      hint.textContent = text;
      return;
    }
    if (status?.ready) {
      toolbar.appendChild(el('p', {
        className: 'ai-redraw-provider-hint',
        id: 'ai-redraw-config-hint',
        text,
      }));
    }
  }

  document.getElementById('ai-redraw-provider')?.addEventListener('change', (e) => {
    aiRedrawState.provider = e.target.value;
    const statusCache = window.__aiRedrawStatus;
    if (statusCache) updateAiRedrawLineHint(statusCache, e.target.value);
  });

  try {
    const status = await MaocoAuth.apiFetch('/api/tools/ai-redraw/status');
    window.__aiRedrawStatus = status;
    const providerField = document.getElementById('ai-redraw-provider-field');
    const providerSelect = document.getElementById('ai-redraw-provider');
    const lines = status.lineOptions || [];

    if (providerField && providerSelect && lines.length) {
      providerField.hidden = false;
      providerSelect.replaceChildren(
        ...lines.map((item) => el('option', {
          value: item.id,
          text: item.label,
          ...(item.id === (status.provider || lines[0].id) ? { selected: 'true' } : {}),
        })),
      );
      const chosen = lines.some((item) => item.id === status.provider)
        ? status.provider
        : lines[0].id;
      providerSelect.value = chosen;
      aiRedrawState.provider = chosen;
    }

    if (!status.ready) {
      toolbar.appendChild(el('p', {
        className: 'ai-redraw-config-hint',
        id: 'ai-redraw-config-hint',
        text: '⚠ 未配置 AI 重绘 API Key，请在 .env 中设置 NANO_BANANA_API_KEY 或 DASHSCOPE_API_KEY',
      }));
    } else {
      updateAiRedrawLineHint(status, aiRedrawState.provider);
    }
  } catch (err) {
    console.warn('ai-redraw status check failed', err);
  }

  await loadAiRedrawHistory();
  renderAiRedrawPreview();
}

function scheduleProfileSave(patch) {
  if (!state.user) return;
  if (profileSaveTimer) clearTimeout(profileSaveTimer);
  profileSaveTimer = setTimeout(() => {
    MaocoAuth.saveProfile(patch).then((data) => {
      state.profile = data.profile;
      const hint = document.getElementById('profile-save-hint');
      if (hint) {
        hint.textContent = '● 已保存';
        setTimeout(() => { hint.textContent = '更改会自动保存'; }, 1500);
      }
    }).catch((err) => console.warn('profile save failed', err));
  }, 400);
}

function renderUserBar() {
  const bar = document.getElementById('user-bar');
  const nameEl = document.getElementById('user-display-name');
  if (!bar || !state.user) return;
  bar.hidden = false;
  nameEl.textContent = state.profile?.displayName || state.user.displayName || state.user.username;
}

function openProfilePanel() {
  const overlay = document.getElementById('profile-overlay');
  if (!overlay || !state.profile) return;
  document.getElementById('profile-display-name').value = state.profile.displayName || '';
  document.getElementById('profile-username').value = state.user.username || '';
  document.getElementById('profile-notes').value = state.profile.notes || '';
  overlay.hidden = false;
}

function closeProfilePanel() {
  const overlay = document.getElementById('profile-overlay');
  if (overlay) overlay.hidden = true;
}

function bindProfilePanel() {
  document.getElementById('btn-profile')?.addEventListener('click', openProfilePanel);
  document.getElementById('btn-logout')?.addEventListener('click', () => MaocoAuth.logout());
  document.getElementById('profile-close')?.addEventListener('click', closeProfilePanel);
  document.getElementById('profile-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'profile-overlay') closeProfilePanel();
  });

  document.getElementById('profile-display-name')?.addEventListener('input', (e) => {
    scheduleProfileSave({ displayName: e.target.value });
    renderUserBar();
  });
  document.getElementById('profile-notes')?.addEventListener('input', (e) => {
    scheduleProfileSave({ notes: e.target.value });
  });
}

async function boot() {
  try {
    const session = await MaocoAuth.checkSession();
    if (!session || !session.user) {
      window.location.href = '/login.html';
      return;
    }

    state.user = session.user;
    state.profile = session.profile;
    window.__maocoUser = session.user;

    const data = await MaocoAuth.apiFetch('/api/dashboard');

    state.panels = data.panels;
    state.profile = data.profile || state.profile;
    document.getElementById('app-version').textContent = `v${data.version}`;

    const hash = location.hash.replace('#', '');
    const savedTab = state.profile?.lastActiveTab;
    if (hash && data.panels.some((p) => p.key === hash)) {
      state.activeTab = hash;
    } else if (savedTab && data.panels.some((p) => p.key === savedTab)) {
      state.activeTab = savedTab;
    } else {
      state.activeTab = data.panels[0]?.key || 'module-1';
    }

    renderUserBar();
    bindProfilePanel();
    renderNav(data.panels);
    renderContent(data.panels);
    setReportsLayoutMode(state.activeTab === 'module-5');
    setToolsLayoutMode(state.activeTab === 'module-4');
    loadReports();
    loadAiRedraw();
  } catch (err) {
    if (err.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    document.getElementById('content').innerHTML =
      '<div class="card"><h3>加载失败</h3><p>无法获取面板数据，请检查服务是否正常运行。</p></div>';
    console.error(err);
  }
}

document.getElementById('menu-btn').addEventListener('click', () => toggleSidebar());
document.getElementById('sidebar-overlay').addEventListener('click', () => toggleSidebar(false));
window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '');
  if (hash) switchTab(hash);
});

boot();
