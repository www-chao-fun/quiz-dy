// quiz-dy web-view：加载 H5，透传 dy_code；导航栏标题对齐微信 caiyan（onLoad 占位 + postMessage 更新）。
// postMessage 仅在分享/返回/销毁时下发，SPA 内换页需 H5 持续 postMessage，离开 web-view 时才会同步到原生栏。
// https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/tutorial/basic-ability/web-view-component

const app = getApp();
const shareUtil = require('../../utils/share.js');

const BASE_URL = shareUtil.H5_ORIGIN;
const CODE_WAIT_MS = 1500;
const DEFAULT_SHARE_TITLE = shareUtil.DEFAULT_SHARE_TITLE;
// 与微信 miniprogram/pages/index onLoad 一致，H5 标题尚未上报前的占位
const WEBVIEW_PLACEHOLDER_TITLE = '网页浏览';

const ENTRY_PATH_TITLE = {
  '/?tab=daily': '每日挑战',
  '/?tab=quiz': '测验',
  '/?tab=multiplayer': '对战',
};

/** @type {((content: { title: string; path: string }) => void) | null} */
let shareResolver = null;

const toH5Path = shareUtil.toH5Path;
const buildShare = shareUtil.buildShare;

function titleFromEntryPath(targetPath) {
  if (!targetPath) return WEBVIEW_PLACEHOLDER_TITLE;
  const pathOnly = toH5Path(targetPath).split('#')[0];
  if (ENTRY_PATH_TITLE[pathOnly]) return ENTRY_PATH_TITLE[pathOnly];
  return WEBVIEW_PLACEHOLDER_TITLE;
}

function applyNavTitle(page, title) {
  const t = (title && String(title).trim()) || WEBVIEW_PLACEHOLDER_TITLE;
  page.setData({ shareTitle: t });
  tt.setNavigationBarTitle({ title: t });
}

function latestNavigate(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const msg = list[i];
    if (msg && msg.action === 'navigate' && msg.path) {
      return {
        path: toH5Path(msg.path),
        title: msg.title || DEFAULT_SHARE_TITLE,
      };
    }
  }
  return null;
}

Page({
  data: {
    src: '',
    shareTitle: WEBVIEW_PLACEHOLDER_TITLE,
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

    let initialTitle = titleFromEntryPath(targetPath);
    if (query && query.title) {
      try {
        initialTitle = decodeURIComponent(query.title) || initialTitle;
      } catch (e) {
        initialTitle = query.title || initialTitle;
      }
    }
    applyNavTitle(this, initialTitle);

    this._sharePath = toH5Path(targetPath);

    const verifyCode = app.globalData.dyVerifyCode;
    app.globalData.dyVerifyCode = null;
    if (verifyCode) {
      let url = BASE_URL + (targetPath || '');
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}dy_verify_code=${encodeURIComponent(verifyCode)}`;
      this.setData({ src: url });
      return;
    }

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

  onShow() {
    // 从 login/pay 等原生页返回：恢复上次 H5 同步的标题（微信侧靠 data.shareTitle + 自定义导航栏）
    applyNavTitle(this, this.data.shareTitle);
  },

  onWebViewMessage(e) {
    const raw = (e && e.detail && e.detail.data) || [];
    const list = Array.isArray(raw) ? raw : [raw];
    const nav = latestNavigate(list);
    if (!nav) return;

    this._sharePath = nav.path;
    applyNavTitle(this, nav.title);

    if (shareResolver) {
      shareResolver(buildShare(this.data.shareTitle, nav.path));
      shareResolver = null;
    }
  },

  onShareAppMessage(options) {
    let path = this._sharePath || '/';
    if (options && options.webViewUrl) {
      const fromUrl = toH5Path(options.webViewUrl);
      if (fromUrl && fromUrl !== '/') path = fromUrl;
    }
    const title = this.data.shareTitle;
    return new Promise((resolve) => {
      shareResolver = (content) => resolve(content);
      setTimeout(() => {
        if (!shareResolver) return;
        shareResolver(buildShare(title, this._sharePath || path));
        shareResolver = null;
      }, 0);
    });
  },
});
