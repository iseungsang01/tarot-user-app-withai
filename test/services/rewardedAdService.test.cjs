const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const loadRewardedAdService = (mocks = {}) => loadModule('src/services/rewardedAdService.js', {
  'react-native': { Platform: { OS: 'android' } },
  ...mocks,
});

const withDevFlag = async (value, run) => {
  const previous = globalThis.__DEV__;
  globalThis.__DEV__ = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete globalThis.__DEV__;
    else globalThis.__DEV__ = previous;
  }
};

const createAdsMock = ({ reward = { type: 'redraw', amount: 1 }, initializeError = null } = {}) => {
  const listeners = {};
  const ad = {
    addAdEventListener: (eventName, callback) => {
      listeners[eventName] = callback;
      return () => {
        delete listeners[eventName];
      };
    },
    load: () => {
      listeners.loaded?.();
    },
    show: () => {
      if (reward) listeners.earned_reward?.(reward);
      listeners.closed?.();
    },
  };
  const mobileAds = () => ({
    initialize: async () => {
      if (initializeError) throw initializeError;
      return { adapter: 'ready' };
    },
  });

  return {
    default: mobileAds,
    RewardedAd: {
      createForAdRequest: (unitId, requestOptions) => {
        ad.unitId = unitId;
        ad.requestOptions = requestOptions;
        return ad;
      },
    },
    RewardedAdEventType: {
      LOADED: 'loaded',
      EARNED_REWARD: 'earned_reward',
    },
    AdEventType: {
      CLOSED: 'closed',
      ERROR: 'error',
    },
    __ad: ad,
  };
};

test('rewardedAdService: fails closed when no Google Mobile Ads adapter is available', async () => {
  const { showDailyFortuneRewardedAd } = loadRewardedAdService({
    'react-native-google-mobile-ads': {},
  });

  assert.deepEqual(await showDailyFortuneRewardedAd(), {
    rewarded: false,
    reason: 'missing_rewarded_ad_adapter',
  });
});

test('rewardedAdService: shows AdMob rewarded ad and resolves only after earned reward', async () => {
  await withDevFlag(true, async () => {
    const adsMock = createAdsMock();
    const { showDailyFortuneRewardedAd } = loadRewardedAdService({
      'react-native-google-mobile-ads': adsMock,
    });

    assert.deepEqual(await showDailyFortuneRewardedAd(), {
      rewarded: true,
      reward: { type: 'redraw', amount: 1 },
    });
    assert.equal(adsMock.__ad.unitId, 'ca-app-pub-3940256099942544/5224354917');
    assert.deepEqual(adsMock.__ad.requestOptions, { requestNonPersonalizedAdsOnly: true });
  });
});

test('rewardedAdService: fails closed when ad closes before reward is earned', async () => {
  await withDevFlag(true, async () => {
    const adsMock = createAdsMock({ reward: null });
    const { showDailyFortuneRewardedAd } = loadRewardedAdService({
      'react-native-google-mobile-ads': adsMock,
    });

    assert.deepEqual(await showDailyFortuneRewardedAd(), {
      rewarded: false,
      reason: 'reward_not_earned',
    });
  });
});

test('rewardedAdService: release builds fail closed when rewarded unit ID is missing', async () => {
  await withDevFlag(false, async () => {
    const adsMock = createAdsMock();
    const { showDailyFortuneRewardedAd } = loadRewardedAdService({
      'react-native-google-mobile-ads': adsMock,
    });

    assert.deepEqual(await showDailyFortuneRewardedAd(), {
      rewarded: false,
      reason: 'missing_rewarded_ad_unit_id',
    });
  });
});

test('rewardedAdService: release builds use configured rewarded unit ID', async () => {
  await withDevFlag(false, async () => {
    const previous = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID;
    process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID = 'ca-app-pub-real/rewarded';
    try {
      const adsMock = createAdsMock();
      const { showDailyFortuneRewardedAd } = loadRewardedAdService({
        'react-native-google-mobile-ads': adsMock,
      });

      assert.deepEqual(await showDailyFortuneRewardedAd(), {
        rewarded: true,
        reward: { type: 'redraw', amount: 1 },
      });
      assert.equal(adsMock.__ad.unitId, 'ca-app-pub-real/rewarded');
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID;
      else process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID = previous;
    }
  });
});
