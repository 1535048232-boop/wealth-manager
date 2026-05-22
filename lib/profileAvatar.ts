import { supabase } from '@/lib/supabase';
import { inferImageExtension, uploadImageFromUri } from '@/lib/uploadImage';

export async function saveProfileAvatarUrl(userId: string, avatarUrl: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadProfileAvatar({
  userId,
  uri,
  mimeType,
  base64Data,
}: {
  userId: string;
  uri: string;
  mimeType?: string | null;
  base64Data?: string | null;
}) {
  const extension = inferImageExtension(uri, mimeType);
  const objectPath = `${userId}/avatar-${Date.now()}.${extension}`;
  const avatarUrl = await uploadImageFromUri({
    bucket: 'avatars',
    objectPath,
    uri,
    mimeType,
    base64Data,
  });

  await saveProfileAvatarUrl(userId, avatarUrl);
  return avatarUrl;
}
