const DATA_URI_PREFIX = /^data:image\/[a-zA-Z0-9+.-]+;base64,/;

const isDataImageUri = (value = '') => typeof value === 'string' && DATA_URI_PREFIX.test(value);

export const isRemoteUri = (value = '') => typeof value === 'string' && /^https?:\/\//i.test(value);

export const isLocalFileUri = (value = '') => typeof value === 'string' && /^(file|content|asset):\/\//i.test(value);

const isDirectImageUri = (value = '') => isDataImageUri(value) || isRemoteUri(value) || isLocalFileUri(value);

export const toDisplayImageUri = (value) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (isDirectImageUri(normalized)) return normalized;
  return `data:image/jpeg;base64,${normalized}`;
};

export const extractBase64Data = (value) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (isDataImageUri(normalized)) {
    return normalized.split('base64,')[1] || null;
  }
  if (isRemoteUri(normalized) || isLocalFileUri(normalized)) {
    return null;
  }
  return normalized;
};

