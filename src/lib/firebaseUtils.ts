import { ref, uploadBytes, uploadString, getDownloadURL, StorageReference } from 'firebase/storage';
import { storage } from '../firebase';

interface UploadResult {
  url: string;
  path: string;
}

export function getStorageInstance() {
  return storage;
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
  // Convert everything to base64 first
  let base64: string;
  if (typeof data === 'string' && data.startsWith('data:')) {
    base64 = data;
  } else if (data instanceof Blob) {
    const toBase64 = (b: Blob): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(b);
    });
    base64 = await toBase64(data);
  } else {
    throw new Error('Unsupported data format');
  }

  // Server-side proxy upload with REAL progress tracking via XHR. Earlier
  // versions used setInterval to fake a progress bar — that masked failures
  // (the bar climbed to 85% even when the server connection was dropping).
  const apiBase = (import.meta as any).env?.BASE_URL || '/';
  const url = `${apiBase}api/upload`;
  const payload = JSON.stringify({
    base64,
    path: storageRef.fullPath,
    contentType: data instanceof Blob ? data.type : 'image/jpeg',
    allowBase64Fallback,
  });

  let attempt = 0;
  let lastErr: any;
  while (attempt <= maxRetries) {
    try {
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = timeoutMs;

        xhr.upload.onprogress = (ev) => {
          if (!onProgress || !ev.lengthComputable) return;
          // Cap at 95% — the final 5% reserved for server processing.
          const pct = Math.min(95, Math.round((ev.loaded / ev.total) * 95));
          onProgress(pct);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (onProgress) onProgress(100);
              resolve(parsed);
            } catch (e: any) {
              reject(new Error(`Bad server response: ${e.message}`));
            }
          } else {
            // Try to parse the Arabic error message from server JSON
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
    } catch (e: any) {
      lastErr = e;
      console.warn(`[ProxyUpload] attempt ${attempt + 1} failed:`, e.message);
      if (e.message === 'TIMEOUT') break;
      attempt += 1;
      if (attempt > maxRetries) break;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  console.error('[ProxyUpload] Fatal after retries:', lastErr);
  throw lastErr || new Error('Upload failed');
}
