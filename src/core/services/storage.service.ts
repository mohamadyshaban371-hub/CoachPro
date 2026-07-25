import { ref, uploadBytes, uploadString, getDownloadURL, type StorageReference } from 'firebase/storage';
import { storage } from '../../firebase';

export interface UploadResult {
  url: string;
  path: string;
}

export function getStorageInstance() {
  return storage;
}

export async function uploadWithRetry(
  storageRef: StorageReference,
  data: Blob | string,
  onProgress?: (progress: number) => void,
  maxRetries: number = 2,
  timeoutMs: number = 300000,
  allowBase64Fallback: boolean = true,
): Promise<UploadResult> {
  let base64: string;
  if (typeof data === 'string' && data.startsWith('data:')) {
    base64 = data;
  } else if (data instanceof Blob) {
    const toBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    base64 = await toBase64(data);
  } else {
    throw new Error('Unsupported data format');
  }

  const apiBase = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL || '/';
  const url = `${apiBase}api/upload`;
  const payload = JSON.stringify({
    base64,
    path: storageRef.fullPath,
    contentType: data instanceof Blob ? data.type : 'image/jpeg',
    allowBase64Fallback,
  });

  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= maxRetries) {
    try {
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = timeoutMs;

        xhr.upload.onprogress = (ev) => {
          if (!onProgress || !ev.lengthComputable) return;
          const pct = Math.min(95, Math.round((ev.loaded / ev.total) * 95));
          onProgress(pct);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (onProgress) onProgress(100);
              resolve(parsed);
            } catch (e: unknown) {
              reject(new Error(`Bad server response: ${(e as Error)?.message || 'Unknown error'}`));
            }
          } else {
            let errMsg = xhr.statusText || `Server error ${xhr.status}`;
            try {
              const parsed = JSON.parse(xhr.responseText);
              errMsg = parsed.error || parsed.message || errMsg;
            } catch {
              // ignore parse failure
            }
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('TIMEOUT'));
        xhr.onabort = () => reject(new Error('Upload aborted'));

        if (onProgress) onProgress(1);
        xhr.send(payload);
      });
      return result;
    } catch (e: unknown) {
      lastErr = e;
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.warn(`[ProxyUpload] attempt ${attempt + 1} failed:`, message);
      if (message === 'TIMEOUT') break;
      attempt += 1;
      if (attempt > maxRetries) break;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  console.error('[ProxyUpload] Fatal after retries:', lastErr);
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed');
}
