import * as SecureStoreModule from 'expo-secure-store';
import 'react-native-get-random-values';

// Runtime fallback for Expo Go compatibility
let Signal: any;
let usingFallback = false;

async function loadSignal() {
  if (Signal) return Signal; // already loaded

  try {
    Signal = await import('@signalapp/libsignal-client');
  } catch (err) {
    console.warn('⚠️ Falling back to JS libsignal for Expo Go');
    usingFallback = true;
    Signal = await import('@privacyresearch/libsignal-protocol-typescript');
  }

  return Signal;
}

export { loadSignal, usingFallback };


export interface UserBundle {
  identityKey: string;
  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  preKey: {
    keyId: number;
    publicKey: string;
  };
  registrationId: number;
}

export interface SignalSession {
  address: any;
  sessionRecord: any;
}

class SignalStore {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private getKey(key: string): string {
    return `signal_${this.userId}_${key}`;
  }

  async getIdentityKeyPair(): Promise<any | null> {
    try {
      const privateKeyData = await SecureStoreModule.getItemAsync(this.getKey('identity_private'));
      const publicKeyData = await SecureStoreModule.getItemAsync(this.getKey('identity_public'));
      
      if (!privateKeyData || !publicKeyData) return null;

      const privateKey = Signal.PrivateKey.deserialize(Buffer.from(privateKeyData, 'base64'));
      const publicKey = Signal.PublicKey.deserialize(Buffer.from(publicKeyData, 'base64'));
      
      return Signal.IdentityKeyPair.new(publicKey, privateKey);
    } catch (error) {
      console.error('Error getting identity key pair:', error);
      return null;
    }
  }

  async saveIdentityKeyPair(keyPair: any): Promise<void> {
    try {
      const privateKeyData = keyPair.privateKey().serialize();
      const publicKeyData = keyPair.publicKey().serialize();
      
      await SecureStoreModule.setItemAsync(this.getKey('identity_private'), Buffer.from(privateKeyData).toString('base64'));
      await SecureStoreModule.setItemAsync(this.getKey('identity_public'), Buffer.from(publicKeyData).toString('base64'));
    } catch (error) {
      console.error('Error saving identity key pair:', error);
      throw error;
    }
  }

  async getLocalRegistrationId(): Promise<number> {
    try {
      const regId = await SecureStoreModule.getItemAsync(this.getKey('registration_id'));
      return regId ? parseInt(regId, 10) : Math.floor(Math.random() * 16384) + 1;
    } catch (error) {
      return Math.floor(Math.random() * 16384) + 1;
    }
  }

  async saveRegistrationId(registrationId: number): Promise<void> {
    await SecureStoreModule.setItemAsync(this.getKey('registration_id'), registrationId.toString());
  }

  async getSignedPreKey(signedPreKeyId: number): Promise<any | null> {
    try {
      const data = await SecureStoreModule.getItemAsync(this.getKey(`signed_prekey_${signedPreKeyId}`));
      if (!data) return null;
      return Signal.SignedPreKeyRecord.deserialize(Buffer.from(data, 'base64'));
    } catch (error) {
      console.error('Error getting signed prekey:', error);
      return null;
    }
  }

  async saveSignedPreKey(signedPreKeyId: number, record: any): Promise<void> {
    try {
      const data = record.serialize();
      await SecureStoreModule.setItemAsync(this.getKey(`signed_prekey_${signedPreKeyId}`), Buffer.from(data).toString('base64'));
    } catch (error) {
      console.error('Error saving signed prekey:', error);
      throw error;
    }
  }

  async getPreKey(preKeyId: number): Promise<any | null> {
    try {
      const data = await SecureStoreModule.getItemAsync(this.getKey(`prekey_${preKeyId}`));
      if (!data) return null;
      return Signal.PreKeyRecord.deserialize(Buffer.from(data, 'base64'));
    } catch (error) {
      console.error('Error getting prekey:', error);
      return null;
    }
  }

  async savePreKey(preKeyId: number, record: any): Promise<void> {
    try {
      const data = record.serialize();
      await SecureStoreModule.setItemAsync(this.getKey(`prekey_${preKeyId}`), Buffer.from(data).toString('base64'));
    } catch (error) {
      console.error('Error saving prekey:', error);
      throw error;
    }
  }

  async loadSession(address: any): Promise<any | null> {
    try {
      const data = await SecureStoreModule.getItemAsync(this.getKey(`session_${address.name()}_${address.deviceId()}`));
      if (!data) return null;
      return Buffer.from(data, 'base64');
    } catch (error) {
      console.error('Error loading session:', error);
      return null;
    }
  }

  async storeSession(address: any, record: any): Promise<void> {
    try {
      await SecureStoreModule.setItemAsync(
        this.getKey(`session_${address.name()}_${address.deviceId()}`),
        Buffer.from(record).toString('base64')
      );
    } catch (error) {
      console.error('Error storing session:', error);
      throw error;
    }
  }

  async isTrustedIdentity(address: any, identityKey: any): Promise<boolean> {
    // For demo purposes, always trust new identities
    // In production, implement proper identity verification
    return true;
  }

  async saveIdentity(address: any, identityKey: any): Promise<boolean> {
    try {
      const keyData = identityKey.serialize();
      await SecureStoreModule.setItemAsync(
        this.getKey(`identity_${address.name()}`),
        Buffer.from(keyData).toString('base64')
      );
      return false; // Return false for new identities, true for existing ones
    } catch (error) {
      console.error('Error saving identity:', error);
      return false;
    }
  }

  async getIdentity(address: any): Promise<any | null> {
    try {
      const data = await SecureStoreModule.getItemAsync(this.getKey(`identity_${address.name()}`));
      if (!data) return null;
      return Signal.PublicKey.deserialize(Buffer.from(data, 'base64'));
    } catch (error) {
      console.error('Error getting identity:', error);
      return null;
    }
  }
}

export class SignalProtocol {
  private store: SignalStore;
  private userId: string;
  private signal: any = null;

  constructor(userId: string) {
    this.userId = userId;
    this.store = new SignalStore(userId);
  }

  private async ensureSignalLoaded(): Promise<void> {
    if (!this.signal) {
      this.signal = await loadSignal();
    }
  }

  async generateIdentity(): Promise<UserBundle> {
    try {
      await this.ensureSignalLoaded();
      const Signal = this.signal;

      // Generate identity key pair
      const identityKeyPair = Signal.IdentityKeyPair.generate();
      await this.store.saveIdentityKeyPair(identityKeyPair);

      // Generate registration ID
      const registrationId = Math.floor(Math.random() * 16384) + 1;
      await this.store.saveRegistrationId(registrationId);

      // Generate signed prekey
      const signedPreKeyId = Math.floor(Math.random() * 16777216);
      const signedPreKeyPair = Signal.IdentityKeyPair.generate();
      const signedPreKeySignature = identityKeyPair.privateKey().sign(signedPreKeyPair.publicKey().serialize());
      
      const signedPreKeyRecord = Signal.SignedPreKeyRecord.new(
        signedPreKeyId,
        Date.now(),
        signedPreKeyPair,
        signedPreKeySignature
      );
      await this.store.saveSignedPreKey(signedPreKeyId, signedPreKeyRecord);

      // Generate one-time prekey
      const preKeyId = Math.floor(Math.random() * 16777216);
      const preKeyPair = Signal.IdentityKeyPair.generate();
      const preKeyRecord = Signal.PreKeyRecord.new(preKeyId, preKeyPair);
      await this.store.savePreKey(preKeyId, preKeyRecord);

      return {
        identityKey: Buffer.from(identityKeyPair.publicKey().serialize()).toString('base64'),
        signedPreKey: {
          keyId: signedPreKeyId,
          publicKey: Buffer.from(signedPreKeyPair.publicKey().serialize()).toString('base64'),
          signature: Buffer.from(signedPreKeySignature).toString('base64'),
        },
        preKey: {
          keyId: preKeyId,
          publicKey: Buffer.from(preKeyPair.publicKey().serialize()).toString('base64'),
        },
        registrationId,
      };
    } catch (error) {
      console.error('Error generating identity:', error);
      throw error;
    }
  }

  async registerPrekeys(): Promise<void> {
    // This would typically upload prekeys to a server
    // For demo purposes, we'll just ensure they're generated and stored
    await this.ensureSignalLoaded();
    const identityKeyPair = await this.store.getIdentityKeyPair();
    if (!identityKeyPair) {
      await this.generateIdentity();
    }
  }

  async createSession(recipientBundle: UserBundle): Promise<any> {
    try {
      await this.ensureSignalLoaded();
      const Signal = this.signal;

      const recipientAddress = new Signal.ProtocolAddress(recipientBundle.registrationId.toString(), 1);
      
      const identityKey = Signal.PublicKey.deserialize(Buffer.from(recipientBundle.identityKey, 'base64'));
      const signedPreKey = Signal.PublicKey.deserialize(Buffer.from(recipientBundle.signedPreKey.publicKey, 'base64'));
      const preKey = Signal.PublicKey.deserialize(Buffer.from(recipientBundle.preKey.publicKey, 'base64'));
      const signature = Buffer.from(recipientBundle.signedPreKey.signature, 'base64');

      const preKeyBundle = Signal.PreKeyBundle.new(
        recipientBundle.registrationId,
        1, // device ID
        recipientBundle.preKey.keyId,
        preKey,
        recipientBundle.signedPreKey.keyId,
        signedPreKey,
        signature,
        identityKey
      );

      const sessionBuilder = new Signal.SessionBuilder(this.store as any, recipientAddress);
      await sessionBuilder.processPreKeyBundle(preKeyBundle);

      return recipientAddress;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async encryptMessage(recipientAddress: any, plaintext: string): Promise<string> {
    try {
      await this.ensureSignalLoaded();
      const Signal = this.signal;

      const sessionCipher = new Signal.SessionCipher(this.store as any, recipientAddress);
      const ciphertext = await sessionCipher.encrypt(Buffer.from(plaintext, 'utf8'));
      return Buffer.from(ciphertext.serialize()).toString('base64');
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  }

  async decryptMessage(senderAddress: any, ciphertext: string): Promise<string> {
    try {
      await this.ensureSignalLoaded();
      const Signal = this.signal;

      const sessionCipher = new Signal.SessionCipher(this.store as any, senderAddress);
      const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
      
      // Try to deserialize as PreKeySignalMessage first, then as SignalMessage
      let decryptedBuffer: Buffer;
      try {
        const preKeyMessage = Signal.PreKeySignalMessage.deserialize(ciphertextBuffer);
        decryptedBuffer = await sessionCipher.decryptPreKeySignalMessage(preKeyMessage);
      } catch {
        const signalMessage = Signal.SignalMessage.deserialize(ciphertextBuffer);
        decryptedBuffer = await sessionCipher.decryptSignalMessage(signalMessage);
      }
      
      return decryptedBuffer.toString('utf8');
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw error;
    }
  }

  async getUserBundle(): Promise<UserBundle | null> {
    try {
      await this.ensureSignalLoaded();
      const identityKeyPair = await this.store.getIdentityKeyPair();
      const registrationId = await this.store.getLocalRegistrationId();
      
      if (!identityKeyPair) return null;

      // Get the first available signed prekey and prekey
      // In a real app, you'd manage these more carefully
      const signedPreKeyId = 1;
      const preKeyId = 1;
      
      const signedPreKey = await this.store.getSignedPreKey(signedPreKeyId);
      const preKey = await this.store.getPreKey(preKeyId);
      
      if (!signedPreKey || !preKey) return null;

      return {
        identityKey: Buffer.from(identityKeyPair.publicKey().serialize()).toString('base64'),
        signedPreKey: {
          keyId: signedPreKeyId,
          publicKey: Buffer.from(signedPreKey.publicKey().serialize()).toString('base64'),
          signature: Buffer.from(signedPreKey.signature()).toString('base64'),
        },
        preKey: {
          keyId: preKeyId,
          publicKey: Buffer.from(preKey.publicKey().serialize()).toString('base64'),
        },
        registrationId,
      };
    } catch (error) {
      console.error('Error getting user bundle:', error);
      return null;
    }
  }

  async getSafetyNumber(otherUserBundle: UserBundle): Promise<string> {
    try {
      await this.ensureSignalLoaded();
      const identityKeyPair = await this.store.getIdentityKeyPair();
      if (!identityKeyPair) throw new Error('No identity key pair');

      const ourKey = identityKeyPair.publicKey().serialize();
      const theirKey = Buffer.from(otherUserBundle.identityKey, 'base64');
      
      // Create a simple hash of both keys for safety number
      const combined = Buffer.concat([ourKey, theirKey]);
      const hash = require('crypto').createHash('sha256').update(combined).digest('hex');
      
      // Format as groups of 5 digits
      return hash.substring(0, 60).match(/.{1,5}/g)?.join(' ') || hash.substring(0, 60);
    } catch (error) {
      console.error('Error generating safety number:', error);
      return 'Error generating safety number';
    }
  }
}