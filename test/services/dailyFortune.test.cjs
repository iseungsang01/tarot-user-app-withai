const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const tarotCardsPath = path.resolve('src/constants/TarotCards.js');

const dailyFortune = () => loadModule('src/utils/dailyFortune.js', {
  '../constants/TarotCards': { MAJOR_ARCANA: [{ id: 0, name: 'The Fool', nameKr: '바보' }] },
  [tarotCardsPath]: { MAJOR_ARCANA: [{ id: 0, name: 'The Fool', nameKr: '바보' }] },
});

test('daily fortune draw stays available after previous draws', () => {
  const { canDrawDailyFortune, getRemainingDraws } = dailyFortune();

  assert.equal(canDrawDailyFortune({ drawCount: 30, fortune: 'old' }), true);
  assert.equal(canDrawDailyFortune({ drawCount: 300, fortune: 'old' }), true);
  assert.equal(getRemainingDraws({ drawCount: 300 }), Infinity);
});

test('daily fortune redraw requires a rewarded ad after first draw', () => {
  const { getDrawButtonLabel, needsRewardedAdForDailyFortune } = dailyFortune();

  assert.equal(needsRewardedAdForDailyFortune(null), false);
  assert.equal(needsRewardedAdForDailyFortune({ drawCount: 1 }), true);
  assert.equal(getDrawButtonLabel(null), '오늘의 카드 뽑기');
  assert.equal(getDrawButtonLabel({ drawCount: 1 }), '광고 보고 다시 뽑기');
});
