/**
 * 카드 아트 번들. `hooks/useTarotCardImage.js` 가 `import()` 로 지연 로드한다.
 *
 * 두 벌을 둔다. `full` 은 확대 모달·결과 카드(최대 260x390dp)용이고,
 * `thumb` 은 티켓 화면 스탬프 슬롯(약 66x97dp) 10칸이 한 화면에 동시에 뜨는 자리용이다.
 * 디코딩된 비트맵은 `가로 x 세로 x 4바이트`라 스탬프에 full 을 쓰면 화면 하나가
 * 63MB를 잡는다. 파일은 `scripts/optimize-card-assets.py` 가 생성한다.
 */
const FULL_IMAGES = {
  m00: require('../../assets/card/0. The Fool.webp'),
  m01: require('../../assets/card/1. The Magician.webp'),
  m02: require('../../assets/card/2. The High Priestess.webp'),
  m03: require('../../assets/card/3. The Empress.webp'),
  m04: require('../../assets/card/4. The Emperor.webp'),
  m05: require('../../assets/card/5. The Hierophant.webp'),
  m06: require('../../assets/card/6. The Lovers.webp'),
  m07: require('../../assets/card/7. Chariot.webp'),
  m08: require('../../assets/card/8. Strength.webp'),
  m09: require('../../assets/card/9. The Hermit.webp'),
  m10: require('../../assets/card/10. Wheel of Fortune.webp'),
  m11: require('../../assets/card/11. Justice.webp'),
  m12: require('../../assets/card/12. The Hanged Man.webp'),
  m13: require('../../assets/card/13. Death.webp'),
  m14: require('../../assets/card/14. Temperance.webp'),
  m15: require('../../assets/card/15. The Devil.webp'),
  m16: require('../../assets/card/16. The Tower.webp'),
  m17: require('../../assets/card/17. The Star.webp'),
  m18: require('../../assets/card/18. The Moon.webp'),
  m19: require('../../assets/card/19. The Sun.webp'),
  m20: require('../../assets/card/20. Judgement.webp'),
  m21: require('../../assets/card/21. The World.webp'),
};

const THUMB_IMAGES = {
  m00: require('../../assets/card-thumb/0. The Fool.webp'),
  m01: require('../../assets/card-thumb/1. The Magician.webp'),
  m02: require('../../assets/card-thumb/2. The High Priestess.webp'),
  m03: require('../../assets/card-thumb/3. The Empress.webp'),
  m04: require('../../assets/card-thumb/4. The Emperor.webp'),
  m05: require('../../assets/card-thumb/5. The Hierophant.webp'),
  m06: require('../../assets/card-thumb/6. The Lovers.webp'),
  m07: require('../../assets/card-thumb/7. Chariot.webp'),
  m08: require('../../assets/card-thumb/8. Strength.webp'),
  m09: require('../../assets/card-thumb/9. The Hermit.webp'),
  m10: require('../../assets/card-thumb/10. Wheel of Fortune.webp'),
  m11: require('../../assets/card-thumb/11. Justice.webp'),
  m12: require('../../assets/card-thumb/12. The Hanged Man.webp'),
  m13: require('../../assets/card-thumb/13. Death.webp'),
  m14: require('../../assets/card-thumb/14. Temperance.webp'),
  m15: require('../../assets/card-thumb/15. The Devil.webp'),
  m16: require('../../assets/card-thumb/16. The Tower.webp'),
  m17: require('../../assets/card-thumb/17. The Star.webp'),
  m18: require('../../assets/card-thumb/18. The Moon.webp'),
  m19: require('../../assets/card-thumb/19. The Sun.webp'),
  m20: require('../../assets/card-thumb/20. Judgement.webp'),
  m21: require('../../assets/card-thumb/21. The World.webp'),
};

export const getTarotCardImage = (cardId, variant) =>
  (variant === 'thumb' ? THUMB_IMAGES : FULL_IMAGES)[cardId] || null;
