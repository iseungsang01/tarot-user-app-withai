const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const tarotCardsPath = path.resolve('src/constants/TarotCards.js');
const oneCardDeck = [{ id: 0, name: 'The Fool', nameKr: 'The Fool' }];
const fullMajorArcanaDeck = Array.from({ length: 22 }, (_, id) => ({
  id,
  name: `Card ${id}`,
  nameKr: `${id}`,
}));

const dailyFortune = (deck = oneCardDeck) => loadModule('src/utils/dailyFortune.js', {
  '../constants/TarotCards': { MAJOR_ARCANA: deck },
  [tarotCardsPath]: { MAJOR_ARCANA: deck },
});

test('daily fortune draw stays available after previous draws', () => {
  const { canDrawDailyFortune } = dailyFortune();

  assert.equal(canDrawDailyFortune({ drawCount: 30, fortune: 'old' }), true);
  assert.equal(canDrawDailyFortune({ drawCount: 300, fortune: 'old' }), true);
});

test('daily fortune redraw requires a rewarded ad after first draw', () => {
  const { getDrawButtonLabel, needsRewardedAdForDailyFortune } = dailyFortune();

  assert.equal(needsRewardedAdForDailyFortune(null), false);
  assert.equal(needsRewardedAdForDailyFortune({ drawCount: 1 }), true);
  assert.equal(getDrawButtonLabel(null), '오늘의 카드 뽑기');
  assert.equal(getDrawButtonLabel({ drawCount: 1 }), '광고 보고 다시 뽑기');
});

test('daily fortune maps equal random intervals to each major arcana card', () => {
  const { getUniformRandomIndex, pickRandomMajorArcana } = dailyFortune(fullMajorArcanaDeck);

  for (let expectedId = 0; expectedId < fullMajorArcanaDeck.length; expectedId += 1) {
    const randomAtMiddleOfBucket = () => (expectedId + 0.5) / fullMajorArcanaDeck.length;

    assert.equal(getUniformRandomIndex(fullMajorArcanaDeck.length, randomAtMiddleOfBucket), expectedId);
    assert.equal(pickRandomMajorArcana(randomAtMiddleOfBucket).id, expectedId);
  }
});

test('daily fortune rejects invalid random sources instead of biasing a card', () => {
  const { getUniformRandomIndex } = dailyFortune(fullMajorArcanaDeck);

  assert.throws(() => getUniformRandomIndex(22, () => 1), /range \[0, 1\)/);
  assert.throws(() => getUniformRandomIndex(22, () => -0.01), /range \[0, 1\)/);
  assert.throws(() => getUniformRandomIndex(0, () => 0), /positive integer/);
});

