// 通用交易系统 orderEntrySchema 要求的订单详情页（最小实现）。

Page({
  data: {
    orderId: '',
  },

  onLoad(query) {
    let orderId = '';
    if (query && query.orderId) {
      orderId = decodeURIComponent(query.orderId);
    } else if (query && query.params) {
      try {
        const p = JSON.parse(decodeURIComponent(query.params));
        orderId = p.orderId || '';
      } catch (e) {
        console.warn('[quiz-dy order] parse params fail', e);
      }
    }
    this.setData({ orderId: orderId || '—' });
  },

  goBack() {
    tt.navigateBack({
      fail: () => {
        tt.redirectTo({ url: '/pages/web/web' });
      },
    });
  },
});
