import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Message, Profile } from '@/services/supabase';
import { ArrowLeft, Send, Paperclip, Image as ImageIcon, File, Timer, Smile } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { CryptoService } from '@/services/CryptoService';
import { FileUploadService } from '@/services/FileUploadService';
import { theme } from '@/constants/theme';

type MessageItem = Message & {
  decryptedText?: string;
  isOutgoing: boolean;
};

export default function ChatThreadScreen() {
  const { id: recipientId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultExpireDuration, setDefaultExpireDuration] = useState<number>(0);
  const { user, profile } = useAuth();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const cryptoServiceRef = useRef<CryptoService | null>(null);

  useEffect(() => {
    if (user && recipientId) {
      initializeCrypto();
      loadRecipient();
      loadChatSettings();
      loadMessages();
      subscribeToMessages();
    }
  }, [user, recipientId]);

  const initializeCrypto = async () => {
    try {
      if (!user) return;
      const cryptoService = new CryptoService(user.id);
      await cryptoService.initialize();
      cryptoServiceRef.current = cryptoService;
    } catch (error) {
      console.error('Crypto initialization error:', error);
    }
  };

  const loadChatSettings = async () => {
    const { data } = await supabase
      .from('chat_settings')
      .select('disappearing_duration')
      .eq('user_id', user!.id)
      .eq('recipient_id', recipientId)
      .maybeSingle();

    if (data) setDefaultExpireDuration(data.disappearing_duration);
  };

  const saveChatSettings = async (duration: number) => {
    await supabase.from('chat_settings').upsert({
      user_id: user!.id,
      recipient_id: recipientId,
      disappearing_duration: duration,
      updated_at: new Date().toISOString(),
    });
  };


  const loadRecipient = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', recipientId)
        .maybeSingle();

      if (error) throw error;
      setRecipient(data);
    } catch (error) {
      console.error('Error loading recipient:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user?.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.sender_id === recipientId) {
            handleNewMessage(newMessage);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleNewMessage = async (message: Message) => {
    try {
      const cryptoService = cryptoServiceRef.current;
      let decryptedText = message.ciphertext || '[Empty message]';

      if (cryptoService && message.ciphertext) {
        try {
          decryptedText = await cryptoService.decryptMessage(message.ciphertext, message.sender_id);
        } catch (decryptError) {
          console.log('Could not decrypt incoming message, using original text:', decryptError);
          // Use the original ciphertext as fallback
          decryptedText = message.ciphertext;
        }
      }

      const messageItem: MessageItem = {
        ...message,
        decryptedText,
        isOutgoing: false,
      };

      setMessages((prev) => [...prev, messageItem]);

      await supabase
        .from('messages')
        .update({ status: 'delivered' })
        .eq('id', message.id);
    } catch (error) {
      console.error('Error decrypting message:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user?.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user?.id})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;

      const cryptoService = cryptoServiceRef.current;
      const messagesWithDecryption: MessageItem[] = [];

      for (const msg of data || []) {
        const isOutgoing = msg.sender_id === user?.id;
        let displayText = msg.ciphertext || '[Empty message]';

        if (cryptoService && msg.ciphertext) {
          try {
            const otherUserId = isOutgoing ? msg.recipient_id : msg.sender_id;
            displayText = await cryptoService.decryptMessage(msg.ciphertext, otherUserId);
          } catch (decryptError) {
            console.log('Could not decrypt message, using original text:', decryptError);
            // Use the original ciphertext as fallback
            displayText = msg.ciphertext;
          }
        }

        messagesWithDecryption.push({
          ...msg,
          decryptedText: displayText,
          isOutgoing,
        });
      }

      setMessages(messagesWithDecryption);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (file) {
            setUploading(true);
            try {
              const uri = URL.createObjectURL(file);
              await uploadAndSendAttachment({
                uri,
                mimeType: file.type,
                name: file.name,
                size: file.size,
              });
            } catch (error) {
              console.error('Error uploading image:', error);
              Alert.alert('Error', 'Failed to upload image');
            } finally {
              setUploading(false);
            }
          }
        };
        input.click();
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant access to your photo library');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setUploading(true);
          await uploadAndSendAttachment(result.assets[0]);
          setUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (file) {
            setUploading(true);
            try {
              const uri = URL.createObjectURL(file);
              await uploadAndSendAttachment({
                uri,
                mimeType: file.type,
                name: file.name,
                size: file.size,
              });
            } catch (error) {
              console.error('Error uploading file:', error);
              Alert.alert('Error', 'Failed to upload file');
            } finally {
              setUploading(false);
            }
          }
        };
        input.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets[0]) {
          setUploading(true);
          await uploadAndSendAttachment(result.assets[0]);
          setUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
      setUploading(false);
    }
  };

  const uploadAndSendAttachment = async (asset: any) => {
    try {
      if (!user || !recipientId) return;

      const attachment = await FileUploadService.uploadFile(user.id, asset);

      const messageData: any = {
        sender_id: user.id,
        recipient_id: recipientId,
        ciphertext: attachment.name,
        message_type: 'whisper',
        attachment_url: attachment.url,
        attachment_type: attachment.type,
        attachment_name: attachment.name,
        attachment_size: attachment.size,
      };

      if (defaultExpireDuration > 0) {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + defaultExpireDuration);
        messageData.expires_at = expiresAt.toISOString();
        messageData.expire_duration = defaultExpireDuration;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      const messageItem: MessageItem = {
        ...data,
        decryptedText: attachment.name,
        isOutgoing: true,
      };

      setMessages((prev) => [...prev, messageItem]);
    } catch (error: any) {
      console.error('Error sending attachment:', error);
      Alert.alert('Error', 'Failed to send attachment');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !recipientId || sending) return;

    setSending(true);
    setError(null);
    const messageText = inputText.trim();
    setInputText('');

    try {
      const cryptoService = cryptoServiceRef.current;
      let encryptedMessage = messageText;

      if (cryptoService) {
        try {
          encryptedMessage = await cryptoService.encryptMessage(recipientId, messageText);
        } catch (encryptError) {
          console.log('Encryption failed, sending plain:', encryptError);
        }
      }

      const messageData: any = {
        sender_id: user.id,
        recipient_id: recipientId,
        ciphertext: encryptedMessage,
        message_type: 'whisper',
      };

      // Add disappearing message settings if enabled
      if (defaultExpireDuration > 0) {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + defaultExpireDuration);
        messageData.expires_at = expiresAt.toISOString();
        messageData.expire_duration = defaultExpireDuration;
      }

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('Message sent successfully');

      const messageItem: MessageItem = {
        ...data,
        decryptedText: messageText,
        isOutgoing: true,
      };

      setMessages((prev) => [...prev, messageItem]);

      // Auto-delete message after expiration
      if (defaultExpireDuration > 0 && data.id) {
        setTimeout(() => {
          deleteExpiredMessage(data.id);
        }, defaultExpireDuration * 1000);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMsg = error?.message || 'Failed to send message';
      if (errorMsg.includes('encryption keys')) {
        setError('Recipient needs to set up Signal protocol. Ask them to open the app and go to Settings → Initialize Signal Protocol.');
      } else {
        setError(errorMsg);
      }
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  };

  const deleteExpiredMessage = async (messageId: string) => {
    try {
      await supabase.from('messages').delete().eq('id', messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      console.log('Expired message deleted:', messageId);
    } catch (error) {
      console.error('Error deleting expired message:', error);
    }
  };

  const renderMessage = ({ item }: { item: MessageItem }) => {
    const hasExpiration = item.expire_duration && item.expire_duration > 0;

    return (
      <View
        style={[
          styles.messageBubble,
          item.isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
        ]}
      >
        {item.attachment_url && (
          <View style={styles.attachmentContainer}>
            {item.attachment_type === 'image' || item.attachment_type === 'gif' ? (
              <Image source={{ uri: item.attachment_url }} style={styles.attachmentImage} />
            ) : (
              <View style={styles.fileAttachment}>
                <File size={24} color={item.isOutgoing ? '#fff' : '#0088cc'} />
                <Text
                  style={[
                    styles.fileName,
                    item.isOutgoing ? styles.outgoingText : styles.incomingText,
                  ]}
                >
                  {item.attachment_name || 'File'}
                </Text>
              </View>
            )}
          </View>
        )}

        {item.decryptedText && (
          <Text
            style={[
              styles.messageText,
              item.isOutgoing ? styles.outgoingText : styles.incomingText,
            ]}
          >
            {item.decryptedText}
          </Text>
        )}

        <View style={styles.messageFooter}>
          <Text
            style={[
              styles.timestamp,
              item.isOutgoing ? styles.outgoingTimestamp : styles.incomingTimestamp,
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
          {hasExpiration && (
            <Text
              style={[
                styles.expirationIndicator,
                item.isOutgoing ? styles.outgoingTimestamp : styles.incomingTimestamp,
              ]}
            >
              🔥 {formatDuration(item.expire_duration!)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const toggleDisappearingTimer = () => {
    const handleSelection = async (duration: number) => {
      setDefaultExpireDuration(duration);
      await saveChatSettings(duration);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Disappearing Messages',
          options: ['Cancel', 'Off', '30 seconds', '1 minute', '3 minutes', '5 minutes', '1 hour', '1 day'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          const durations = [0, 0, 30, 60, 180, 300, 3600, 86400];
          if (buttonIndex > 0) handleSelection(durations[buttonIndex]);
        }
      );
    } else {
      Alert.alert(
        'Disappearing Messages',
        'Messages will auto-delete after:',
        [
          { text: 'Off', onPress: () => handleSelection(0) },
          { text: '30 seconds', onPress: () => handleSelection(30) },
          { text: '1 minute', onPress: () => handleSelection(60) },
          { text: '3 minutes', onPress: () => handleSelection(180) },
          { text: '5 minutes', onPress: () => handleSelection(300) },
          { text: '1 hour', onPress: () => handleSelection(3600) },
          { text: '1 day', onPress: () => handleSelection(86400) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {recipient?.username || 'Loading...'}
          </Text>
          {defaultExpireDuration > 0 && (
            <Text style={styles.headerSubtitle}>
              🔥 Disappearing: {formatDuration(defaultExpireDuration)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.timerButton}
          onPress={toggleDisappearingTimer}
          activeOpacity={0.6}
        >
          <Timer size={24} color="#ffffff" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      <View style={styles.inputContainer}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.iconButton} onPress={pickDocument} activeOpacity={0.7} disabled={uploading}>
            <Paperclip size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={pickImage} activeOpacity={0.7} disabled={uploading}>
            <ImageIcon size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              setError(null);
            }}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5DDD5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  timerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButton: {
    marginRight: 8,
  },
  messagesList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  outgoingBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.bubble,
    borderBottomRightRadius: 2,
  },
  incomingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  outgoingText: {
    color: '#000000',
  },
  incomingText: {
    color: theme.colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  expirationIndicator: {
    fontSize: 11,
    marginLeft: 8,
  },
  outgoingTimestamp: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  incomingTimestamp: {
    color: theme.colors.textSecondary,
  },
  attachmentContainer: {
    marginBottom: 8,
  },
  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
  },
  fileName: {
    marginLeft: 8,
    fontSize: 14,
  },
  inputContainer: {
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  errorBanner: {
    backgroundColor: theme.colors.danger + '20',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
});
