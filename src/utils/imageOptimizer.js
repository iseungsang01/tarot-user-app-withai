import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

/**
 * 첨부 사진을 화면 표시·서버 전송용으로 줄인다.
 *
 * 호출처가 쓰는 것은 리사이즈된 파일 `uri` 와 그 `base64` data URI 둘뿐이다.
 * 실패하면 원본 uri 를 그대로 돌려주고 `base64` 는 null 이 된다.
 */

const DEFAULT_CONFIG = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.7,
  format: ImageManipulator.SaveFormat.JPEG,
};

/**
 * 원본 치수를 읽는다. 헤더만 보므로 픽셀을 디코딩하지 않는다.
 * (`manipulateAsync(uri, [])` 로 알아내면 12MP 사진이 48MB 비트맵으로 통째로
 * 펼쳐졌다가 임시 파일로 저장되고 곧바로 버려진다.)
 */
const getImageSize = (uri) =>
  new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

export const compressImage = async (uri, options = {}) => {
  const config = { ...DEFAULT_CONFIG, ...options };

  try {
    const { width, height } = await getImageSize(uri);
    // 한도보다 작은 원본을 늘리지는 않는다
    const ratio = Math.min(config.maxWidth / width, config.maxHeight / height, 1);
    const actions =
      ratio < 1
        ? [{ resize: { width: Math.round(width * ratio), height: Math.round(height * ratio) } }]
        : [];

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: config.quality,
      format: config.format,
      base64: true,
    });

    return { uri: result.uri, base64: `data:image/jpeg;base64,${result.base64}` };
  } catch (error) {
    console.error('이미지 압축 실패 (원본 사용):', error);
    return { uri, base64: null };
  }
};
