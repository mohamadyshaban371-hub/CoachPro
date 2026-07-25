import type { StorageReference } from 'firebase/storage';
import {
  getStorageInstance as getStorageInstanceFromService,
  uploadWithRetry as uploadWithRetryFromService,
  type UploadResult,
} from '../core/services/storage.service';

export function getStorageInstance() {
  return getStorageInstanceFromService();
}

/**
 * Uploads a Blob or base64 string to Firebase Storage with retry logic and custom timeout
 */
export async function uploadWithRetry(
  storageRef: StorageReference,
  data: Blob | string,
  onProgress?: (progress: number) => void,
  maxRetries: number = 2,
  timeoutMs: number = 300000,
  allowBase64Fallback: boolean = true,
): Promise<UploadResult> {
  return uploadWithRetryFromService(
    storageRef,
    data,
    onProgress,
    maxRetries,
    timeoutMs,
    allowBase64Fallback,
  );
}
