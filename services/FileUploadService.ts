import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface UploadedAttachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

export class FileUploadService {
  static async uploadFile(
    userId: string,
    asset: { uri: string; mimeType?: string; name?: string; size?: number }
  ): Promise<UploadedAttachment> {
    try {
      const fileExt = asset.uri.split('.').pop() || 'dat';
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const response = await fetch(asset.uri);
      const fileData = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, fileData, {
          contentType: asset.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const isImage = asset.mimeType?.startsWith('image/') || false;

      return {
        url: publicUrl,
        type: isImage ? 'image' : 'file',
        name: asset.name || fileName,
        size: asset.size || 0,
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  // Future: Add encrypted file upload support
  static async uploadEncryptedFile(
    userId: string,
    asset: { uri: string; mimeType?: string; name?: string; size?: number },
    encryptionKey: string
  ): Promise<UploadedAttachment> {
    // TODO: Implement encrypted file upload using Signal protocol
    // This would encrypt the file before uploading to storage
    throw new Error('Encrypted file upload not yet implemented');
  }
}