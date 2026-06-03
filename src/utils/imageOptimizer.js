import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * 이미지 최적화 유틸리티
 * 이미지 압축, 리사이징, Base64 변환
 */

// 기본 설정
const DEFAULT_CONFIG = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.7,
  format: ImageManipulator.SaveFormat.JPEG,
};

/**
 * 이미지를 압축하고 최적화
 * @param {string} uri - 이미지 URI
 * @param {object} options - 압축 옵션
 * @returns {Promise<object>} { uri, base64, width, height, size }
 */
export const compressImage = async (uri, options = {}) => {
  try {
    console.log('📸 [ImageOptimizer] 이미지 압축 시작:', uri);
    
    const config = { ...DEFAULT_CONFIG, ...options };
    
    // 1. 원본 이미지 정보 가져오기
    const imageInfo = await FileSystem.getInfoAsync(uri);
    console.log('📊 [ImageOptimizer] 원본 크기:', imageInfo.size, 'bytes');
    
    // 2. Get original dimensions for aspect ratio preserving resize
    const originalDimensions = await ImageManipulator.manipulateAsync(uri, []);
    const { width: origWidth, height: origHeight } = originalDimensions;
    
    const actions = [];
    if (origWidth > config.maxWidth || origHeight > config.maxHeight) {
      const widthRatio = config.maxWidth / origWidth;
      const heightRatio = config.maxHeight / origHeight;
      const ratio = Math.min(widthRatio, heightRatio);
      
      actions.push({
        resize: {
          width: Math.round(origWidth * ratio),
          height: Math.round(origHeight * ratio),
        },
      });
    }
    
    // 3. Resize and compress image
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: config.quality,
        format: config.format,
        base64: true,
      }
    );
    
    console.log('✅ [ImageOptimizer] 압축 완료');
    console.log('📊 [ImageOptimizer] 압축 후:', {
      width: manipResult.width,
      height: manipResult.height,
    });
    
    // 4. Check compressed image size
    const compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
    const compressionRatio = imageInfo.size ? ((1 - compressedInfo.size / imageInfo.size) * 100).toFixed(2) : '0';
    
    console.log('📊 [ImageOptimizer] 압축률:', compressionRatio, '%');
    console.log('📊 [ImageOptimizer] 압축 후 크기:', compressedInfo.size, 'bytes');
    
    return {
      uri: manipResult.uri,
      base64: `data:image/jpeg;base64,${manipResult.base64}`,
      width: manipResult.width,
      height: manipResult.height,
      size: compressedInfo.size,
      originalSize: imageInfo.size || 0,
      compressionRatio,
    };
  } catch (error) {
    console.error('❌ [ImageOptimizer] 압축 오류 (원본 폴백):', error);
    
    // Gracefully obtain original file size if possible
    let originalSize = 0;
    try {
      const originalInfo = await FileSystem.getInfoAsync(uri);
      originalSize = originalInfo.size || 0;
    } catch {
      // Ignored
    }

    return {
      uri,
      base64: null,
      width: 0,
      height: 0,
      size: originalSize,
      originalSize,
      compressionRatio: '0.00',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
