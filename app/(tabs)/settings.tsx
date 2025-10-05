import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { CryptoService } from '@/services/CryptoService';
import { LogOut, Shield, User, Key, Clock, Check } from 'lucide-react-native';
import { theme } from '@/constants/theme';

const DISAPPEARING_DURATIONS = [
  { label: 'Off', value: 0 },
  { label: '5 seconds', value: 5 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '1 hour', value: 3600 },
  { label: '1 day', value: 86400 },
  { label: '1 week', value: 604800 },
];

export default function SettingsScreen() {
  const [initializing, setInitializing] = useState(false);
  const [defaultExpireDuration, setDefaultExpireDuration] = useState<number>(0);
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const updateExpireDuration = (duration: number) => {
    setDefaultExpireDuration(duration);
    const durationLabel = DISAPPEARING_DURATIONS.find(d => d.value === duration)?.label;
    Alert.alert(
      'Setting Updated',
      duration === 0
        ? 'Disappearing messages disabled for new chats'
        : `New messages will disappear after ${durationLabel?.toLowerCase()}`
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Force navigation to login screen
              router.replace('/');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const initializeEncryption = async () => {
    if (!user) return;

    Alert.alert(
      'Initialize Encryption',
      'This will generate new encryption keys for secure messaging.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Initialize',
          onPress: async () => {
            setInitializing(true);
            try {
              const cryptoService = new CryptoService(user.id);
              await cryptoService.initialize();
              Alert.alert('Success', 'Signal protocol initialized successfully. Your messages are now end-to-end encrypted using the Signal protocol.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to initialize Signal protocol');
            } finally {
              setInitializing(false);
            }
          },
        },
      ]
    );
  };

  const hasEncryptionKeys = profile?.identity_key_public != null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.username?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{profile?.username || 'User'}</Text>
            <Text style={styles.userId}>ID: {user?.id.slice(0, 8)}...</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>

        <TouchableOpacity
          style={[styles.menuItem, initializing && styles.menuItemDisabled]}
          onPress={initializeEncryption}
          disabled={initializing}
          activeOpacity={0.7}
        >
          <View style={styles.menuItemLeft}>
            <Key size={20} color="#0088cc" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>
                {hasEncryptionKeys ? 'Reinitialize Signal Protocol' : 'Initialize Signal Protocol'}
              </Text>
              <Text style={styles.menuItemSubtitle}>
                {hasEncryptionKeys
                  ? 'Generate new Signal protocol keys'
                  : 'Set up Signal protocol encryption'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Shield size={20} color="#0088cc" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>Signal Protocol Status</Text>
              <Text style={styles.menuItemSubtitle}>
                {hasEncryptionKeys ? 'Signal protocol active' : 'Not initialized'}
              </Text>
            </View>
          </View>
        </View>

      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>

        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Clock size={20} color="#0088cc" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>Disappearing Messages</Text>
              <Text style={styles.menuItemSubtitle}>
                {defaultExpireDuration === 0
                  ? 'Disabled'
                  : DISAPPEARING_DURATIONS.find(d => d.value === defaultExpireDuration)?.label}
              </Text>
            </View>
          </View>
        </View>

        {DISAPPEARING_DURATIONS.map((duration) => (
          <TouchableOpacity
            key={duration.value}
            style={styles.durationOption}
            onPress={() => updateExpireDuration(duration.value)}
          >
            <Text style={styles.durationLabel}>{duration.label}</Text>
            {defaultExpireDuration === duration.value && (
              <Check size={20} color="#0088cc" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
          <View style={styles.menuItemLeft}>
            <LogOut size={20} color="#ff3b30" />
            <View style={styles.menuItemText}>
              <Text style={[styles.menuItemTitle, styles.destructive]}>
                Sign Out
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>SecureChat v1.0.0</Text>
        <Text style={styles.footerSubtext}>End-to-End Encrypted Messaging</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
  section: {
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#f2f2f7',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userId: {
    fontSize: 14,
    color: '#8e8e93',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemDisabled: {
    color: '#c7c7cc',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 12,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 17,
    color: '#000',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#8e8e93',
  },
  destructive: {
    color: '#ff3b30',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#c7c7cc',
  },
  durationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  durationLabel: {
    fontSize: 17,
    color: '#000',
  },
});
