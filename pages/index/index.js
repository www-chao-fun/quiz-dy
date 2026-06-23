// quiz-dy 小程序首页：抖音不允许首屏直接是 web-view，所以首页保持原生加载页。
// 检测到网络可用后立即 redirectTo 到 /pages/web/web，由它去加载 H5。

const shareUtil = require('../../utils/share.js');

// tab 名 → H5 路径（H5 端 Home 页通过 ?tab=xxx 切换）
const TAB_TO_PATH = {
  home: '/',
  daily: '/?tab=daily',
  quiz: '/?tab=quiz',
  multiplayer: '/?tab=multiplayer',
};

const TAB_TO_TITLE = {
  home: '猜盐',
  daily: '每日挑战',
  quiz: '测验',
  multiplayer: '对战',
};

// 与 app.json window.navigationBarTitleText 一致；从 web-view 返回时需主动恢复
const INDEX_NAV_TITLE = '猜盐';
const NETWORK_RETRY_MS = 2000;
const NETWORK_PROBE_TIMEOUT_MS = 3000;
const NETWORK_PROBE_URL = `${shareUtil.H5_ORIGIN}/favicon.ico`;

function hasNetworkType() {
  return new Promise((resolve) => {
    tt.getNetworkType({
      success: (res) => {
        const networkType = res && res.networkType;
        resolve(networkType !== 'none');
      },
      fail: () => {
        // 获取网络状态失败时继续探活，避免平台状态接口短暂异常导致误判。
        resolve(true);
      },
    });
  });
}

function probeNetwork() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (online) => {
      if (settled) return;
      settled = true;
      resolve(online);
    };

    const timer = setTimeout(() => done(false), NETWORK_PROBE_TIMEOUT_MS + 500);

    tt.request({
      url: NETWORK_PROBE_URL,
      method: 'GET',
      timeout: NETWORK_PROBE_TIMEOUT_MS,
      success: () => done(true),
      fail: () => done(false),
      complete: () => clearTimeout(timer),
    });
  });
}

async function hasNetwork() {
  if (!(await hasNetworkType())) return false;
  return probeNetwork();
}

function decodeQueryValue(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function pathFromQuery(query) {
  if (!query) return '/';
  if (query.path) return decodeQueryValue(query.path);
  if (query.tab) return TAB_TO_PATH[query.tab] || '/';
  return '/';
}

Page({
  data: {
    offline: false,
  },

  onLoad(query) {
    this._targetPath = pathFromQuery(query);
    this._targetTitle =
      decodeQueryValue(query && query.title) ||
      TAB_TO_TITLE[(query && query.tab) || 'home'] ||
      INDEX_NAV_TITLE;
    this._entering = false;
    this._networkRetryTimer = null;
    this._startLaunch();
  },

  onShow() {
    tt.setNavigationBarTitle({ title: INDEX_NAV_TITLE });
    if (this.data.offline) {
      this._startNetworkRetry();
    }
  },

  onHide() {
    this._clearNetworkRetry();
  },

  onUnload() {
    this._clearNetworkRetry();
  },

  _prebuildWebViewSrc(h5Path) {
    const app = getApp();
    app.globalData.prebuiltWebViewSrc = shareUtil.buildWebViewSrc(h5Path);
  },

  async _startLaunch() {
    if (this._entering) return;
    this._entering = true;
    this._clearNetworkRetry();
    this.setData({ offline: false });

    const h5Path = this._targetPath || '/';
    // 预拼 web-view URL 与探活并行，不阻塞跳转
    this._prebuildWebViewSrc(h5Path);
    const online = await hasNetwork();
    if (!online) {
      this._entering = false;
      this._showOffline();
      return;
    }

    this._enterWeb();
  },

  _enterWeb() {
    const path = this._targetPath || '/';
    const title = this._targetTitle || INDEX_NAV_TITLE;
    const url =
      `/pages/web/web?path=${encodeURIComponent(path)}` +
      `&title=${encodeURIComponent(title)}`;

    tt.redirectTo({
      url,
      fail: (err) => {
        console.warn('[quiz-dy index] redirectTo web fail:', err);
        tt.navigateTo({
          url,
          fail: (navigateErr) => {
            console.warn('[quiz-dy index] navigateTo web fail:', navigateErr);
            this._entering = false;
            tt.showToast({ title: '打开失败，请重试', icon: 'none' });
          },
        });
      },
    });
  },

  _showOffline() {
    this.setData({ offline: true });
    this._startNetworkRetry();
  },

  _startNetworkRetry() {
    this._clearNetworkRetry();
    this._networkRetryTimer = setInterval(async () => {
      if (await hasNetwork()) {
        this._clearNetworkRetry();
        this._startLaunch();
      }
    }, NETWORK_RETRY_MS);
  },

  _clearNetworkRetry() {
    if (this._networkRetryTimer) {
      clearInterval(this._networkRetryTimer);
      this._networkRetryTimer = null;
    }
  },

  onTapRetry() {
    this._startLaunch();
  },
});
