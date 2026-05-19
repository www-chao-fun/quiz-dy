// quiz-dy 小程序 web-view 中转页：把 H5（xiaoce-front）加载进来，
// 并把抖音登录所需的临时 code 通过 URL 透传过去，由 H5 端的 dyAutoLogin
// 接住完成自动登录（cookie 由后端 Set-Cookie 落到 web-view 浏览器会话里）。
//
// 入口路径：
//   /pages/web/web?path=<encodeURIComponent(H5 路径，比如 "/?tab=daily")>
//
// 也兼容从原生 login 页 redirectTo 回来时，通过 app.globalData.dyReturnPath
// 指定回跳的 H5 路径，让 web-view 落回登录前所在的页面。
//
// 分享：H5 通过 tt.miniProgram.postMessage 上报当前 path，本页 onShareAppMessage
// 把 path 写入分享链接，好友打开后落到同一 H5 页（对齐微信 caiyan 方案）。

const app = getApp();

const BASE_URL = 'https://xiaoce.fun';
const CODE_WAIT_MS = 1500;
const DEFAULT_SHARE_TITLE = '猜盐';

/** @type {((content: { title: string; path: string }) => void) | null} */
let shareResolver = null;

function normalizeH5Path(path) {
  if (!path || typeof path !== 'string') return '/';
  const trimmed = path.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return '/';
    }
  }
  return trimmed.startsWith('/') ? trimmed : '/' + trimmed;
}

function buildShareContent(title, h5Path) {
  const clean = normalizeH5Path(h5Path);
  return {
    title: title || DEFAULT_SHARE_TITLE,
    path: '/pages/web/web?path=' + encodeURIComponent(clean),
  };
}

Page({
  data: {
    src: '',
    sharePath: '/',
    shareTitle: DEFAULT_SHARE_TITLE,
    webviewKey: 0,
  },

  onLoad(query) {
    let targetPath = app.globalData.dyReturnPath || '';
    app.globalData.dyReturnPath = null;

    if (!targetPath && query && query.path) {
      try {
        targetPath = decodeURIComponent(query.path);
      } catch (e) {
        targetPath = query.path;
      }
    }

    const sharePath = normalizeH5Path(targetPath);
    this.setData({ sharePath });

    Promise.race([
      app.globalData.dyCodePromise || Promise.resolve(null),
      new Promise((resolve) => setTimeout(() => resolve(null), CODE_WAIT_MS)),
    ]).then((code) => {
      let url = BASE_URL + (targetPath || '');
      if (code) {
        const sep = url.includes('?') ? '&' : '?';
        url += `${sep}dy_code=${encodeURIComponent(code)}`;
      }
      this.setData({ src: url });
    });
  },

  onWebViewMessage(e) {
    const raw = (e && e.detail && e.detail.data) || [];
    const list = Array.isArray(raw) ? raw : [raw];
    if (!list.length) return;

    let lastPath = this.data.sharePath;
    let lastTitle = this.data.shareTitle;

    for (let i = list.length - 1; i >= 0; i--) {
      const msg = list[i];
      if (!msg || msg.action !== 'navigate' || !msg.path) continue;

      lastPath = normalizeH5Path(msg.path);
      lastTitle = msg.title || DEFAULT_SHARE_TITLE;
      this.setData({ sharePath: lastPath, shareTitle: lastTitle });
      tt.setNavigationBarTitle({ title: lastTitle });
      break;
    }

    if (shareResolver) {
      shareResolver(buildShareContent(lastTitle, lastPath));
      shareResolver = null;
    }
  },

  onShareAppMessage() {
    tt.showLoading({ title: '正在准备分享...', mask: true });
    this.setData({ webviewKey: this.data.webviewKey + 1 });

    return new Promise((resolve) => {
      shareResolver = (content) => {
        tt.hideLoading();
        resolve(content);
      };

      setTimeout(() => {
        if (!shareResolver) return;
        const fallback = buildShareContent(
          this.data.shareTitle,
          this.data.sharePath
        );
        tt.hideLoading();
        console.warn('[quiz-dy web] share timeout fallback', fallback);
        shareResolver(fallback);
        shareResolver = null;
      }, 500);
    });
  },
});
