const config = require('./config');

const DEFAULT_PROMPT =
  'Enhance this image. Keep the subject, pose, background, colors, and composition exactly unchanged. ' +
  'Improve only: cinematic soft lighting, defined shadows, subtle rim light, richer material texture, finer surface detail, higher clarity. ' +
  'Do not add or remove any object. Do not recolor. Do not change text layout.';

const DEFAULT_NEGATIVE_PROMPT =
  'plastic look, over-sharpened, hallucinated detail, deformed text, changed layout, extra props, watermark';

const ANGLE_PROMPT = [
  'Using reference image as exact identity anchor.',
  'PRESERVE EXACTLY: the framed calligraphy artwork, all calligraphy strokes and text, the wooden table, the ceramic vessels, the orange fruit, the dried branches.',
  'Do NOT alter the artwork, frame, or any object.',
  '',
  'EDIT INSTRUCTIONS:',
  'Shift the camera to a slight three-quarter view, roughly 15 degrees off straight-on.',
  'Reveal a small strip of adjacent wall on one side for gentle depth.',
  'Keep the framed calligraphy as the clear focal point, viewed from a shallow angle.',
  'Extend the canvas only if the angle exposes new space: add modest floor and side wall.',
  'Maintain warm afternoon light, realistic shadows, consistent material textures, photorealistic.',
].join('\n');

const ANGLE_45_PROMPT = [
  'Using reference image as exact identity anchor.',
  'PRESERVE EXACTLY: the framed calligraphy artwork, all calligraphy strokes and text, the wooden table, the ceramic vessels, the orange fruit, the dried branches.',
  'Do NOT alter the artwork, frame, or any object.',
  '',
  'EDIT INSTRUCTIONS:',
  'Shift the camera to a strong three-quarter view, roughly 45 degrees off straight-on.',
  'Reveal a pronounced room corner with adjacent wall, floor, and ceiling for clear depth.',
  'Keep the framed calligraphy as the focal point, now seen from a strong diagonal angle.',
  'Extend the canvas substantially to fit the new viewpoint: add side wall, floor, ceiling, and background.',
  'Maintain warm afternoon light, realistic shadows, consistent material textures, photorealistic.',
].join('\n');

const ANGLE_NEGATIVE_PROMPT =
  'deformed, changed text, altered calligraphy, blurred strokes, removed frame, missing objects, ' +
  'added unrelated objects, cartoon style, illustration, oversaturated, flat lighting, distorted perspective, cut off elements';

const PROMPT_PRESETS = [
  {
    id: 'enhance',
    label: '光影质感增强',
    desc: '保持构图与内容不变，只提升光影与材质真实感',
    prompt: DEFAULT_PROMPT,
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    id: 'angle',
    label: '微角度视角',
    desc: '轻微三分之四视角（约 15°），保留主体并增加侧墙景深',
    prompt: ANGLE_PROMPT,
    negativePrompt: ANGLE_NEGATIVE_PROMPT,
  },
  {
    id: 'angle-45',
    label: '强角度视角',
    desc: '强三分之四视角（约 45°），扩展侧墙、地面与天花板景深',
    prompt: ANGLE_45_PROMPT,
    negativePrompt: ANGLE_NEGATIVE_PROMPT,
  },
];

const RESOLUTION_PRESETS = [
  { id: 'auto', label: '自动 · 约 1K（较快）', target: null },
  { id: '1024', label: '1K · 约 1024²', target: 1024 },
  { id: '1536', label: '1.5K · 约 1536²（推荐）', target: 1536 },
  { id: '2048', label: '2K · 约 2048²（最清晰）', target: 2048 },
];

function getPromptPreset(presetId) {
  return PROMPT_PRESETS.find((item) => item.id === presetId) || PROMPT_PRESETS[0];
}

function resolvePromptOptions({ prompt, preset, negativePrompt } = {}) {
  const selected = getPromptPreset(preset || 'enhance');
  const editPrompt = typeof prompt === 'string' && prompt.trim()
    ? prompt.trim()
    : selected.prompt;
  const neg = typeof negativePrompt === 'string' && negativePrompt.trim()
    ? negativePrompt.trim()
    : selected.negativePrompt;
  return {
    preset: selected.id,
    prompt: editPrompt,
    negativePrompt: neg,
  };
}

const MIN_SIDE = 512;
const MAX_SIDE = 2048;

function roundTo16(value) {
  return Math.round(value / 16) * 16;
}

function computeOutputSize(sourceWidth, sourceHeight, presetId) {
  const preset = RESOLUTION_PRESETS.find((item) => item.id === presetId);
  if (!preset?.target || !sourceWidth || !sourceHeight) return null;

  const area = preset.target * preset.target;
  const aspect = sourceWidth / sourceHeight;
  let width = roundTo16(Math.sqrt(area * aspect));
  let height = roundTo16(Math.sqrt(area / aspect));
  width = Math.min(MAX_SIDE, Math.max(MIN_SIDE, width));
  height = Math.min(MAX_SIDE, Math.max(MIN_SIDE, height));
  return `${width}*${height}`;
}

function validateSize(size) {
  if (!size || typeof size !== 'string') return null;
  const match = /^(\d+)\*(\d+)$/.exec(size.trim());
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE) return null;

  const pixels = width * height;
  if (pixels < MIN_SIDE * MIN_SIDE || pixels > MAX_SIDE * MAX_SIDE) return null;
  return `${width}*${height}`;
}

function resolveOutputSize({ size, resolution, sourceWidth, sourceHeight }) {
  const explicit = validateSize(size);
  if (explicit) return explicit;
  if (resolution && resolution !== 'auto') {
    return computeOutputSize(sourceWidth, sourceHeight, resolution);
  }
  return null;
}

function buildFullPrompt(prompt, negativePrompt) {
  return `${prompt || DEFAULT_PROMPT}\n\nNegative prompt: ${negativePrompt || DEFAULT_NEGATIVE_PROMPT}`;
}

const PROVIDERS = {
  qwen: {
    label: '通义千问 · DashScope',
    defaultUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    defaultModel: 'qwen-image-edit-plus',
  },
  volcengine: {
    label: '字节豆包 · 火山方舟',
    defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    defaultModel: 'doubao-seedream-4-0-250828',
  },
  nanobanana_ai: {
    label: 'Nano Banana 2',
    defaultUrl: 'https://api.nanobananaapi.ai/api/v1/nanobanana',
    defaultModel: 'nanobanana-2',
  },
  proxy: {
    label: 'Pixapi / Nano Banana 代理',
    defaultUrl: 'https://api.nanobananaapi.dev/v1/images/edit',
    defaultModel: 'gemini-2.5-flash-image',
  },
  google: {
    label: 'Google Gemini 直连',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/interactions',
    defaultModel: 'gemini-2.5-flash-image',
  },
};

function getProviderName() {
  const explicit = config.aiRedrawProvider || config.nanoBananaProvider;
  if (explicit && PROVIDERS[explicit]) return explicit;

  if (config.nanoBananaAiApiKey || config.nanoBananaApiKey) {
    const key = config.nanoBananaAiApiKey || config.nanoBananaApiKey;
    if (!/^(AQ\.|AIza|sk_)/.test(key)) return 'nanobanana_ai';
  }
  if (config.dashscopeApiKey) return 'qwen';
  if (config.arkApiKey) return 'volcengine';

  const genericKey = config.nanoBananaApiKey;
  if (/^(AQ\.|AIza)/.test(genericKey)) return 'google';
  if (genericKey) return 'proxy';

  return 'qwen';
}

function getApiKey(provider) {
  switch (provider) {
    case 'qwen':
      return config.dashscopeApiKey || config.qwenApiKey || config.nanoBananaApiKey;
    case 'volcengine':
      return config.arkApiKey || config.nanoBananaApiKey;
    case 'nanobanana_ai':
      return config.nanoBananaAiApiKey || config.nanoBananaApiKey;
    default:
      return config.nanoBananaApiKey;
  }
}

function resolveProvider(override) {
  if (override && PROVIDERS[override] && getApiKey(override)) {
    return override;
  }
  return getProviderName();
}

function getModel(provider, override) {
  // Banana 线路只保留 Nano Banana 2
  if (provider === 'nanobanana_ai') {
    return 'nanobanana-2';
  }

  if (override && typeof override === 'string' && override.trim()) {
    const value = override.trim();
    if (provider === 'qwen' && /^nanobanana/i.test(value)) {
      /* fall through — ignore banana model names on qwen line */
    } else {
      return value;
    }
  }

  if (provider === 'qwen') {
    if (config.qwenModel) return config.qwenModel;
    const shared = config.aiRedrawModel || config.nanoBananaModel;
    if (shared && !/^nanobanana/i.test(shared)) return shared;
    return PROVIDERS.qwen.defaultModel;
  }
  if (config.aiRedrawModel || config.nanoBananaModel) {
    return config.aiRedrawModel || config.nanoBananaModel;
  }
  return PROVIDERS[provider]?.defaultModel || 'qwen-image-edit-plus';
}

function getProviderBaseUrl(provider) {
  const meta = PROVIDERS[provider];
  if (provider === 'qwen') {
    if (config.qwenApiUrl) return config.qwenApiUrl;
    const override = config.aiRedrawApiUrl || '';
    if (/dashscope|maas\.aliyuncs\.com/i.test(override)) return override;
    return meta.defaultUrl;
  }

  const override = config.aiRedrawApiUrl || config.nanoBananaApiUrl;
  if (!override) return meta.defaultUrl;

  if (provider === 'nanobanana_ai') {
    if (/nanobananaapi\.ai/i.test(override)) return override.replace(/\/$/, '');
    return meta.defaultUrl;
  }
  if (provider === 'proxy') {
    if (/nanobananaapi\.dev|pixapi\.ai/i.test(override)) return override;
    return meta.defaultUrl;
  }
  if (provider === 'google') {
    if (/generativelanguage\.googleapis\.com/i.test(override)) return override;
    return meta.defaultUrl;
  }
  return override;
}

function isConfigured() {
  return Boolean(getApiKey('nanobanana_ai') || getApiKey('qwen') || getApiKey(getProviderName()));
}

function listLineOptions() {
  const lines = [
    {
      id: 'nanobanana_ai',
      label: 'Nano Banana 2',
      model: 'nanobanana-2',
      ready: Boolean(getApiKey('nanobanana_ai')),
    },
    {
      id: 'qwen',
      label: '通义千问',
      model: getModel('qwen'),
      ready: Boolean(getApiKey('qwen')),
    },
  ];
  return lines.filter((item) => item.ready);
}

function getStatus() {
  const provider = getProviderName();
  const meta = PROVIDERS[provider];
  const lineOptions = listLineOptions();
  return {
    ready: isConfigured(),
    provider,
    providerLabel: meta.label,
    model: getModel(provider),
    apiUrl: getProviderBaseUrl(provider),
    providers: Object.entries(PROVIDERS).map(([id, item]) => ({
      id,
      label: item.label,
      defaultModel: item.defaultModel,
    })),
    lineOptions,
    modelOptions: [],
    promptPresets: PROMPT_PRESETS.map(({ id, label, desc }) => ({ id, label, desc })),
    defaultPreset: 'enhance',
    resolutionPresets: RESOLUTION_PRESETS,
    defaultResolution: '1536',
  };
}

/**
 * @param {{ imageBase64: string, mimeType: string, prompt?: string, preset?: string, negativePrompt?: string, provider?: string, model?: string, size?: string, resolution?: string, sourceWidth?: number, sourceHeight?: number }} params
 * @returns {Promise<{ imageBase64: string, mimeType: string, size?: string }>}
 */
async function redrawImage(params) {
  const provider = resolveProvider(params.provider);
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    const err = new Error(`未配置 ${provider} 的 API Key，请在 .env 中设置`);
    err.status = 503;
    throw err;
  }

  const resolved = resolvePromptOptions(params);
  const nextParams = {
    ...params,
    prompt: resolved.prompt,
    negativePrompt: resolved.negativePrompt,
    model: getModel(provider, params.model),
  };

  switch (provider) {
    case 'qwen':
      return redrawViaQwen(nextParams);
    case 'volcengine':
      return redrawViaVolcengine(nextParams);
    case 'google':
      return redrawViaGoogle(nextParams);
    case 'nanobanana_ai':
      return redrawViaNanobananaAi(nextParams);
    default:
      return redrawViaProxy(nextParams);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapNanobananaResolution(resolution, size) {
  if (size && typeof size === 'string') {
    const width = Number(size.split('*')[0]);
    if (Number.isFinite(width)) {
      if (width >= 3000) return '4K';
      if (width >= 1400) return '2K';
      return '1K';
    }
  }
  if (resolution === '2048') return '2K';
  if (resolution === '1536') return '2K';
  return '1K';
}

function mapNanobananaAspectRatio(sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) return 'auto';
  const ratio = sourceWidth / sourceHeight;
  const options = [
    ['1:1', 1],
    ['4:5', 4 / 5],
    ['5:4', 5 / 4],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['2:3', 2 / 3],
    ['3:2', 3 / 2],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
    ['21:9', 21 / 9],
  ];
  let best = 'auto';
  let bestDiff = Infinity;
  options.forEach(([label, value]) => {
    const diff = Math.abs(ratio - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  });
  return bestDiff < 0.12 ? best : 'auto';
}

function nanobananaEndpointForModel(_model) {
  const base = getProviderBaseUrl('nanobanana_ai').replace(/\/$/, '');
  return `${base}/generate-2`;
}

async function uploadTempImage(imageBase64, mimeType) {
  const raw = Buffer.from(String(imageBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  const mime = (mimeType || 'image/png').split(';')[0];
  const ext = mime.includes('jpeg') || mime.includes('jpg')
    ? 'jpg'
    : mime.includes('webp')
      ? 'webp'
      : 'png';

  const uploadTargets = [
    {
      name: 'litterbox',
      url: 'https://litterbox.catbox.moe/resources/internals/api.php',
      attempts: 2,
      buildForm: () => {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('time', '1h');
        form.append('fileToUpload', new Blob([raw], { type: mime }), `source.${ext}`);
        return form;
      },
    },
    {
      name: 'catbox',
      url: 'https://catbox.moe/user/api.php',
      attempts: 1,
      buildForm: () => {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', new Blob([raw], { type: mime }), `source.${ext}`);
        return form;
      },
    },
    {
      name: '0x0',
      url: 'https://0x0.st',
      attempts: 2,
      buildForm: () => {
        const form = new FormData();
        form.append('file', new Blob([raw], { type: mime }), `source.${ext}`);
        return form;
      },
      parseText: (text) => text,
    },
  ];

  const errors = [];

  for (const target of uploadTargets) {
    for (let attempt = 1; attempt <= target.attempts; attempt += 1) {
      try {
        const res = await fetch(target.url, {
          method: 'POST',
          body: target.buildForm(),
        });
        const text = (await res.text()).trim();
        const parsed = target.parseText ? target.parseText(text) : text;
        if (res.ok && /^https?:\/\//i.test(parsed)) {
          return parsed;
        }
        errors.push(`${target.name}#${attempt}:${res.status}:${text.slice(0, 120) || '无响应'}`);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        errors.push(`${target.name}#${attempt}:ERR:${detail}`);
      }
    }
  }

  throwApiError(`临时图床上传失败：${errors.join(' | ').slice(0, 240)}`, 502);
}

async function waitNanobananaTask(apiKey, taskId, { timeoutMs = 300000, intervalMs = 3000 } = {}) {
  const base = getProviderBaseUrl('nanobanana_ai').replace(/\/$/, '');
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    let res;
    try {
      res = await fetch(`${base}/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throwApiError(`查询任务网络失败: ${detail}`, 502);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data.code && data.code !== 200)) {
      throwApiError(data.msg || data.message || `查询任务失败 (${res.status})`, res.status || 502);
    }

    const payload = data.data || data;
    const flag = payload.successFlag;
    if (flag === 1) {
      const resultUrl = payload.response?.resultImageUrl
        || payload.response?.result_image_url
        || payload.resultImageUrl;
      if (!resultUrl) throwApiError('任务完成但未返回结果图', 502);
      return resultUrl;
    }
    if (flag === 2 || flag === 3) {
      throwApiError(payload.errorMessage || payload.errorMsg || '生成失败', 502);
    }

    await sleep(intervalMs);
  }

  throwApiError('生成超时，请稍后重试', 504);
}

async function redrawViaNanobananaAi({
  imageBase64,
  mimeType,
  prompt,
  negativePrompt,
  model,
  size,
  resolution,
  sourceWidth,
  sourceHeight,
}) {
  const editPrompt = buildFullPrompt(prompt || DEFAULT_PROMPT, negativePrompt);
  const apiKey = getApiKey('nanobanana_ai');
  const selectedModel = model || getModel('nanobanana_ai');
  const endpoint = nanobananaEndpointForModel(selectedModel);
  const imageUrl = await uploadTempImage(imageBase64, mimeType);
  const mappedResolution = mapNanobananaResolution(resolution, size);
  const aspectRatio = mapNanobananaAspectRatio(sourceWidth, sourceHeight);

  const body = endpoint.endsWith('/generate')
    ? {
      prompt: editPrompt,
      type: 'IMAGETOIAMGE',
      numImages: 1,
      imageUrls: [imageUrl],
      image_size: aspectRatio === 'auto' ? '1:1' : aspectRatio,
      callBackUrl: 'https://httpbin.org/post',
    }
    : {
      prompt: editPrompt,
      imageUrls: [imageUrl],
      aspectRatio,
      resolution: mappedResolution,
      outputFormat: 'png',
      callBackUrl: 'https://httpbin.org/post',
    };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== 200) {
    throwApiError(data.msg || data.message || `API 请求失败 (${res.status})`, res.status || 502);
  }

  const taskId = data.data?.taskId || data.taskId;
  if (!taskId) throwApiError('未返回 taskId', 502);

  const resultUrl = await waitNanobananaTask(apiKey, taskId);
  const result = await fetchImageFromUrl(resultUrl);
  result.size = mappedResolution;
  return result;
}

async function redrawViaQwen({ imageBase64, mimeType, prompt, negativePrompt, model, size, resolution, sourceWidth, sourceHeight }) {
  const editPrompt = prompt || DEFAULT_PROMPT;
  const apiKey = getApiKey('qwen');
  const url = getProviderBaseUrl('qwen');
  const imageInput = `data:${mimeType || 'image/png'};base64,${imageBase64}`;
  const outputSize = resolveOutputSize({ size, resolution, sourceWidth, sourceHeight });

  const parameters = {
    n: 1,
    watermark: false,
    prompt_extend: false,
    negative_prompt: negativePrompt || DEFAULT_NEGATIVE_PROMPT,
  };
  if (outputSize) parameters.size = outputSize;

  const body = {
    model: model || getModel('qwen'),
    input: {
      messages: [{
        role: 'user',
        content: [
          { image: imageInput },
          { text: editPrompt },
        ],
      }],
    },
    parameters,
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throwApiError(`Qwen 网络请求失败: ${detail}`, 502);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const rawMessage = data?.message || data?.code || data?.error?.message || `API 请求失败 (${res.status})`;
    const msg = res.status === 401
      ? 'DashScope API Key 无效或已过期，请检查 .env 中的 DASHSCOPE_API_KEY / QWEN_API_KEY'
      : (typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage));
    throwApiError(msg, res.status);
  }

  const contents = data?.output?.choices?.[0]?.message?.content;
  const imageUrl = Array.isArray(contents)
    ? contents.find((item) => item?.image)?.image
    : null;

  if (!imageUrl) {
    throwApiError('千问 API 未返回图像，请稍后重试', 502);
  }

  const result = await fetchImageFromUrl(imageUrl);
  if (outputSize) result.size = outputSize;
  return result;
}

async function redrawViaVolcengine({ imageBase64, mimeType, prompt, negativePrompt, size, resolution, sourceWidth, sourceHeight }) {
  const editPrompt = prompt || DEFAULT_PROMPT;
  const apiKey = getApiKey('volcengine');
  const url = config.aiRedrawApiUrl || config.nanoBananaApiUrl || PROVIDERS.volcengine.defaultUrl;
  const imageInput = `data:${mimeType || 'image/png'};base64,${imageBase64}`;

  const outputSize = resolveOutputSize({ size, resolution, sourceWidth, sourceHeight });
  const volcSize = outputSize && Number(outputSize.split('*')[0]) >= 1536
    ? '2K'
    : (config.volcengineImageSize || '2K');

  const body = {
    model: getModel('volcengine'),
    prompt: buildFullPrompt(editPrompt, negativePrompt),
    image: imageInput,
    size: volcSize,
    sequential_image_generation: 'disabled',
    response_format: 'b64_json',
    watermark: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `API 请求失败 (${res.status})`;
    throwApiError(msg, res.status);
  }

  const parsed = await parseOpenAiImageResponse(data);
  if (!parsed) {
    throwApiError('火山方舟 API 未返回图像，请稍后重试', 502);
  }
  return parsed;
}

async function redrawViaGoogle({ imageBase64, mimeType, prompt, negativePrompt }) {
  const editPrompt = prompt || DEFAULT_PROMPT;
  const apiKey = getApiKey('google');
  const baseUrl = config.aiRedrawApiUrl || config.nanoBananaApiUrl || PROVIDERS.google.defaultUrl;
  const url = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;

  const body = {
    model: getModel('google'),
    input: [
      { type: 'text', text: buildFullPrompt(editPrompt, negativePrompt) },
      {
        type: 'image',
        mime_type: mimeType || 'image/png',
        data: imageBase64,
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwApiError(data?.error?.message || data?.message || `API 请求失败 (${res.status})`, res.status);
  }

  const outputImage = data.output_image || findOutputImage(data);
  if (!outputImage?.data) {
    throwApiError('API 未返回图像数据，请稍后重试', 502);
  }

  return {
    imageBase64: outputImage.data,
    mimeType: outputImage.mime_type || 'image/png',
  };
}

async function redrawViaProxy({ imageBase64, mimeType, prompt, negativePrompt }) {
  const editPrompt = prompt || DEFAULT_PROMPT;
  const apiKey = getApiKey('proxy');
  const url = config.aiRedrawApiUrl || config.nanoBananaApiUrl || PROVIDERS.proxy.defaultUrl;
  const imageInput = `data:${mimeType || 'image/png'};base64,${imageBase64}`;

  const body = {
    prompt: buildFullPrompt(editPrompt, negativePrompt),
    image: imageInput,
    num: 1,
    model: getModel('proxy'),
    response_format: 'b64_json',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || (data.code && data.code !== 200 && data.code !== 0)) {
    const msg = data?.message || data?.error?.message || data?.error || `API 请求失败 (${res.status})`;
    throwApiError(msg, res.status >= 500 ? 502 : 400);
  }

  const parsed = await parseOpenAiImageResponse(data);
  if (!parsed) {
    throwApiError('API 未返回图像数据，请稍后重试', 502);
  }
  return parsed;
}

async function parseOpenAiImageResponse(data) {
  const items = normalizeProxyItems(data);
  if (!items.length) return null;

  const first = items[0];
  if (typeof first === 'string') {
    return fetchImageFromUrl(first);
  }

  const b64 = first.b64_json || first.base64;
  if (b64) {
    const raw = b64.replace(/^data:[^;]+;base64,/, '');
    return {
      imageBase64: raw,
      mimeType: guessMimeFromDataUrl(b64) || 'image/png',
    };
  }

  if (first.url) {
    return fetchImageFromUrl(first.url);
  }

  return null;
}

function normalizeProxyItems(data) {
  if (Array.isArray(data?.data)) return data.data;
  if (data?.data?.url) return [data.data];
  if (data?.data?.b64_json) return [data.data];
  if (Array.isArray(data?.images)) return data.images;
  return [];
}

async function fetchImageFromUrl(imageUrl) {
  let res;
  try {
    res = await fetch(imageUrl);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throwApiError(`下载结果图片失败: ${detail}`, 502);
  }
  if (!res.ok) {
    throwApiError(`无法下载结果图片 (${res.status})`, 502);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type') || 'image/png';
  return {
    imageBase64: buffer.toString('base64'),
    mimeType: mimeType.split(';')[0],
  };
}

function guessMimeFromDataUrl(value) {
  const match = /^data:([^;]+);base64,/.exec(value);
  return match ? match[1] : null;
}

function findOutputImage(data) {
  const outputs = data.outputs || data.output || [];
  const list = Array.isArray(outputs) ? outputs : [outputs];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    if (item?.type === 'image' && item.data) return item;
    if (item?.image?.data) return item.image;
  }
  return null;
}

function throwApiError(message, status) {
  const err = new Error(message);
  err.status = status >= 500 ? 502 : (status || 400);
  throw err;
}

module.exports = {
  DEFAULT_PROMPT,
  DEFAULT_NEGATIVE_PROMPT,
  PROMPT_PRESETS,
  PROVIDERS,
  RESOLUTION_PRESETS,
  computeOutputSize,
  validateSize,
  resolvePromptOptions,
  getPromptPreset,
  getStatus,
  isConfigured,
  redrawImage,
};
