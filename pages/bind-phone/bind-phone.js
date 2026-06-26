// 猜盐抖音小程序：手机号授权页
// H5 通过 tt.miniProgram.navigateTo 跳入，授权后把 code + encryptedData/iv 交给 web-view 内的 H5 调后端。

const app = getApp();

Page({
  data: {
    loading: false,
    returnPath: '',
  },

  onLoad(query) {
    const ret = query && query.return ? decodeURIComponent(query.return) : '';
    this.setData({ returnPath: ret });
  },

  onGetPhoneNumber(e) {
    if (this.data.loading) return;

    const detail = (e && e.detail) || {};
    const errMsg = detail.errMsg || '';
    if (errMsg.indexOf('ok') === -1) {
      console.warn('[bind-phone] getPhoneNumber not ok:', detail);
      tt.showToast({ title: '已取消授权', icon: 'none' });
      return;
    }

    if (!detail.encryptedData || !detail.iv) {
      console.warn('[bind-phone] getPhoneNumber missing data:', detail);
      tt.showToast({ title: '获取手机号失败，请重试', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    const returnPath = this.data.returnPath;
    const encryptedData = detail.encryptedData;
    const iv = detail.iv;

    tt.login({
      success: (loginRes) => {
        if (!loginRes || !loginRes.code) {
          tt.showToast({ title: '登录失败，请重试', icon: 'none' });
          this.setData({ loading: false });
          return;
        }

        app.globalData.dyPhoneCode = loginRes.code;
        app.globalData.dyPhoneEncryptedData = encryptedData;
        app.globalData.dyPhoneIv = iv;
        app.globalData.dyReturnPath = returnPath;
        app.globalData.dyCode = null;
        app.globalData.dyVerifyCode = null;
        app.globalData.prebuiltWebViewSrc = null;

        const pages = getCurrentPages();
        if (pages.length > 1) {
          tt.navigateBack({
            fail: () => {
              tt.redirectTo({ url: '/pages/web/web' });
            },
          });
        } else {
          tt.redirectTo({ url: '/pages/web/web' });
        }
      },
      fail: (err) => {
        console.warn('[bind-phone] tt.login fail:', err);
        tt.showToast({ title: '登录失败，请重试', icon: 'none' });
        this.setData({ loading: false });
      },
    });
  },
});
