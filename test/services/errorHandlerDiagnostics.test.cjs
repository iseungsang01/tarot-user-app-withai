const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const loadErrorHandler = (isDev) => {
  const recorded = [];
  globalThis.__DEV__ = isDev;
  const mod = loadModule('src/utils/errorHandler.js', {
    './diagnostics': { recordDiagnostic: (context, error, extra) => recorded.push({ context, code: error?.code, extra }) },
    './errorEmitter': { errorEmitter: { emit: () => {} } },
    './dialog': { dialog: { alert: async () => {} } },
  });
  return { ...mod, recorded };
};

test('errorHandler: release builds record errors instead of dropping them', async () => {
  const originalDev = globalThis.__DEV__;
  try {
    // 예전에는 프로덕션에서 그냥 return 해서 출시된 앱의 에러가 어디에도 남지 않았다
    const { handleApiCall, recorded } = loadErrorHandler(false);

    await handleApiCall('TicketScreen.useCoupon', async () => ({
      error: Object.assign(new Error('실패'), { code: 'coupon_redemption_failed' }),
    }));

    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].context, 'TicketScreen.useCoupon');
    assert.equal(recorded[0].code, 'coupon_redemption_failed');
  } finally {
    globalThis.__DEV__ = originalDev;
  }
});

test('errorHandler: silenced codes stay out of the console but still reach the diagnostic log', async () => {
  const originalDev = globalThis.__DEV__;
  const originalConsoleError = console.error;
  const consoleErrors = [];
  console.error = (...args) => consoleErrors.push(args);

  try {
    const { handleApiCall, recorded } = loadErrorHandler(true);

    await handleApiCall(
      'TicketScreen.useCoupon',
      async () => ({ error: Object.assign(new Error('오답'), { code: 'invalid_admin_password' }) }),
      { silentErrorCodes: ['invalid_admin_password'] },
    );

    // 관리자 비밀번호 오답은 매장에서 흔한 입력 실수라 콘솔을 더럽히지 않는다.
    // 그래도 쿠폰이 왜 안 됐는지 되짚을 때 필요한 신호라 기록은 남아야 한다.
    assert.equal(consoleErrors.length, 0);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].code, 'invalid_admin_password');
  } finally {
    console.error = originalConsoleError;
    globalThis.__DEV__ = originalDev;
  }
});
