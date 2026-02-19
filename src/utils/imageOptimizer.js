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
    
    // 2. 이미지 리사이징 및 압축
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: config.maxWidth,
            height: config.maxHeight,
          },
        },
      ],
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
    
    // 3. 압축된 이미지 크기 확인
    const compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
    const compressionRatio = ((1 - compressedInfo.size / imageInfo.size) * 100).toFixed(2);
    
    console.log('📊 [ImageOptimizer] 압축률:', compressionRatio, '%');
    console.log('📊 [ImageOptimizer] 압축 후 크기:', compressedInfo.size, 'bytes');
    
    return {
      uri: manipResult.uri,
      base64: `data:image/jpeg;base64,${manipResult.base64}`,
      width: manipResult.width,
      height: manipResult.height,
      size: compressedInfo.size,
      originalSize: imageInfo.size,
      compressionRatio,
    };
  } catch (error) {
    console.error('❌ [ImageOptimizer] 압축 오류:', error);
    throw error;
  }
};

/**
 * 여러 이미지를 배치로 압축
 * @param {Array<string>} uris - 이미지 URI 배열
 * @param {object} options - 압축 옵션
 * @returns {Promise<Array<object>>} 압축된 이미지 배열
 */
export const compressImages = async (uris, options = {}) => {
  try {
    console.log('📸 [ImageOptimizer] 배치 압축 시작:', uris.length, '개');
    
    const results = await Promise.all(
      uris.map(uri => compressImage(uri, options))
    );
    
    console.log('✅ [ImageOptimizer] 배치 압축 완료');
    return results;
  } catch (error) {
    console.error('❌ [ImageOptimizer] 배치 압축 오류:', error);
    throw error;
  }
};

/**
 * Base64를 URI로 변환 (필요 시)
 * @param {string} base64 - Base64 문자열
 * @param {string} filename - 저장할 파일명
 * @returns {Promise<string>} 변환된 URI
 */
export const base64ToUri = async (base64, filename = 'temp_image.jpg') => {
  try {
    console.log('🔄 [ImageOptimizer] Base64 → URI 변환 시작');
    
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    
    // Base64 데이터 추출 (data:image/jpeg;base64, 제거)
    const base64Data = base64.includes(',') 
      ? base64.split(',')[1] 
      : base64;
    
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('✅ [ImageOptimizer] 변환 완료:', fileUri);
    return fileUri;
  } catch (error) {
    console.error('❌ [ImageOptimizer] Base64 → URI 변환 오류:', error);
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
 * 이미지가 압축이 필요한지 확인
 * @param {string} uri - 이미지 URI
 * @param {number} maxSizeBytes - 최대 크기 (bytes)
 * @returns {Promise<boolean>} 압축 필요 여부
 */
export const needsCompression = async (uri, maxSizeBytes = 1024 * 1024) => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const needsCompress = info.size > maxSizeBytes;
    
    console.log('🔍 [ImageOptimizer] 압축 필요 여부:', needsCompress);
    console.log('📊 [ImageOptimizer] 현재 크기:', formatFileSize(info.size));
    console.log('📊 [ImageOptimizer] 최대 크기:', formatFileSize(maxSizeBytes));
    
    return needsCompress;
  } catch (error) {
    console.error('❌ [ImageOptimizer] 압축 필요 여부 확인 오류:', error);
    return false;
  }
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

/**
 * 이미지 메타데이터 추출
 * @param {string} uri - 이미지 URI
 * @returns {Promise<object>} { size, exists, uri }
 */
export const getImageMetadata = async (uri) => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    
    return {
      size: info.size,
      sizeFormatted: formatFileSize(info.size),
      exists: info.exists,
      uri: info.uri,
    };
  } catch (error) {
    console.error('❌ [ImageOptimizer] 메타데이터 추출 오류:', error);
    return null;
  }
};