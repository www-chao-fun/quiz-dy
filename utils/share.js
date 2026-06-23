// 抖音小程序分享：H5 路径规范化 + 小程序卡片 path（供 web / share 页复用）

const H5_ORIGIN = 'https://xiaoce.fun';
const DEFAULT_SHARE_TITLE = '猜盐';

function toH5Path(input) {
  if (!input || typeof input !== 'string') return '/';
  const trimmed = input.trim();
  if (!trimmed) return '/';
  const base = trimmed.startsWith('http')
    ? trimmed
    : H5_ORIGIN + (trimmed.startsWith('/') ? trimmed : '/' + trimmed);
  try {
    const u = new URL(base);
    u.searchParams.delete('dy_code');
    return u.pathname + u.search + u.hash;
  } catch (e) {
    return '/';
  }
}

function buildShare(title, h5Path) {
  const shareTitle = (title && String(title).trim()) || DEFAULT_SHARE_TITLE;
  const path = toH5Path(h5Path);
  return {
    title: shareTitle,
    path:
      '/pages/index/index?path=' +
      encodeURIComponent(path) +
      '&title=' +
      encodeURIComponent(shareTitle),
  };
}

function toH5AbsoluteUrl(h5Path) {
  const p = toH5Path(h5Path);
  return H5_ORIGIN + (p.startsWith('/') ? p : '/' + p);
}

function appendQuery(url, params) {
  const hashIndex = url.indexOf('#');
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const query = params.filter(Boolean).join('&');
  if (!query) return url;
  return base + (base.includes('?') ? '&' : '?') + query + hash;
}

/** 拼 web-view 的 H5 src；extraParams 形如 ['dy_code=xxx'] */
function buildWebViewSrc(h5Path, extraParams) {
  const url = toH5AbsoluteUrl(h5Path || '/');
  if (!extraParams || !extraParams.length) return url;
  return appendQuery(url, extraParams);
}

module.exports = {
  H5_ORIGIN,
  DEFAULT_SHARE_TITLE,
  toH5Path,
  buildShare,
  toH5AbsoluteUrl,
  appendQuery,
  buildWebViewSrc,
};
