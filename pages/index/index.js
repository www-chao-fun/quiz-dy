// quiz-dy 小程序首页：抖音不允许首屏直接是 web-view，所以首页只放
// 「每日挑战」「测验」「对战」三个入口按钮，点击后再 navigateTo 到
// /pages/web/web 这个 web-view 中转页，由它去加载 H5（xiaoce-front）。

// tab 名 → H5 路径（H5 端 Home 页通过 ?tab=xxx 切换）
const TAB_TO_PATH = {
  daily: '/?tab=daily',
  quiz: '/?tab=quiz',
  multiplayer: '/?tab=multiplayer',
};

const TAB_TO_TITLE = {
  daily: '每日挑战',
  quiz: '测验',
  multiplayer: '对战',
};

// 与 app.json window.navigationBarTitleText 一致；从 web-view 返回时需主动恢复
const INDEX_NAV_TITLE = '猜盐';

Page({
  onShow() {
    tt.setNavigationBarTitle({ title: INDEX_NAV_TITLE });
  },

  onTapEntry(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const tab = dataset.tab || 'daily';
    const path = TAB_TO_PATH[tab] || '/';

    const title = TAB_TO_TITLE[tab] || '猜盐';
    tt.navigateTo({
      url:
        `/pages/web/web?path=${encodeURIComponent(path)}` +
        `&title=${encodeURIComponent(title)}`,
      fail: (err) => {
        console.warn('[quiz-dy index] navigateTo web fail:', err);
        tt.showToast({ title: '打开失败，请重试', icon: 'none' });
      },
    });
  },
});
