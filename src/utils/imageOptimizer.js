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
    console.error('❌ [ImageOptimizer] 압축 오류:', error);
    throw error;
  }
};


/**
 * 이미지 크기 계산 (KB, MB)
 * @param {number} bytes - 바이트 크기
 * @returns {string} 포맷된 크기 문자열
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};


/**
 * 이미지 캐시 정리
 * @returns {Promise<void>}
 */
export const clearImageCache = async () => {
  try {
    console.log('🧹 [ImageOptimizer] 이미지 캐시 정리 시작');
    
    const cacheDir = FileSystem.cacheDirectory;
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    
    const imageFiles = files.filter(file => 
      file.endsWith('.jpg') || 
      file.endsWith('.jpeg') || 
      file.endsWith('.png')
    );
    
    console.log('📊 [ImageOptimizer] 캐시 이미지 개수:', imageFiles.length);
    
    await Promise.all(
      imageFiles.map(file => 
        FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true })
      )
    );
    
    console.log('✅ [ImageOptimizer] 캐시 정리 완료');
  } catch (error) {
    console.error('❌ [ImageOptimizer] 캐시 정리 오류:', error);
  }
};
