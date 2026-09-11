const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createStorageMock = (session = { token: 'session-token', customerId: 'customer-1' }) => ({
  get: async (key) => (key === 'tarot_customer_session' ? session : null),
});

const createNoticeTableMock = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => ({ order: async () => ({ data: [], error: null }) }),
      }),
    }),
  }),
});

test('noticeService: leaves report_type to the server default when the caller omits it', async () => {
  const calls = [];
  const supabaseClient = {
    submitBugReport: async (payload) => {
      calls.push(payload);
      return { data: { id: 3 }, error: null };
    },
  };

  const { noticeService } = loadModule('src/services/noticeService.js', {
    './supabase': { supabase: createNoticeTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  await noticeService.submitReport({ title: '제목', description: '내용' });

  // 매니저가 report_type 을 ASCII 코드로 정규화했다. 한글 문자열을 다시 보내기
  // 시작하면 CHECK 가 걸린 환경에서 접수가 거부된다.
  assert.equal(calls[0].p_report_type, null);
});

test('noticeService: loads my bug reports through customer-session RPC', async () => {
  const calls = [];
  const reports = [{ id: 1, customer_id: 'customer-1', title: 'bug' }];
  const supabaseClient = {
    getMyBugReports: async (payload) => {
      calls.push(payload);
      return { data: reports, error: null };
    },
  };

  const { noticeService } = loadModule('src/services/noticeService.js', {
    './supabase': { supabase: createNoticeTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await noticeService.getMyReports('customer-1');

  assert.deepEqual(calls, [{ p_session_token: 'session-token' }]);
  assert.deepEqual(result, { data: reports, error: null });
});

test('noticeService: submits bug reports through customer-session RPC without trusting caller customer id', async () => {
  const calls = [];
  const supabaseClient = {
    submitBugReport: async (payload) => {
      calls.push(payload);
      return { data: { id: 2, customer_id: 'customer-1', title: payload.p_title }, error: null };
    },
  };

  const { noticeService } = loadModule('src/services/noticeService.js', {
    './supabase': { supabase: createNoticeTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await noticeService.submitReport({
    customer_id: 'spoofed-customer-id',
    title: 'App crash',
    description: 'Crashes on open',
    report_type: '어플 버그',
    screenshot: 'data:image/png;base64,abc',
    device_info: { os: 'android' },
  });

  assert.deepEqual(calls, [{
    p_session_token: 'session-token',
    p_title: 'App crash',
    p_description: 'Crashes on open',
    p_report_type: '어플 버그',
    p_screenshot: 'data:image/png;base64,abc',
    p_device_info: { os: 'android' },
  }]);
  assert.equal(result.data.id, 2);
  assert.equal(result.error, null);
});
