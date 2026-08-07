/**
 * 앱 테마 다이얼로그.
 *
 * React Native 의 `Alert.alert` 는 OS 기본 흰색 다이얼로그를 띄워서
 * 이 앱의 어두운 서랍 테마와 완전히 어긋난다. 시그니처는 그대로 두고
 * 렌더링만 앱 컴포넌트로 바꾼다 — 호출부는 `Alert.alert` → `dialog.alert`
 * 치환만 하면 된다.
 *
 * 흐름은 errorEmitter/GlobalErrorDisplay 와 같다.
 *   호출부 → dialog.alert() → AppDialog(호스트, App.js 에 마운트) → 렌더링
 */

let host = null;

/** AppDialog 가 마운트되며 자신을 등록한다. */
export const setDialogHost = (fn) => {
  host = fn;
};

/**
 * @param {string} title
 * @param {string} [message]
 * @param {Array<{text: string, onPress?: Function, style?: 'cancel'|'destructive'|'default'}>} [buttons]
 * @returns {Promise<void>} 닫힐 때 resolve
 */
const alert = (title, message, buttons) => new Promise((resolve) => {
  const actions = (buttons?.length ? buttons : [{ text: '확인' }]).map((button) => ({
    text: button.text,
    style: button.style || 'default',
    onPress: button.onPress,
  }));

  // 호스트가 아직 없으면(초기화 전) 조용히 넘긴다. 다이얼로그 하나 때문에
  // 호출부가 죽는 것보다 낫다.
  if (!host) {
    resolve();
    return;
  }

  host({ title, message, actions }, resolve);
});

export const dialog = { alert };
