// 通用分享中转页：H5 navigateTo 进入，用户点 open-type=share 触发 onShareAppMessage。
//
// Query:
//   path      必填，H5 路径（/battle/party/xxx 或完整 https://xiaoce.fun/...）
//   title     可选，分享卡片标题，默认「猜盐」
//   hint      可选，页内说明文案
//
// 示例（H5）:
//   tt.miniProgram.navigateTo({
//     url: '/pages/share/share?path=' + encodeURIComponent('/battle/party/1') + '&title=' + encodeURIComponent('加入我的派对'),
//   });

const shareUtil = require('../../utils/share.js');

const DEFAULT_HINT = '分享给抖音好友，对方打开小程序即可访问';

function decodeQuery(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function logShareParamsInvalid(query, rawPath, h5Path, title, hint) {
  console.warn('[Share] 分享参数无效', {
    query,
    queryDecoded: {
      path: query && query.path ? decodeQuery(query.path, '') : '',
      title: decodeQuery(query && query.title, ''),
      hint: decodeQuery(query && query.hint, ''),
    },
    resolved: { rawPath, h5Path, title, hint },
    pageStack: getCurrentPages().map(function (p) { return p.route; }),
  });
}

Page({
  data: {
    shareTitle: shareUtil.DEFAULT_SHARE_TITLE,
    hint: DEFAULT_HINT,
  },

  onLoad(query) {
    const rawPath = query && query.path ? decodeQuery(query.path, '') : '';
    const title = decodeQuery(query && query.title, shareUtil.DEFAULT_SHARE_TITLE);
    const hint = decodeQuery(query && query.hint, DEFAULT_HINT);

    const h5Path = shareUtil.toH5Path(rawPath || '/');
    if (!rawPath || h5Path === '/') {
      logShareParamsInvalid(query, rawPath, h5Path, title, hint);
      tt.showToast({ title: '分享参数无效', icon: 'none' });
      setTimeout(() => this.goBack(), 1500);
      return;
    }

    this._h5Path = h5Path;
    this._sharePayload = shareUtil.buildShare(title, h5Path);

    this.setData({
      shareTitle: this._sharePayload.title,
      hint,
    });
    tt.setNavigationBarTitle({ title: '分享' });
  },

  onShareAppMessage() {
    return this._sharePayload || shareUtil.buildShare(shareUtil.DEFAULT_SHARE_TITLE, '/');
  },

  goBack() {
    const fallback =
      '/pages/web/web?path=' + encodeURIComponent(this._h5Path || '/');
    tt.navigateBack({
      fail: () => {
        tt.redirectTo({ url: fallback });
      },
    });
  },
});
