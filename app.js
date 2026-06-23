// quiz-dy 小程序壳：冷启动不再静默 tt.login；用户从原生 login 页授权时写入 dyCode 回跳。

App({
  globalData: {
    dyCode: null,
    prebuiltWebViewSrc: null,
    dyRewardAdVipResult: null,
  },

  onLaunch() {},
});
