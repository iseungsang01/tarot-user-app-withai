const GOOGLE_ANDROID_REWARDED_TEST_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const GOOGLE_IOS_REWARDED_TEST_UNIT_ID = 'ca-app-pub-3940256099942544/1712485313';
const AD_LOAD_TIMEOUT_MS = 30000;

let initializePromise = null;

const isDevBuild = () => typeof __DEV__ !== 'undefined' && __DEV__;

const getPlatformOS = () => {
  try {
    // Keep this dynamic so unit tests and web builds fail closed cleanly.
    return require('react-native')?.Platform?.OS || 'android';
  } catch {
    return 'android';
  }
};

const NATIVE_ADS_MODULE_NAME = 'RNGoogleMobileAdsModule';

const isNativeAdsModuleLinked = () => {
  try {
    const reactNative = require('react-native');
    // Probe the registry first: react-native-google-mobile-ads calls
    // TurboModuleRegistry.getEnforcing() while it loads, and in dev Metro turns that
    // throw into a fatal redbox instead of letting the catch below see it.
    if (reactNative?.TurboModuleRegistry?.get?.(NATIVE_ADS_MODULE_NAME)) return true;
    return Boolean(reactNative?.NativeModules?.[NATIVE_ADS_MODULE_NAME]);
  } catch {
    return false;
  }
};

const getGoogleMobileAdsModule = () => {
  if (!isNativeAdsModuleLinked()) return null;

  try {
    return require('react-native-google-mobile-ads');
  } catch {
    return null;
  }
};

export const getDailyFortuneRewardedAdUnitId = () => {
  const platform = getPlatformOS();
  const testUnitId = platform === 'ios' ? GOOGLE_IOS_REWARDED_TEST_UNIT_ID : GOOGLE_ANDROID_REWARDED_TEST_UNIT_ID;

  if (isDevBuild()) return testUnitId;

  if (platform === 'ios') {
    return process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID || null;
  }

  return process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID || null;
};

export const initializeAdMob = async () => {
  if (getPlatformOS() === 'web') return null;
  if (initializePromise) return initializePromise;

  const adsModule = getGoogleMobileAdsModule();
  const mobileAds = adsModule?.default;
  if (typeof mobileAds !== 'function') return null;

  initializePromise = mobileAds().initialize().catch((error) => {
    initializePromise = null;
    throw error;
  });

  return initializePromise;
};

export const showDailyFortuneRewardedAd = async () => {
  if (getPlatformOS() === 'web') {
    return { rewarded: false, reason: 'unsupported_platform' };
  }

  const adsModule = getGoogleMobileAdsModule();
  const { RewardedAd, RewardedAdEventType, AdEventType } = adsModule || {};
  if (!RewardedAd || !RewardedAdEventType) {
    return { rewarded: false, reason: 'missing_rewarded_ad_adapter' };
  }

  try {
    await initializeAdMob();
  } catch (error) {
    return { rewarded: false, reason: 'admob_initialize_failed', error };
  }

  return new Promise((resolve) => {
    const adUnitId = getDailyFortuneRewardedAdUnitId();
    if (!adUnitId) {
      resolve({ rewarded: false, reason: 'missing_rewarded_ad_unit_id' });
      return;
    }

    const rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    const unsubscribers = [];
    let earnedReward = null;
    let settled = false;

    const cleanup = () => {
      while (unsubscribers.length > 0) {
        const unsubscribe = unsubscribers.pop();
        try {
          unsubscribe?.();
        } catch {
          // Ignore listener cleanup failures.
        }
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({ rewarded: false, reason: 'rewarded_ad_timeout' });
    }, AD_LOAD_TIMEOUT_MS);

    unsubscribers.push(
      rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        try {
          rewardedAd.show();
        } catch (error) {
          finish({ rewarded: false, reason: 'rewarded_ad_show_failed', error });
        }
      })
    );

    unsubscribers.push(
      rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        earnedReward = reward || { type: 'daily_fortune_redraw', amount: 1 };
      })
    );

    if (AdEventType?.CLOSED) {
      unsubscribers.push(
        rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
          finish(earnedReward ? { rewarded: true, reward: earnedReward } : { rewarded: false, reason: 'reward_not_earned' });
        })
      );
    }

    if (AdEventType?.ERROR) {
      unsubscribers.push(
        rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
          finish({ rewarded: false, reason: 'rewarded_ad_error', error });
        })
      );
    }

    try {
      rewardedAd.load();
    } catch (error) {
      finish({ rewarded: false, reason: 'rewarded_ad_load_failed', error });
    }
  });
};

export default {
  getDailyFortuneRewardedAdUnitId,
  initializeAdMob,
  showDailyFortuneRewardedAd,
};
