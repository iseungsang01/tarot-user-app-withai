const baseConfig = require('./app.json');

const GOOGLE_ANDROID_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = () => {
  const expo = { ...baseConfig.expo };
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID || GOOGLE_ANDROID_TEST_APP_ID;
  const iosAppId = process.env.ADMOB_IOS_APP_ID || GOOGLE_IOS_TEST_APP_ID;
  const isProductionBuild = process.env.EXPO_PUBLIC_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production';

  if (isProductionBuild && (!process.env.ADMOB_ANDROID_APP_ID || !process.env.ADMOB_IOS_APP_ID)) {
    throw new Error('Production AdMob builds require ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID.');
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
