import * as FileSystem from 'expo-file-system';
import { extractBase64Data, isLocalFileUri, isRemoteUri } from '../imageUri';
import { coreStorage, STORAGE_KEYS } from './core';

const IMAGE_DIR = FileSystem.documentDirectory + 'images/';

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!dirInfo.exists) {
    console.log("📁 Image directory doesn't exist, creating...");
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
};

export const imageStorage = {
  async saveCardImage(visitId, imageData) {
    console.log('💾 [Storage] 이미지 저장 시작:', visitId);
    try {
      if (!imageData) return;
      await ensureDirExists();
      const prevFileUri = await this.getCardImage(visitId);
      const fileName = `visit_${visitId}_${Date.now()}.jpg`;
      const fileUri = IMAGE_DIR + fileName;
      let finalUri = fileUri;

      const base64Code = extractBase64Data(imageData);
      if (base64Code) {
        await FileSystem.writeAsStringAsync(fileUri, base64Code, { encoding: FileSystem.EncodingType.Base64 });
      } else if (isLocalFileUri(imageData)) {
        await FileSystem.copyAsync({ from: imageData, to: fileUri });
      } else if (isRemoteUri(imageData)) {
        finalUri = imageData;
      } else {
        console.warn('⚠️ 알 수 없는 이미지 포맷, 저장 건너뜀');
        return;
      }

      await coreStorage._updateMap(STORAGE_KEYS.CARD_IMAGES, visitId, finalUri);
      const fileInfo = isRemoteUri(finalUri) ? { size: 0 } : await FileSystem.getInfoAsync(finalUri);
      const metadata = { visitId, timestamp: new Date().toISOString(), size: fileInfo.size || 0 };
      await this._updateImageCacheMetadata(visitId, metadata);

      if (prevFileUri && prevFileUri !== finalUri && prevFileUri.startsWith(IMAGE_DIR)) {
        await FileSystem.deleteAsync(prevFileUri, { idempotent: true });
      }
      console.log('✅ [Storage] 이미지 파일 저장 완료:', finalUri);
    } catch (e) {
      console.error('❌ [Storage] 이미지 파일 저장 실패:', e);
    }
  },

  async getCardImage(visitId) {
    const images = await coreStorage.get(STORAGE_KEYS.CARD_IMAGES) || {};
    const uri = images[visitId] || null;
    if (!uri) return null;
    if (isRemoteUri(uri) || uri.startsWith('data:image')) return uri;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? uri : null;
    } catch {
      return null;
    }
  },

  async getAllCardImages() {
    return await coreStorage.get(STORAGE_KEYS.CARD_IMAGES) || {};
  },

  async deleteCardImage(visitId) {
    console.log('🗑️ [Storage] 이미지 삭제:', visitId);
    const images = await coreStorage.get(STORAGE_KEYS.CARD_IMAGES) || {};
    const fileUri = images[visitId];
    if (fileUri) {
      try {
        if (fileUri.startsWith('file://')) {
          const info = await FileSystem.getInfoAsync(fileUri);
          if (info.exists) await FileSystem.deleteAsync(fileUri);
        }
      } catch (e) {
        console.error('❌ [Storage] 파일 삭제 중 오류:', e);
      }
      await coreStorage._updateMap(STORAGE_KEYS.CARD_IMAGES, visitId, null, true);
      await this._deleteImageCacheMetadata(visitId);
      return true;
    }
    return false;
  },

  async _updateImageCacheMetadata(visitId, metadata) {
    try {
      const cache = await coreStorage.get(STORAGE_KEYS.IMAGE_CACHE) || {};
      cache[visitId] = metadata;
      await coreStorage.save(STORAGE_KEYS.IMAGE_CACHE, cache);
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 메타데이터 저장 오류:', error);
    }
  },

  async _deleteImageCacheMetadata(visitId) {
    try {
      const cache = await coreStorage.get(STORAGE_KEYS.IMAGE_CACHE) || {};
      delete cache[visitId];
      await coreStorage.save(STORAGE_KEYS.IMAGE_CACHE, cache);
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 메타데이터 삭제 오류:', error);
    }
  },

  async getImageCacheMetadata() {
    return await coreStorage.get(STORAGE_KEYS.IMAGE_CACHE) || {};
  },

  async clearImageCache() {
    try {
      console.log('🧹 [Storage] 이미지 캐시 정리 시작');
      const images = await this.getAllCardImages();
      await Promise.allSettled(
        Object.values(images)
          .filter((uri) => typeof uri === 'string' && uri.startsWith(IMAGE_DIR))
          .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }))
      );
      await coreStorage.remove(STORAGE_KEYS.CARD_IMAGES);
      await coreStorage.remove(STORAGE_KEYS.IMAGE_CACHE);
      console.log('✅ [Storage] 이미지 캐시 정리 완료');
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 정리 오류:', error);
    }
  },

  async clearOldImageCache(days = 30) {
    try {
      const cache = await this.getImageCacheMetadata();
      const thresholdTime = new Date().getTime() - (days * 24 * 60 * 60 * 1000);
      const deletePromises = [];
      for (const [visitId, metadata] of Object.entries(cache)) {
        if (new Date(metadata.timestamp).getTime() < thresholdTime) {
          deletePromises.push(this.deleteCardImage(visitId));
        }
      }
      await Promise.allSettled(deletePromises);
    } catch (error) {
      console.error('❌ [Storage] 오래된 이미지 캐시 정리 오류:', error);
    }
  },

  async getImageCacheStats() {
    try {
      const cache = await this.getImageCacheMetadata();
      const images = await this.getAllCardImages();
      const totalImages = Object.keys(images).length;
      const totalSize = Object.values(cache).reduce((sum, meta) => sum + (meta.size || 0), 0);
      return {
        totalImages,
        totalSize,
        totalSizeFormatted: this._formatBytes(totalSize),
        oldestImage: this._findOldestImage(cache),
        newestImage: this._findNewestImage(cache),
      };
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 통계 조회 오류:', error);
      return null;
    }
  },

  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  _findOldestImage(cache) {
    const entries = Object.entries(cache);
    if (entries.length === 0) return null;
    return entries.reduce((oldest, [id, meta]) => (!oldest || new Date(meta.timestamp) < new Date(oldest.timestamp)) ? { visitId: id, ...meta } : oldest, null);
  },

  _findNewestImage(cache) {
    const entries = Object.entries(cache);
    if (entries.length === 0) return null;
    return entries.reduce((newest, [id, meta]) => (!newest || new Date(meta.timestamp) > new Date(newest.timestamp)) ? { visitId: id, ...meta } : newest, null);
  },

  async cleanupOrphanedImages(ids) {
    console.log('🧹 [Storage] cleanupOrphanedImages 시작');
    const imageCount = await coreStorage._cleanup(STORAGE_KEYS.CARD_IMAGES, ids);
    const cache = await coreStorage.get(STORAGE_KEYS.IMAGE_CACHE) || {};
    const beforeMetaCount = Object.keys(cache).length;
    const filtered = Object.fromEntries(Object.entries(cache).filter(([id]) => ids.includes(parseInt(id))));
    const removedMetaCount = beforeMetaCount - Object.keys(filtered).length;
    if (removedMetaCount > 0) {
      await coreStorage.save(STORAGE_KEYS.IMAGE_CACHE, filtered);
      console.log('✅ [Storage] 메타데이터 정리 완료:', removedMetaCount, '개 삭제됨');
    }
    return imageCount;
  }
};
