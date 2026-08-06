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
      const prevFileUri = await imageStorage.getCardImage(visitId);
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
      return true;
    }
    return false;
  }
};
