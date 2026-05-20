// 抖音小程序支付中转页：H5 navigateTo 进入，拉取签名包后 requestOrder + getOrderPayment。
//
// 流程：
//   H5 → createOrder → navigateTo('/pages/pay/pay?out_order_no=...')
//   本页 GET payPayload → tt.requestOrder → tt.getOrderPayment
//   失败时在本页展示错误信息与返回按钮；成功则自动 navigateBack

const BASE_URL = 'https://xiaoce.fun';

function logPayError(stage, outOrderNo, err, extra) {
  const detail = {
    stage,
    outOrderNo,
    errNo: err && (err.errNo || err.errno || err.code),
    errMsg: err && (err.errMsg || err.errString || err.message),
    errLogId: err && err.errLogId,
    err: err || null,
    extra: extra || null,
  };
  try {
    console.error('[quiz-dy pay]', JSON.stringify(detail));
  } catch (e) {
    console.error('[quiz-dy pay]', stage, outOrderNo, err, extra);
  }
}

function formatErrMsg(raw) {
  if (!raw) return '支付失败';
  const s = String(raw);
  return s.replace(/^(requestOrder|getOrderPayment):fail\s*/i, '').trim() || s;
}

Page({
  data: {
    loading: true,
    tip: '正在唤起支付…',
    errorTitle: '',
    errorDetail: '',
    errLogId: '',
  },

  onLoad(query) {
    this._outOrderNo =
      query && query.out_order_no ? decodeURIComponent(query.out_order_no) : '';

    console.log('[quiz-dy pay] onLoad', { query, outOrderNo: this._outOrderNo });

    if (!this._outOrderNo) {
      logPayError('onLoad_missing_out_order_no', '', null, { query });
      this.showError('支付参数缺失', '缺少订单号，请返回后重新发起支付');
      return;
    }

    if (!tt.requestOrder || !tt.getOrderPayment) {
      logPayError('api_not_available', this._outOrderNo, null, {
        hasRequestOrder: !!tt.requestOrder,
        hasGetOrderPayment: !!tt.getOrderPayment,
      });
      this.showError(
        '当前环境不支持支付',
        '请升级抖音 App 到最新版本，并确认小程序已重新上传发布'
      );
      return;
    }

    const url =
      BASE_URL +
      '/api/v0/dypay/payPayload?orderId=' +
      encodeURIComponent(this._outOrderNo);
    console.log('[quiz-dy pay] payPayload request', url);

    tt.request({
      url,
      method: 'GET',
      success: (res) => {
        console.log('[quiz-dy pay] payPayload http', {
          statusCode: res.statusCode,
          outOrderNo: this._outOrderNo,
          body: res.data,
        });
        const body = res.data;
        if (!body || !body.success || !body.data) {
          logPayError('payPayload_business_fail', this._outOrderNo, null, {
            statusCode: res.statusCode,
            body,
          });
          const msg = (body && body.errorMessage) || '获取支付参数失败';
          this.showError('获取支付参数失败', msg);
          return;
        }
        let data = body.data.data;
        const byteAuthorization = body.data.byteAuthorization;
        if (!data || !byteAuthorization) {
          logPayError('payPayload_incomplete', this._outOrderNo, null, {
            hasData: !!data,
            hasAuth: !!byteAuthorization,
          });
          this.showError('支付参数无效', '服务端返回的签名包不完整，请返回后重新下单');
          return;
        }
        if (typeof data !== 'string') {
          logPayError('payPayload_data_not_string', this._outOrderNo, null, {
            dataType: typeof data,
          });
          this.showError('支付参数格式错误', '订单 data 须为字符串，请稍后重试');
          return;
        }
        const authStr =
          typeof byteAuthorization === 'string'
            ? byteAuthorization
            : String(byteAuthorization);
        console.log('[quiz-dy pay] payPayload ok', {
          outOrderNo: this._outOrderNo,
          dataLen: data.length,
        });
        this.invokeTradePay(data, authStr, this._outOrderNo);
      },
      fail: (err) => {
        logPayError('payPayload_http_fail', this._outOrderNo, err, { url });
        this.showError('网络异常', '无法连接支付服务，请检查网络后重试');
      },
    });
  },

  invokeTradePay(dataStr, byteAuthorization, outOrderNo) {
    this.setData({ loading: true, tip: '正在唤起支付…' });
    console.log('[quiz-dy pay] requestOrder start', { outOrderNo, dataLen: dataStr.length });
    tt.requestOrder({
      data: dataStr,
      byteAuthorization: byteAuthorization,
      success: (res) => {
        console.log('[quiz-dy pay] requestOrder success', res, 'outOrderNo=', outOrderNo);
        const tradeOrderId = res && res.orderId;
        if (!tradeOrderId) {
          logPayError('requestOrder_no_orderId', outOrderNo, null, { res });
          this.showError('预下单失败', '未获取到平台订单号，请返回后重试');
          return;
        }
        this.setData({ tip: '正在打开收银台…' });
        console.log('[quiz-dy pay] getOrderPayment start', { outOrderNo, tradeOrderId });
        tt.getOrderPayment({
          orderId: tradeOrderId,
          success: (payRes) => {
            console.log('[quiz-dy pay] getOrderPayment success', payRes, 'outOrderNo=', outOrderNo);
            this.navigateBack();
          },
          fail: (err) => {
            logPayError('getOrderPayment_fail', outOrderNo, err, { tradeOrderId });
            this.showPayFail(err);
          },
        });
      },
      fail: (err) => {
        logPayError('requestOrder_fail', outOrderNo, err, null);
        this.showPayFail(err);
      },
    });
  },

  showPayFail(err) {
    const code = err && (err.errNo || err.errno || err.code);
    if (code === 9 || code === '9') {
      this.showError('已取消支付', '', err && err.errLogId);
      return;
    }
    const raw = (err && (err.errMsg || err.errString)) || '支付失败';
    const detail = formatErrMsg(raw);
    const errNo = code != null ? '错误码 ' + code : '';
    this.showError(
      '支付失败',
      [detail, errNo].filter(Boolean).join('\n'),
      err && err.errLogId
    );
  },

  showError(title, detail, errLogId) {
    this.setData({
      loading: false,
      errorTitle: title || '支付失败',
      errorDetail: detail || '',
      errLogId: errLogId ? String(errLogId) : '',
    });
  },

  goBack() {
    this.navigateBack();
  },

  navigateBack() {
    tt.navigateBack({
      delta: 1,
      fail: (err) => {
        console.warn('[quiz-dy pay] navigateBack fail', err);
        tt.redirectTo({ url: '/pages/web/web' });
      },
    });
  },
});
