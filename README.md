# SecureChat - Signal Protocol Implementation

A React Native Expo app implementing end-to-end encryption using the official Signal protocol.

<img width="1170" height="2532" alt="super-secure-chat-screen" src="https://github.com/user-attachments/assets/8b56c5b1-b6cb-4912-a44c-404b6c76a80a" />
<img width="355" height="762" alt="chats-screen" src="https://github.com/user-attachments/assets/70860c4a-f1d4-47ef-9acb-2f07b2856086" />
<img width="355" height="763" alt="new-chat-screen" src="https://github.com/user-attachments/assets/fccfceec-68dd-4f11-b86a-5dceff1d5db1" />
<img width="355" height="762" alt="settings-screen" src="https://github.com/user-attachments/assets/9710837a-11aa-4d43-837f-34b07874ffbd" />


## Features

- **End-to-End Encryption**: Uses `@signalapp/libsignal-client` for the Signal protocol (X3DH + Double Ratchet)
- **Secure Key Storage**: Private keys stored using `expo-secure-store`
- **Real-time Messaging**: Built on Supabase with real-time subscriptions
- **Disappearing Messages**: Messages can auto-delete after specified time
- **Safety Numbers**: Verify secure connections between users
- **File Attachments**: Support for images and files (encryption coming soon)

## Architecture

### Signal Protocol Implementation

The app uses the official Signal protocol implementation with:

- **Identity Keys**: Long-term identity keypairs for each user
- **Prekeys**: One-time prekeys for initial key exchange
- **Signed Prekeys**: Signed prekeys for authentication
- **Sessions**: Double Ratchet sessions for ongoing communication

### Key Components

- `lib/signal.ts` - Core Signal protocol implementation
- `services/CryptoService.ts` - High-level encryption service
- `SignalStore` - Persistent storage for keys and sessions

### Database Schema

The app stores public key bundles in the `profiles` table:
- `identity_key_public` - Public identity key
- `signed_prekey` - Signed prekey bundle
- `one_time_prekeys` - Array of one-time prekeys

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Supabase:
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/`
   - Update `.env` with your Supabase credentials

3. Run the app:
```bash
npm run dev
```

## Usage

### Initialize Signal Protocol

1. Open the app and sign up/sign in
2. Go to Settings → "Initialize Signal Protocol"
3. This generates your identity keys and uploads your public bundle

### Send Encrypted Messages

1. Go to "New Chat" tab
2. Select a user who has initialized their Signal protocol
3. Send messages - they will be automatically encrypted

### Verify Security

1. In a chat, tap the timer icon in the header
2. View safety numbers to verify the secure connection
3. Compare safety numbers out-of-band to ensure security

## Security Features

- **Perfect Forward Secrecy**: Each message uses a new encryption key
- **Future Secrecy**: Compromised keys don't affect future messages
- **Deniable Authentication**: Messages are authenticated but deniable
- **Safety Numbers**: Verify identity keys haven't been tampered with

## Development

### Testing Encryption

The app includes demo functionality to test encryption between users:

1. Create two accounts
2. Initialize Signal protocol on both
3. Send messages between them
4. Verify messages are encrypted in the database but decrypted in the UI

### Adding Features

- **Group Chats**: Extend Signal protocol for group messaging
- **Encrypted Files**: Implement encrypted file attachments
- **Voice Messages**: Add encrypted voice message support
- **Video Calls**: Integrate Signal protocol with WebRTC

## Dependencies

### Core
- `@signalapp/libsignal-client` - Official Signal protocol implementation
- `expo-secure-store` - Secure key storage
- `react-native-get-random-values` - Cryptographic random number generation

### UI & Navigation
- `expo-router` - File-based routing
- `lucide-react-native` - Icons
- `@supabase/supabase-js` - Backend and real-time features

## Platform Support

- ✅ iOS (via Expo Go and development builds)
- ✅ Android (via Expo Go and development builds)  
- ✅ Web (with limitations on secure storage)

**Note**: Expo Go uses JS fallback; official libsignal runs in production builds.

## Security Considerations

- Private keys are stored in device secure storage
- Public keys are stored in Supabase database
- Messages are encrypted client-side before transmission
- Server never has access to plaintext messages
- Safety numbers should be verified out-of-band

## Future Enhancements

- [ ] Encrypted file attachments using Signal protocol
- [ ] Group messaging support
- [ ] Message reactions and replies
- [ ] Voice and video calls
- [ ] Desktop app support
- [ ] Key backup and recovery
