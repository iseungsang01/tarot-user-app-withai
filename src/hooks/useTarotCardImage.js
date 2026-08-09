import { useEffect, useState } from 'react';

const imageCache = new Map();

/**
 * 카드 아트를 지연 로드한다.
 *
 * @param {string} cardId 카드 id (`m00` ~ `m21`). falsy 면 로드하지 않는다
 * @param {'full'|'thumb'} [variant] 스탬프 슬롯처럼 작게 그리는 자리는 `thumb` 을 쓴다
 */
export const useTarotCardImage = (cardId, variant = 'full') => {
  const cacheKey = cardId ? `${variant}:${cardId}` : null;
  const [source, setSource] = useState(() => (cacheKey ? imageCache.get(cacheKey) || null : null));

  useEffect(() => {
    let isActive = true;

    if (!cacheKey) {
      setSource(null);
      return () => {
        isActive = false;
      };
    }

    const cachedSource = imageCache.get(cacheKey);
    if (cachedSource) {
      setSource(cachedSource);
      return () => {
        isActive = false;
      };
    }

    setSource(null);

    import('../constants/TarotCardImages')
      .then(({ getTarotCardImage }) => {
        if (!isActive) return;
        const nextSource = getTarotCardImage(cardId, variant);
        if (nextSource) imageCache.set(cacheKey, nextSource);
        setSource(nextSource);
      })
      .catch((error) => {
        console.error('Tarot card image load error:', error);
        if (isActive) setSource(null);
      });

    return () => {
      isActive = false;
    };
  }, [cardId, variant, cacheKey]);

  return source;
};
