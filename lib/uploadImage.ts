import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export function inferImageExtension(uri: string, mimeType?: string | null) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (uri.toLowerCase().endsWith('.png')) return 'png';
  if (uri.toLowerCase().endsWith('.webp')) return 'webp';
  return 'jpg';
}

async function readBlobFromUri(uri: string) {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    if (!blob) {
      throw new Error('empty blob');
    }

    return blob;
  } catch (fetchError) {
    return await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (!xhr.response) {
          reject(new Error('本地图片读取失败'));
          return;
        }
        resolve(xhr.response as Blob);
      };
      xhr.onerror = () => reject(
        fetchError instanceof Error
          ? new Error(`本地图片读取失败：${fetchError.message}`)
          : new Error('本地图片读取失败'),
      );
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send();
    });
  }
}

function decodeBase64ToArrayBuffer(base64: string) {
  const normalized = base64.includes(',') ? base64.split(',').pop() ?? '' : base64;
  const binaryString = globalThis.atob(normalized);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

async function readFileAsArrayBuffer(uri: string) {
  try {
    const fileBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return decodeBase64ToArrayBuffer(fileBase64);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`本地图片读取失败：${message}`);
  }
}

export async function uploadImageFromUri({
  bucket,
  objectPath,
  uri,
  mimeType,
  base64Data,
}: {
  bucket: string;
  objectPath: string;
  uri: string;
  mimeType?: string | null;
  base64Data?: string | null;
}) {
  const extension = inferImageExtension(uri, mimeType);
  const contentType = mimeType ?? (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg');
  const uriScheme = uri.split(':')[0]?.toLowerCase();

  let fileBody: ArrayBuffer | Blob;

  try {
    if (Platform.OS === 'web') {
      fileBody = await readBlobFromUri(uri);
    } else if (base64Data) {
      fileBody = decodeBase64ToArrayBuffer(base64Data);
    } else if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) {
      fileBody = await readBlobFromUri(uri);
    } else {
      fileBody = base64Data ? decodeBase64ToArrayBuffer(base64Data) : await readFileAsArrayBuffer(uri);
    }
  } catch (error) {
    console.error('[uploadImageFromUri] read failed', {
      bucket,
      objectPath,
      uriScheme,
      mimeType,
      hasBase64Data: Boolean(base64Data),
      error,
    });

    if (Platform.OS === 'web') {
      if (base64Data) {
        fileBody = decodeBase64ToArrayBuffer(base64Data);
      } else {
        throw error;
      }
    } else if (base64Data) {
      fileBody = decodeBase64ToArrayBuffer(base64Data);
    } else if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) {
      fileBody = await readBlobFromUri(uri);
    } else {
      throw error;
    }
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, fileBody, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error('[uploadImageFromUri] upload failed', {
      bucket,
      objectPath,
      uriScheme,
      mimeType,
      hasBase64Data: Boolean(base64Data),
      error: uploadError,
    });
    throw new Error(`图片上传失败：${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}
