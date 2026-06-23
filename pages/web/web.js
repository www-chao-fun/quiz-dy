// quiz-dy web-view：冷启动由 index 预拼 src；登录/验证回跳单独透传 code。
// postMessage 仅在分享/返回/销毁时下发，SPA 内换页需 H5 持续 postMessage，离开 web-view 时才会同步到原生栏。
// https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/tutorial/basic-ability/web-view-component

const app = getApp();
const shareUtil = require('../../utils/share.js');

const DEFAULT_SHARE_TITLE = shareUtil.DEFAULT_SHARE_TITLE;
const buildWebViewSrc = shareUtil.buildWebViewSrc;
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

    const rewardAdResult = app.globalData.dyRewardAdVipResult;
    app.globalData.dyRewardAdVipResult = null;
    if (rewardAdResult && rewardAdResult.returnPath) {
      targetPath = rewardAdResult.returnPath;
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

    if (rewardAdResult && rewardAdResult.result) {
      app.globalData.prebuiltWebViewSrc = null;
      this.setData({
        src: buildWebViewSrc(targetPath, [
          'dy_reward_ad_vip=' + encodeURIComponent(rewardAdResult.result),
          rewardAdResult.due
            ? 'dy_reward_ad_due=' + encodeURIComponent(rewardAdResult.due)
            : '',
        ]),
      });
      return;
    }

    const verifyCode = app.globalData.dyVerifyCode;
    app.globalData.dyVerifyCode = null;
    if (verifyCode) {
      app.globalData.prebuiltWebViewSrc = null;
      this.setData({
        src: buildWebViewSrc(targetPath, [
          'dy_verify_code=' + encodeURIComponent(verifyCode),
        ]),
      });
      return;
    }

    const dyCode = app.globalData.dyCode;
    app.globalData.dyCode = null;
    if (dyCode) {
      app.globalData.prebuiltWebViewSrc = null;
      this.setData({
        src: buildWebViewSrc(targetPath, [
          'dy_code=' + encodeURIComponent(dyCode),
        ]),
      });
      return;
    }

    const prebuilt = app.globalData.prebuiltWebViewSrc;
    app.globalData.prebuiltWebViewSrc = null;
    this.setData({
      src: prebuilt || buildWebViewSrc(targetPath),
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
