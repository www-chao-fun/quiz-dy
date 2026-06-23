// 抖音小程序原生登录页：H5 通过 tt.miniProgram.navigateTo 跳进来。
//
// 当前模式：一键授权登录（tt.login → code → 后端 code2Session 拿 openid 登录）
// 备用模式：手机号登录（getPhoneNumber + tt.login，需要小程序后台开通「获取手机号」能力）
//          相关代码已注释在 onGetPhoneNumber，等能力审核通过后切回来。

const app = getApp();

Page({
  data: {
    loading: false,
    // H5 跳过来时通过 query.return 带过来的回跳路径，登录成功后让 web-view 落回原页面
    returnPath: '',
    mode: 'login',
  },

  onLoad(query) {
    const ret = query && query.return ? decodeURIComponent(query.return) : '';
    const mode = query && query.mode === 'verify' ? 'verify' : 'login';
    this.setData({ returnPath: ret, mode });
  },

  // 身份验证（改密 / step-up）：仅 tt.login，回跳 H5 时带 dy_verify_code
  onTapVerify() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const returnPath = this.data.returnPath;

    tt.login({
      success: (res) => {
        if (!res || !res.code) {
          console.warn('[quiz-dy login] tt.login no code:', res);
          tt.showToast({ title: '授权失败，请重试', icon: 'none' });
          this.setData({ loading: false });
          return;
        }

        app.globalData.dyVerifyCode = res.code;
        app.globalData.dyReturnPath = returnPath;
        app.globalData.dyCode = null;
        app.globalData.prebuiltWebViewSrc = null;
        app.globalData.dyPhoneCode = null;
        app.globalData.dyPhoneEncryptedData = null;
        app.globalData.dyPhoneIv = null;

        tt.redirectTo({
          url: '/pages/web/web',
          fail: (err) => {
            console.warn('[quiz-dy login] redirectTo fail:', err);
            this.setData({ loading: false });
            tt.showToast({ title: '跳转失败', icon: 'none' });
          },
        });
      },
      fail: (err) => {
        console.warn('[quiz-dy login] tt.login fail:', err);
        tt.showToast({ title: '已取消授权', icon: 'none' });
        this.setData({ loading: false });
      },
    });
  },

  // 一键授权登录：调 tt.login 拿 fresh code，写到 globalData，然后 redirectTo 回 index
  onTapLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const returnPath = this.data.returnPath;

    tt.login({
      success: (res) => {
        if (!res || !res.code) {
          console.warn('[quiz-dy login] tt.login no code:', res);
          tt.showToast({ title: '登录失败，请重试', icon: 'none' });
          this.setData({ loading: false });
          return;
        }

        app.globalData.dyCode = res.code;
        app.globalData.dyReturnPath = returnPath;
        app.globalData.prebuiltWebViewSrc = null;
        // 清掉其它模式的字段，避免老数据残留
        app.globalData.dyPhoneCode = null;
        app.globalData.dyPhoneEncryptedData = null;
        app.globalData.dyPhoneIv = null;
        app.globalData.dyVerifyCode = null;

        // 注意：首屏 /pages/index/index 已经改成原生加载页（抖音不允许首屏直接是 web-view），
        // 这里要回跳到承载 web-view 的中转页 /pages/web/web，由它读取 dyReturnPath 落回原 H5 页面。
        tt.redirectTo({
          url: '/pages/web/web',
          fail: (err) => {
            console.warn('[quiz-dy login] redirectTo fail:', err);
            this.setData({ loading: false });
            tt.showToast({ title: '跳转失败', icon: 'none' });
          },
        });
      },
      fail: (err) => {
        console.warn('[quiz-dy login] tt.login fail:', err);
        tt.showToast({ title: '已取消授权', icon: 'none' });
        this.setData({ loading: false });
      },
    });
  },

  // ---- 手机号登录回调（暂时停用，等抖音「获取手机号」能力审核通过再启用）----
  //
  // onGetPhoneNumber(e) {
  //   if (this.data.loading) return;
  //   const detail = (e && e.detail) || {};
  //   const errMsg = detail.errMsg || '';
  //   if (errMsg.indexOf('ok') === -1) {
  //     // platform auth deny: 平台没开通能力；fail auth deny: 用户拒绝
  //     console.warn('[quiz-dy login] getPhoneNumber not ok:', detail);
  //     tt.showToast({ title: '已取消授权', icon: 'none' });
  //     return;
  //   }
  //   if (!detail.encryptedData || !detail.iv) {
  //     console.warn('[quiz-dy login] getPhoneNumber missing data:', detail);
  //     tt.showToast({ title: '获取手机号失败，请重试', icon: 'none' });
  //     return;
  //   }
  //
  //   this.setData({ loading: true });
  //   const returnPath = this.data.returnPath;
  //   const encryptedData = detail.encryptedData;
  //   const iv = detail.iv;
  //
  //   tt.login({
  //     success: (loginRes) => {
  //       if (!loginRes || !loginRes.code) {
  //         tt.showToast({ title: '登录失败，请重试', icon: 'none' });
  //         this.setData({ loading: false });
  //         return;
  //       }
  //       app.globalData.dyPhoneCode = loginRes.code;
  //       app.globalData.dyPhoneEncryptedData = encryptedData;
  //       app.globalData.dyPhoneIv = iv;
  //       app.globalData.dyReturnPath = returnPath;
  //       app.globalData.dyCode = null;
  //       app.globalData.dyCodePromise = Promise.resolve(null);
  //       tt.redirectTo({
  //         url: '/pages/web/web',
  //         fail: (err) => {
  //           console.warn('[quiz-dy login] redirectTo fail:', err);
  //           this.setData({ loading: false });
  //           tt.showToast({ title: '跳转失败', icon: 'none' });
  //         },
  //       });
  //     },
  //     fail: (err) => {
  //       console.warn('[quiz-dy login] tt.login fail:', err);
  //       tt.showToast({ title: '登录失败，请重试', icon: 'none' });
  //       this.setData({ loading: false });
  //     },
  //   });
  // },
});
