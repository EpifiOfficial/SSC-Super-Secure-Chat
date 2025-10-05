import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { testSupabaseConnection } from '@/services/supabaseTest';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const { signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    testSupabaseConnection().then(result => {
      if (!result.success) {
        console.error('Supabase connection check:', result);
        setConnectionStatus(result.message);
      } else {
        console.log('Supabase connection check:', result.message);
      }
    });
  }, []);

  const handleLogin = async () => {
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Login error details:', error);
      console.error('Error type:', typeof error);
      console.error('Error keys:', error ? Object.keys(error) : 'null');

      let errorMessage = 'Unable to sign in. Please check your credentials and try again.';

      if (error?.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid') || msg.includes('credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (msg.includes('email not confirmed')) {
          errorMessage = 'Please confirm your email address before signing in.';
        } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
          errorMessage = `Connection error: ${error.message}. The authentication service may be unavailable.`;
        } else if (msg.includes('jwt') || msg.includes('token') || msg.includes('expired')) {
          errorMessage = 'Authentication configuration error. Please contact support.';
        } else {
          errorMessage = error.message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <MessageCircle size={64} color="#0088cc" />
          <Text style={styles.title}>SecureChat</Text>
          <Text style={styles.subtitle}>End-to-End Encrypted Messaging</Text>
        </View>

        <View style={styles.form}>
          {connectionStatus && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>⚠️ {connectionStatus}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {error.includes('configuration') && (
                <Text style={styles.errorHint}>
                  {'\n'}Tip: Check that your Supabase credentials in .env are valid and not expired.
                </Text>
              )}
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#8e8e93"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8e8e93"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/(auth)/signup')}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Don't have an account? Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  warningContainer: {
    backgroundColor: '#ffeaa7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fdcb6e',
  },
  warningText: {
    color: '#d63031',
    fontSize: 13,
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: '#fee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fcc',
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    lineHeight: 20,
  },
  errorHint: {
    color: '#900',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f2f2f7',
  },
  button: {
    height: 50,
    backgroundColor: '#0088cc',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#0088cc',
    fontSize: 14,
    fontWeight: '500',
  },
});
