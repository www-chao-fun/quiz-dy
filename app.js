// quiz-dy 小程序壳：抖音 onLaunch 静默 tt.login 拿到一次性 code，
// 透传给 web-view 里的 H5（xiaoce-front），由 H5 自己调
// /api/v0/account/loginWithDyMpCode 完成自动登录（cookie 由后端 Set-Cookie 落到 web-view 浏览器会话里）。

App({
  globalData: {
    // 一次性的 tt.login code，每次 onLaunch 刷新；不要缓存到 storage（code 是一次性 + 短时效）
    dyCode: null,
    // 给页面 await 用的；不管成功失败都 resolve（失败 resolve null），避免页面写 try/catch
    dyCodePromise: null,
    dyRewardAdVipResult: null,
  },

  onLaunch() {
    this.globalData.dyCodePromise = new Promise((resolve) => {
      tt.login({
        force: false,
        success: (res) => {
          if (!res || !res.code) {
            console.warn('[quiz-dy] tt.login no code:', res);
            resolve(null);
            return;
          }
          this.globalData.dyCode = res.code;
          resolve(res.code);
        },
        fail: (err) => {
          console.warn('[quiz-dy] tt.login fail:', err);
          resolve(null);
        },
      });
    });
  },
});
