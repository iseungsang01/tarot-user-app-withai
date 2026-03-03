/**
 * src/utils/errorEmitter.js
 *
 * 경량 EventEmitter 싱글톤.
 * React Context 외부(서비스, 유틸)에서 에러를 발행하고,
 * GlobalErrorDisplay 컴포넌트가 구독하는 방식으로 global 변수 사용을 대체합니다.
 *
 * 사용법:
 *   발행: errorEmitter.emit(errorInfo)
 *   구독: const unsub = errorEmitter.subscribe(handler); ... unsub();
 */

const createErrorEmitter = () => {
    const listeners = new Set();

    return {
        /**
         * 에러 이벤트 발행
         * @param {object} errorInfo - { type, title, message, icon }
         */
        emit(errorInfo) {
            listeners.forEach((fn) => fn(errorInfo));
        },

        /**
         * 에러 이벤트 구독
         * @param {Function} handler - (errorInfo) => void
         * @returns {Function} 구독 해제 함수
         */
        subscribe(handler) {
            listeners.add(handler);
            return () => listeners.delete(handler);
        },
    };
};

export const errorEmitter = createErrorEmitter();