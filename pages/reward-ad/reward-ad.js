const app = getApp();
const shareUtil = require('../../utils/share.js');

const BASE_URL = shareUtil.H5_ORIGIN;
const REWARD_AD_UNIT_ID = 'xj34y56fct3ldxwf94';

function decodeParam(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function formatError(error, fallback) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || error.errMsg || error.errString || fallback;
}

function normalizeBody(res) {
  const body = res && res.data;
  if (!body || !body.success) {
    const message =
      (body && (body.hintMessage || body.errorMessage || body.message)) ||
      '服务端返回异常';
    throw new Error(message);
  }
  return body.data || {};
}

function callApi(path, method, data, cookieHeader) {
  return new Promise((resolve, reject) => {
    const header = {
      'content-type': 'application/json',
    };
    if (cookieHeader) {
      header.Cookie = cookieHeader;
    }
    tt.request({
      url: BASE_URL + path,
      method,
      data,
      header,
      success: (res) => {
        if (!res || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('网络请求失败'));
          return;
        }
        try {
          resolve(normalizeBody(res));
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => reject(err),
    });
  });
}

function login() {
  return new Promise((resolve, reject) => {
    tt.login({
      force: false,
      success: (res) => {
        if (res && res.code) {
          resolve(res.code);
          return;
        }
        reject(new Error('抖音登录凭证为空'));
      },
      fail: (err) => reject(err),
    });
  });
}

function asPromise(result) {
  if (result && typeof result.then === 'function') {
    return result;
  }
  return Promise.resolve(result);
}

Page({
  data: {
    loading: true,
    submitting: false,
    ready: false,
    tip: '正在同步登录状态...',
    errorTitle: '',
    errorDetail: '',
  },

  onLoad(query) {
    this._token = query && query.token ? decodeParam(query.token) : '';
    this._returnPath = query && query.return ? decodeParam(query.return) : '/';
    this._scene = query && query.scene ? decodeParam(query.scene) : 'vip_modal';
    this._cookieHeader = '';
    this._nonce = '';
    this._ad = null;
    this._busy = false;
    this._adRequested = false;

    if (!this._token) {
      this.showError('领取参数缺失', '请返回后重新打开会员弹窗');
      return;
    }
    if (!tt.createRewardedVideoAd) {
      this.showError('当前环境不支持广告', '请升级抖音 App 后重试');
      return;
    }

    this.initAd();
    this.exchangeTokenForCookie();
  },

  onUnload() {
    if (this._ad) {
      if (this._closeHandler && this._ad.offClose) {
        this._ad.offClose(this._closeHandler);
      }
      if (this._errorHandler && this._ad.offError) {
        this._ad.offError(this._errorHandler);
      }
      if (this._ad.destroy) {
        this._ad.destroy();
      }
    }
  },

  initAd() {
    this._ad = tt.createRewardedVideoAd({
      adUnitId: REWARD_AD_UNIT_ID,
    });
    this._closeHandler = (data) => {
      tt.hideLoading();
      if (data && data.isEnded) {
        this.claimReward();
        return;
      }
      this._busy = false;
      this.setData({
        submitting: false,
        tip: '完整观看广告后才能领取会员',
      });
      tt.showToast({
        title: '完整观看后才能领取',
        icon: 'none',
      });
    };
    this._errorHandler = (err) => {
      console.warn('[quiz-dy reward-ad] ad error', err);
      tt.hideLoading();
      this._busy = false;
      if (!this._adRequested) return;
      const code = err && (err.errCode || err.errNo || err.code);
      const detail =
        code === 1004
          ? '当前暂无合适的广告，请稍后再试'
          : formatError(err, '广告加载失败，请稍后再试');
      this.showError('暂时无法观看广告', detail);
    };
    this._ad.onClose(this._closeHandler);
    this._ad.onError(this._errorHandler);
    try {
      asPromise(this._ad.load()).catch((err) => {
        console.warn('[quiz-dy reward-ad] preload failed', err);
      });
    } catch (err) {
      console.warn('[quiz-dy reward-ad] preload failed', err);
    }
  },

  async exchangeTokenForCookie() {
    try {
      const ticket = await callApi(
        '/api/v0/open/getTicket?token=' + encodeURIComponent(this._token),
        'GET',
        null,
        ''
      );
      if (!ticket.cookieName || !ticket.cookieValue) {
        throw new Error('登录态同步失败');
      }
      this._cookieHeader = ticket.cookieName + '=' + ticket.cookieValue;
      this.setData({
        loading: false,
        ready: true,
        tip: '观看完整广告后，可领取 10 分钟会员',
      });
    } catch (e) {
      console.warn('[quiz-dy reward-ad] getTicket failed', e);
      this.showError('登录态同步失败', formatError(e, '请返回后重新打开会员弹窗'));
    }
  },

  async handleWatchAd() {
    if (this._busy || !this._cookieHeader) return;
    this._busy = true;
    this._adRequested = true;
    this.setData({
      submitting: true,
      tip: '正在准备广告...',
      errorTitle: '',
      errorDetail: '',
    });
    try {
      const prepared = await callApi(
        '/api/v0/quiz/vip/rewardAd/prepare',
        'POST',
        { scene: this._scene },
        this._cookieHeader
      );
      if (!prepared.nonce) {
        throw new Error('领取凭证无效');
      }
      this._nonce = prepared.nonce;
      this.setData({ tip: '正在打开广告...' });
      tt.showLoading({ title: '加载广告' });
      await this.showAdWithRetry();
    } catch (e) {
      tt.hideLoading();
      this._busy = false;
      console.warn('[quiz-dy reward-ad] prepare/show failed', e);
      this.showError('暂时无法观看广告', formatError(e, '请稍后再试'));
    }
  },

  async showAdWithRetry() {
    try {
      await asPromise(this._ad.show());
    } catch (e) {
      await asPromise(this._ad.load());
      await asPromise(this._ad.show());
    }
  },

  async claimReward() {
    this.setData({
      submitting: true,
      tip: '正在领取会员...',
    });
    try {
      const dyCode = await login();
      const result = await callApi(
        '/api/v0/quiz/vip/rewardAd/claim',
        'POST',
        {
          platform: 'dy',
          dyCode,
          nonce: this._nonce,
          scene: this._scene,
        },
        this._cookieHeader
      );
      app.globalData.dyRewardAdVipResult = {
        result: 'success',
        due: result.due || '',
        returnPath: this._returnPath || '/',
      };
      this.redirectToWeb();
    } catch (e) {
      this._busy = false;
      console.warn('[quiz-dy reward-ad] claim failed', e);
      this.showError('领取失败', formatError(e, '请稍后再试'));
    }
  },

  showError(title, detail) {
    this.setData({
      loading: false,
      submitting: false,
      ready: false,
      tip: '',
      errorTitle: title || '操作失败',
      errorDetail: detail || '',
    });
  },

  goBack() {
    app.globalData.dyReturnPath = this._returnPath || '/';
    this.redirectToWeb();
  },

  redirectToWeb() {
    tt.redirectTo({
      url: '/pages/web/web',
      fail: (err) => {
        console.warn('[quiz-dy reward-ad] redirectTo web fail', err);
        if (tt.reLaunch) {
          tt.reLaunch({ url: '/pages/web/web' });
        }
      },
    });
  },
});
