const state = {
  dataUrl: '',
  mimeType: 'image/png',
  width: 0,
  height: 0,
  resultUrl: '',
  resultDataUrl: '',
  resultMimeType: 'image/png',
  resultObjectUrl: '',
};

const fileInput = document.getElementById('fileInput');
const srcImg = document.getElementById('srcImg');
const outImg = document.getElementById('outImg');
const runBtn = document.getElementById('runBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');
const historyList = document.getElementById('historyList');

function setStatus(msg, isError) {
  statusEl.textContent = msg || '';
  statusEl.style.color = isError ? '#b42318' : '#6d5d4a';
}

function toBase64(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mimeType: m[1], imageBase64: m[2] };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function readImageSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('读取图片尺寸失败'));
    img.src = url;
  });
}

function apiUrl(path) {
  const base = window.location.origin;
  if (!base || base === 'null') return path;
  return `${base}${path}`;
}

function revokeResultObjectUrl() {
  if (!state.resultObjectUrl) return;
  URL.revokeObjectURL(state.resultObjectUrl);
  state.resultObjectUrl = '';
}

async function loadImageSource(url) {
  if (!url) throw new Error('缺少结果图片地址');
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const res = await fetch(apiUrl(url), {
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`结果图片请求失败（${res.status}）`);
  }

  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error(`结果资源不是图片：${blob.type || 'unknown'}`);
  }

  revokeResultObjectUrl();
  state.resultObjectUrl = URL.createObjectURL(blob);
  return state.resultObjectUrl;
}

async function setResultImage(primaryUrl, fallbackUrl) {
  const targets = [primaryUrl, fallbackUrl].filter(Boolean);
  let lastError = null;

  for (const target of targets) {
    try {
      outImg.src = await loadImageSource(target);
      setStatus('重绘完成');
      return;
    } catch (error) {
      lastError = error;
    }
  }

  outImg.src = '';
  setStatus(lastError instanceof Error ? lastError.message : '结果图片加载失败', true);
}

async function loadHistory() {
  try {
    const res = await fetch(apiUrl('/api/tools/ai-redraw/history'), {
      credentials: 'same-origin',
    });
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    historyList.innerHTML = '';
    items.forEach((it) => {
      const li = document.createElement('li');
      li.innerHTML = `<img src="${it.resultUrl}" alt="history"><p>${it.preset || 'enhance'} · ${new Date(it.createdAt).toLocaleString()}</p>`;
      li.addEventListener('click', async () => {
        await setResultImage(it.resultUrl, state.resultDataUrl);
        state.resultUrl = it.resultUrl;
        state.resultDataUrl = it.resultUrl;
        state.resultMimeType = 'image/png';
        downloadBtn.disabled = false;
      });
      historyList.appendChild(li);
    });
  } catch (err) {
    setStatus('加载历史失败', true);
  }
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('请上传图片文件', true);
    return;
  }
  state.dataUrl = await readFileAsDataUrl(file);
  const size = await readImageSize(state.dataUrl);
  state.width = size.width;
  state.height = size.height;
  const payload = toBase64(state.dataUrl);
  state.mimeType = payload.mimeType;
  state.resultUrl = '';
  state.resultDataUrl = '';
  state.resultMimeType = 'image/png';
  revokeResultObjectUrl();
  downloadBtn.disabled = true;
  srcImg.src = state.dataUrl;
  outImg.src = '';
  setStatus(`已加载 ${state.width}x${state.height}`);
});

downloadBtn.addEventListener('click', () => {
  if (!state.resultDataUrl) {
    setStatus('还没有可下载的结果', true);
    return;
  }

  const link = document.createElement('a');
  link.href = state.resultUrl || state.resultDataUrl;
  link.download = `ai-redraw-${Date.now()}.${state.resultMimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

runBtn.addEventListener('click', async () => {
  if (!state.dataUrl) {
    setStatus('请先上传图片', true);
    return;
  }

  const payload = toBase64(state.dataUrl);
  const preset = document.getElementById('preset').value;
  const resolution = document.getElementById('resolution').value;

  setStatus('正在重绘，请稍候...');
  runBtn.disabled = true;

  try {
    const res = await fetch(apiUrl('/api/tools/ai-redraw'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        imageBase64: payload.imageBase64,
        mimeType: payload.mimeType,
        preset,
        resolution,
        sourceWidth: state.width,
        sourceHeight: state.height,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);

    const resultDataUrl = `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`;
    const resultUrl = data.historyItem?.resultUrl || '';
    state.resultUrl = resultUrl;
    state.resultDataUrl = resultDataUrl;
    state.resultMimeType = data.mimeType || 'image/png';
    downloadBtn.disabled = false;
    await setResultImage(resultUrl || resultDataUrl, resultUrl ? resultDataUrl : '');
    await loadHistory();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    setStatus(detail === 'Failed to fetch'
      ? '网络请求失败：请确认 NAS 服务是否已启动，且当前页面就是这个应用的站点地址'
      : detail || '重绘失败', true);
  } finally {
    runBtn.disabled = false;
  }
});

loadHistory();
