const AUTH_ALERT_COOLDOWN_MS = 4000;

let lastMessage = '';
let lastShownAt = 0;

export const shouldDisplayAuthNotice = (message = '') => {
  const normalized = message || '인증이 만료되었습니다. 다시 로그인해주세요.';
  const now = Date.now();

  if (normalized === lastMessage && now - lastShownAt < AUTH_ALERT_COOLDOWN_MS) {
    return false;
  }

  lastMessage = normalized;
  lastShownAt = now;
  return true;
};

export const resetAuthNoticeState = () => {
  lastMessage = '';
  lastShownAt = 0;
};
