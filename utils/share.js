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
  return {
    title: (title && String(title).trim()) || DEFAULT_SHARE_TITLE,
    path: '/pages/web/web?path=' + encodeURIComponent(toH5Path(h5Path)),
  };
}

function toH5AbsoluteUrl(h5Path) {
  const p = toH5Path(h5Path);
  return H5_ORIGIN + (p.startsWith('/') ? p : '/' + p);
}

module.exports = {
  H5_ORIGIN,
  DEFAULT_SHARE_TITLE,
  toH5Path,
  buildShare,
  toH5AbsoluteUrl,
};
