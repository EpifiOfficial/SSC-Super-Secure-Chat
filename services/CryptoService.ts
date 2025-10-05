import { SignalProtocol, UserBundle } from '@/lib/signal';

export class CryptoService {
  private userId: string;
  private signal: SignalProtocol;
  private userBundle: UserBundle | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.signal = new SignalProtocol(userId);
  }

  async initialize(): Promise<void> {
    try {
      // Try to get existing bundle
      this.userBundle = await this.signal.getUserBundle();
      
      if (!this.userBundle) {
        // Generate new identity and keys
        this.userBundle = await this.signal.generateIdentity();
        await this.signal.registerPrekeys();
      }

      // Save public bundle to database
      await this.savePublicBundle();
    } catch (error) {
      console.error('Error initializing crypto:', error);
      throw error;
    }
  }

  private async savePublicBundle(): Promise<void> {
    if (!this.userBundle) return;

    try {
      await supabase
        .from('profiles')
        .update({
          identity_key_public: this.userBundle.identityKey,
          signed_prekey: {
            keyId: this.userBundle.signedPreKey.keyId,
            publicKey: this.userBundle.signedPreKey.publicKey,
            signature: this.userBundle.signedPreKey.signature,
          },
          one_time_prekeys: [this.userBundle.preKey],
        })
        .eq('id', this.userId);
    } catch (error) {
      console.error('Error saving public bundle:', error);
      throw error;
    }
  }

  async encryptMessage(recipientId: string, message: string): Promise<string> {
    try {
      // Get recipient's public bundle from database
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('identity_key_public, signed_prekey, one_time_prekeys')
        .eq('id', recipientId)
        .maybeSingle();

      if (!recipientProfile?.identity_key_public) {
        throw new Error('Recipient public key not found');
      }

      // Create recipient bundle
      const recipientBundle: UserBundle = {
        identityKey: recipientProfile.identity_key_public,
        signedPreKey: recipientProfile.signed_prekey,
        preKey: recipientProfile.one_time_prekeys?.[0] || {
          keyId: 1,
          publicKey: recipientProfile.identity_key_public, // Fallback
        },
        registrationId: parseInt(recipientId.replace(/-/g, '').substring(0, 8), 16) % 16384 + 1,
      };

      // Create session and encrypt
      const recipientAddress = await this.signal.createSession(recipientBundle);
      const encryptedMessage = await this.signal.encryptMessage(recipientAddress, message);
      
      return encryptedMessage;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  async decryptMessage(encryptedMessage: string, senderId: string): Promise<string> {
    try {
      // Basic validation
      if (!encryptedMessage || typeof encryptedMessage !== 'string') {
        return '[Empty message]';
      }

      // If the message doesn't look encrypted, return as is
      if (!this.looksEncrypted(encryptedMessage)) {
        return encryptedMessage;
      }

      // Create sender address
      const senderRegistrationId = parseInt(senderId.replace(/-/g, '').substring(0, 8), 16) % 16384 + 1;
      const { loadSignal } = await import('@/lib/signal');
      const Signal = await loadSignal();
      
      const senderAddress = new Signal.ProtocolAddress(senderRegistrationId.toString(), 1);

      // Decrypt message
      const signalProtocol = new (await import('@/lib/signal')).SignalProtocol(this.userId);
      const decryptedMessage = await signalProtocol.decryptMessage(senderAddress, encryptedMessage);
      return decryptedMessage;
    } catch (error) {
      console.error('Decryption error:', error);
      // If decryption fails, return the original message as fallback
      return encryptedMessage;
    }
  }

  private looksEncrypted(str: string): boolean {
    try {
      // Check if string looks like it could be encrypted data
      if (str.length < 10) return false;
      
      // Check if it's base64 encoded
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      return base64Regex.test(str) && str.length % 4 === 0;
    } catch (error) {
      return false;
    }
  }

  async getSafetyNumber(otherUserId: string): Promise<string> {
    try {
      // Get other user's public bundle
      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('identity_key_public, signed_prekey, one_time_prekeys')
        .eq('id', otherUserId)
        .maybeSingle();

      if (!otherProfile?.identity_key_public) {
        throw new Error('Other user public key not found');
      }

      const otherBundle: UserBundle = {
        identityKey: otherProfile.identity_key_public,
        signedPreKey: otherProfile.signed_prekey,
        preKey: otherProfile.one_time_prekeys?.[0] || {
          keyId: 1,
          publicKey: otherProfile.identity_key_public,
        },
        registrationId: parseInt(otherUserId.replace(/-/g, '').substring(0, 8), 16) % 16384 + 1,
      };

      return await this.signal.getSafetyNumber(otherBundle);
    } catch (error) {
      console.error('Error getting safety number:', error);
      return 'Error generating safety number';
    }
  }

  async clearKeys(): Promise<void> {
    try {
      // Clear all stored keys - this would need to be implemented in SignalStore
      console.log('Clearing keys for user:', this.userId);
      // In a real implementation, you'd clear all SecureStore entries for this user
    } catch (error) {
      console.error('Error clearing keys:', error);
    }
  }
}