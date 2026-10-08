// 공지 본문은 매니저가 쓴다. 매니저 계정이 털려도 tel:·sms:·market:// 같은 스킴으로
// 앱 밖 동작을 일으키지 못하게 웹 링크만 연다.
export const isWebUrl = (url) => /^https?:\/\//i.test(String(url || '').trim());
