import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const IMAGE_DIR = FileSystem.documentDirectory + 'images/';

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!dirInfo.exists) {
    console.log("📁 Image directory doesn't exist, creating...");
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
};

/**
 * AsyncStorage 헬퍼 - 로컬 스토리지 활용
 * 이미지 캐싱 기능 추가
 */

export const STORAGE_KEYS = {
  CUSTOMER: 'tarot_customer',
  SAVED_PHONE: 'saved_phone',
  REMEMBER_ME: 'remember_me',
  SELECTED_CARDS: 'selected_cards',
  CARD_REVIEWS: 'card_reviews',
  CARD_IMAGES: 'card_images',
  IMAGE_CACHE: 'image_cache',
  READ_NOTICES: 'read_notices',
  APP_SETTINGS: 'app_settings',
  VISIT_CACHE: 'visit_cache',
  COUPON_CACHE: 'coupon_cache',
  LAST_SYNC: 'last_sync',
};

export const storage = {
  // 외부에서 접근 가능하도록 STORAGE_KEYS 노출
  STORAGE_KEYS,

  // 기본 CRUD
  async save(key, value) {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error(`Storage save error (${key}):`, e); }
  },

  async get(key) {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) { console.error(`Storage get error (${key}):`, e); return null; }
  },

  async remove(key) {
    try { await AsyncStorage.removeItem(key); }
    catch (e) { console.error(`Storage remove error (${key}):`, e); }
  },

  async clear() {
    try { await AsyncStorage.clear(); }
    catch (e) { console.error('Storage clear error:', e); }
  },

  async getAllKeys() {
    try { return await AsyncStorage.getAllKeys(); }
    catch (e) { console.error('Storage getAllKeys error:', e); return []; }
  },

  // 내부 유틸리티: 객체 형태의 데이터 업데이트 공통 로직
  async _updateMap(key, id, value, isDelete = false) {
    const data = await this.get(key) || {};
    if (isDelete) delete data[id]; else data[id] = value;
    await this.save(key, data);
  },

  // 카드 선택 관련
  async saveSelectedCard(visitId, cardName) { await this._updateMap(STORAGE_KEYS.SELECTED_CARDS, visitId, cardName); },
  async getSelectedCard(visitId) { return (await this.get(STORAGE_KEYS.SELECTED_CARDS) || {})[visitId] || null; },
  async getAllSelectedCards() { return await this.get(STORAGE_KEYS.SELECTED_CARDS) || {}; },
  async deleteSelectedCard(visitId) { await this._updateMap(STORAGE_KEYS.SELECTED_CARDS, visitId, null, true); },

  // ✅ 카드 이미지 관련 (개선 - FileSystem 사용)
  async saveCardImage(visitId, imageData) {
    console.log('💾 [Storage] 이미지 저장 시작:', visitId);
    try {
      if (!imageData) return;

      await ensureDirExists();

      // 파일명 생성 (visitId 기반)
      const fileName = `visit_${visitId}_${Date.now()}.jpg`;
      const fileUri = IMAGE_DIR + fileName;

      // 1. 이미지가 Base64인 경우 (구버전 호환)
      if (imageData.startsWith('data:image')) {
        const base64Code = imageData.split('base64,')[1];
        await FileSystem.writeAsStringAsync(fileUri, base64Code, { encoding: FileSystem.EncodingType.Base64 });
      }
      // 2. 이미지가 로컬 File URI인 경우 (ImagePicker 결과)
      else if (imageData.startsWith('file://')) {
        await FileSystem.copyAsync({ from: imageData, to: fileUri });
      } else {
        console.warn('⚠️ 알 수 없는 이미지 포맷, 저장 건너뜀');
        return;
      }

      // 3. AsyncStorage에는 "파일 경로(URI)"만 저장
      await this._updateMap(STORAGE_KEYS.CARD_IMAGES, visitId, fileUri);

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const metadata = {
        visitId,
        timestamp: new Date().toISOString(),
        size: fileInfo.size || 0,
      };
      await this._updateImageCacheMetadata(visitId, metadata);

      console.log('✅ [Storage] 이미지 파일 저장 완료:', fileUri);

      // (선택) 이전 이미지 파일이 있다면 정리하는 로직이 필요할 수 있음
    } catch (e) {
      console.error('❌ [Storage] 이미지 파일 저장 실패:', e);
    }
  },

  async getCardImage(visitId) {
    const images = await this.get(STORAGE_KEYS.CARD_IMAGES) || {};
    return images[visitId] || null;
  },

  async getAllCardImages() {
    return await this.get(STORAGE_KEYS.CARD_IMAGES) || {};
  },

  async deleteCardImage(visitId) {
    console.log('🗑️ [Storage] 이미지 삭제:', visitId);
    const images = await this.get(STORAGE_KEYS.CARD_IMAGES) || {};
    const fileUri = images[visitId];

    if (fileUri) {
      try {
        // 파일 시스템에서 삭제
        if (fileUri.startsWith('file://')) {
          const info = await FileSystem.getInfoAsync(fileUri);
          if (info.exists) {
            await FileSystem.deleteAsync(fileUri);
            console.log('🗑️ [Storage] 파일 삭제 완료:', fileUri);
          }
        }
      } catch (e) {
        console.error('❌ [Storage] 파일 삭제 중 오류:', e);
      }

      // AsyncStorage 키 삭제
      await this._updateMap(STORAGE_KEYS.CARD_IMAGES, visitId, null, true);
      await this._deleteImageCacheMetadata(visitId);
      console.log('✅ [Storage] 이미지 데이터 삭제 완료');
      return true;
    } else {
      console.log('⚠️ [Storage] 삭제할 이미지가 없음:', visitId);
      return false;
    }
  },

  // ✅ 카드 리뷰 관련 (개선)
  async saveCardReview(visitId, review) {
    console.log('💾 [Storage] 리뷰 저장:', visitId);
    await this._updateMap(STORAGE_KEYS.CARD_REVIEWS, visitId, review);
    console.log('✅ [Storage] 리뷰 저장 완료');
  },

  async getCardReview(visitId) {
    const reviews = await this.get(STORAGE_KEYS.CARD_REVIEWS) || {};
    return reviews[visitId] || null;
  },

  async getAllCardReviews() {
    return await this.get(STORAGE_KEYS.CARD_REVIEWS) || {};
  },

  async deleteCardReview(visitId) {
    console.log('🗑️ [Storage] 리뷰 삭제:', visitId);
    const reviews = await this.get(STORAGE_KEYS.CARD_REVIEWS) || {};
    const existed = visitId in reviews;

    if (existed) {
      await this._updateMap(STORAGE_KEYS.CARD_REVIEWS, visitId, null, true);
      console.log('✅ [Storage] 리뷰 삭제 완료');
      return true;
    } else {
      console.log('⚠️ [Storage] 삭제할 리뷰가 없음:', visitId);
      return false;
    }
  },

  // 이미지 캐시 메타데이터 관리
  async _updateImageCacheMetadata(visitId, metadata) {
    try {
      const cache = await this.get(STORAGE_KEYS.IMAGE_CACHE) || {};
      cache[visitId] = metadata;
      await this.save(STORAGE_KEYS.IMAGE_CACHE, cache);
      console.log('✅ [Storage] 이미지 캐시 메타데이터 저장:', visitId);
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 메타데이터 저장 오류:', error);
    }
  },

  async _deleteImageCacheMetadata(visitId) {
    try {
      const cache = await this.get(STORAGE_KEYS.IMAGE_CACHE) || {};
      delete cache[visitId];
      await this.save(STORAGE_KEYS.IMAGE_CACHE, cache);
      console.log('✅ [Storage] 이미지 캐시 메타데이터 삭제:', visitId);
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 메타데이터 삭제 오류:', error);
    }
  },

  async getImageCacheMetadata() {
    try {
      return await this.get(STORAGE_KEYS.IMAGE_CACHE) || {};
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 메타데이터 조회 오류:', error);
      return {};
    }
  },

  async clearImageCache() {
    try {
      console.log('🧹 [Storage] 이미지 캐시 정리 시작');
      await this.remove(STORAGE_KEYS.CARD_IMAGES);
      await this.remove(STORAGE_KEYS.IMAGE_CACHE);
      console.log('✅ [Storage] 이미지 캐시 정리 완료');
    } catch (error) {
      console.error('❌ [Storage] 이미지 캐시 정리 오류:', error);
    }
  },

  async clearOldImageCache(days = 30) {
    try {
      console.log('🧹 [Storage] 오래된 이미지 캐시 정리 시작:', days, '일');

      const cache = await this.getImageCacheMetadata();
      const now = new Date();
      const thresholdTime = now.getTime() - (days * 24 * 60 * 60 * 1000);

      const images = await this.getAllCardImages();
      let deletedCount = 0;

      for (const [visitId, metadata] of Object.entries(cache)) {
        const cacheTime = new Date(metadata.timestamp).getTime();

        if (cacheTime < thresholdTime) {
          await this.deleteCardImage(visitId);
          deletedCount++;
        }
      }

      console.log('✅ [Storage] 오래된 이미지 캐시 정리 완료:', deletedCount, '개 삭제');
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

    return entries.reduce((oldest, [id, meta]) => {
      if (!oldest || new Date(meta.timestamp) < new Date(oldest.timestamp)) {
        return { visitId: id, ...meta };
      }
      return oldest;
    }, null);
  },

  _findNewestImage(cache) {
    const entries = Object.entries(cache);
    if (entries.length === 0) return null;

    return entries.reduce((newest, [id, meta]) => {
      if (!newest || new Date(meta.timestamp) > new Date(newest.timestamp)) {
        return { visitId: id, ...meta };
      }
      return newest;
    }, null);
  },

  // 공지사항 관련
  async markNoticeAsRead(noticeId) { await this.markNoticesAsRead([noticeId]); },
  async markNoticesAsRead(noticeIds) {
    const read = await this.get(STORAGE_KEYS.READ_NOTICES) || [];
    const updated = [...new Set([...read, ...noticeIds])];
    await this.save(STORAGE_KEYS.READ_NOTICES, updated);
  },
  async isNoticeRead(noticeId) { return (await this.get(STORAGE_KEYS.READ_NOTICES) || []).includes(noticeId); },
  async getReadNotices() { return await this.get(STORAGE_KEYS.READ_NOTICES) || []; },
  async getUnreadNoticeCount(allNoticeIds) {
    const read = await this.get(STORAGE_KEYS.READ_NOTICES) || [];
    return allNoticeIds.filter(id => !read.includes(id)).length;
  },

  /**
   * 읽은 공지사항 목록 동기화 (삭제된 공지사항 정리)
   * @param {number[]} activeIds - 현재 서버에 존재하는 공지사항 ID 목록
   */
  async syncReadNotices(activeIds) {
    const read = await this.get(STORAGE_KEYS.READ_NOTICES) || [];
    const filtered = read.filter(id => activeIds.includes(id));

    // 개수가 달라졌다면 (삭제된 게 있다면) 다시 저장
    if (read.length !== filtered.length) {
      await this.save(STORAGE_KEYS.READ_NOTICES, filtered);
      console.log(`🧹 [Storage] 삭제된 공지사항 ID 정리 완료 (${read.length} -> ${filtered.length})`);
    }
  },

  // 앱 설정 및 캐시
  async saveAppSettings(settings) {
    const curr = await this.get(STORAGE_KEYS.APP_SETTINGS) || {};
    await this.save(STORAGE_KEYS.APP_SETTINGS, { ...curr, ...settings });
  },
  async getAppSettings() {
    return await this.get(STORAGE_KEYS.APP_SETTINGS) || { darkMode: true, notifications: true, autoRefresh: true };
  },
  async cacheVisits(visits) {
    await this.save(STORAGE_KEYS.VISIT_CACHE, visits);
    await this.save(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  },
  async getCachedVisits() { return await this.get(STORAGE_KEYS.VISIT_CACHE) || []; },
  async cacheCoupons(coupons) { await this.save(STORAGE_KEYS.COUPON_CACHE, coupons); },
  async getCachedCoupons() { return await this.get(STORAGE_KEYS.COUPON_CACHE) || []; },
  async getLastSyncTime() { return await this.get(STORAGE_KEYS.LAST_SYNC); },

  // 데이터 정리
  async clearOldCache(days = 7) {
    const last = await this.getLastSyncTime();
    if (last && (new Date() - new Date(last)) / 864e5 > days) {
      await Promise.all([
        this.remove(STORAGE_KEYS.VISIT_CACHE),
        this.remove(STORAGE_KEYS.COUPON_CACHE),
        this.remove(STORAGE_KEYS.LAST_SYNC)
      ]);
    }
  },

  // ✅ Orphaned 데이터 정리 공통 로직 (개선)
  async _cleanup(key, validIds) {
    console.log('🧹 [Storage] _cleanup 시작:', key);
    console.log('  유효한 ID 목록:', validIds);

    const data = await this.get(key) || {};
    const beforeCount = Object.keys(data).length;
    console.log('  정리 전 데이터 개수:', beforeCount);

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([id]) => validIds.includes(parseInt(id)))
    );

    const afterCount = Object.keys(filtered).length;
    const removedCount = beforeCount - afterCount;

    console.log('  정리 후 데이터 개수:', afterCount);
    console.log('  삭제된 개수:', removedCount);

    if (removedCount > 0) {
      await this.save(key, filtered);
      console.log('✅ [Storage] _cleanup 완료:', removedCount, '개 삭제됨');
    } else {
      console.log('✅ [Storage] _cleanup 완료: 삭제할 항목 없음');
    }

    return removedCount;
  },

  async cleanupOrphanedCards(ids) {
    return await this._cleanup(STORAGE_KEYS.SELECTED_CARDS, ids);
  },

  async cleanupOrphanedReviews(ids) {
    return await this._cleanup(STORAGE_KEYS.CARD_REVIEWS, ids);
  },

  async cleanupOrphanedImages(ids) {
    console.log('🧹 [Storage] cleanupOrphanedImages 시작');

    // 이미지 정리
    const imageCount = await this._cleanup(STORAGE_KEYS.CARD_IMAGES, ids);

    // 메타데이터도 함께 정리
    console.log('🧹 [Storage] 이미지 메타데이터 정리 중...');
    const cache = await this.get(STORAGE_KEYS.IMAGE_CACHE) || {};
    const beforeMetaCount = Object.keys(cache).length;

    const filtered = Object.fromEntries(
      Object.entries(cache).filter(([id]) => ids.includes(parseInt(id)))
    );

    const afterMetaCount = Object.keys(filtered).length;
    const removedMetaCount = beforeMetaCount - afterMetaCount;

    if (removedMetaCount > 0) {
      await this.save(STORAGE_KEYS.IMAGE_CACHE, filtered);
      console.log('✅ [Storage] 메타데이터 정리 완료:', removedMetaCount, '개 삭제됨');
    }

    return imageCount;
  },
};