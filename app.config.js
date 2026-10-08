const baseConfig = require('./app.json');

const GOOGLE_ANDROID_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = () => {
  const expo = { ...baseConfig.expo };
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID || GOOGLE_ANDROID_TEST_APP_ID;
  const iosAppId = process.env.ADMOB_IOS_APP_ID || GOOGLE_IOS_TEST_APP_ID;
  const isProductionBuild = process.env.EXPO_PUBLIC_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production';

  // 운영 빌드는 빌드하는 플랫폼의 실제 AdMob 앱 ID 가 있어야 한다. 테스트 ID 로는 수익도, 보상 확인 콜백도 없다.
  const buildPlatform = process.env.EAS_BUILD_PLATFORM;
  const missingAppIds = [
    buildPlatform !== 'ios' && !process.env.ADMOB_ANDROID_APP_ID && 'ADMOB_ANDROID_APP_ID',
    buildPlatform !== 'android' && !process.env.ADMOB_IOS_APP_ID && 'ADMOB_IOS_APP_ID',
  ].filter(Boolean);
  if (isProductionBuild && missingAppIds.length > 0) {
    throw new Error(`Production AdMob builds require ${missingAppIds.join(' and ')}.`);
  }

  expo.plugins = [
    ...(expo.plugins || []),
    [
      'expo-speech-recognition',
      {
        microphonePermission: '음성으로 서랍 기록을 남기기 위해 마이크에 접근합니다.',
        speechRecognitionPermission: '말한 내용을 글로 옮기기 위해 음성 인식을 사용합니다.',
        androidSpeechServicePackages: [
          'com.google.android.googlequicksearchbox',
          'com.google.android.tts',
        ],
      },
    ],
    [
      'react-native-google-mobile-ads',
      {
        androidAppId,
        iosAppId,
      },
    ],
  ];

  return { expo };
};
