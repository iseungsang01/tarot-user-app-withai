import { useEffect, useState } from 'react';

const imageCache = new Map();

export const useTarotCardImage = (cardId) => {
  const [source, setSource] = useState(() => (cardId ? imageCache.get(cardId) || null : null));

  useEffect(() => {
    let isActive = true;

    if (!cardId) {
      setSource(null);
      return () => {
        isActive = false;
      };
    }

    const cachedSource = imageCache.get(cardId);
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
        const nextSource = getTarotCardImage(cardId);
        if (nextSource) imageCache.set(cardId, nextSource);
        setSource(nextSource);
      })
      .catch((error) => {
        console.error('Tarot card image load error:', error);
        if (isActive) setSource(null);
      });

    return () => {
      isActive = false;
    };
  }, [cardId]);

  return source;
};

