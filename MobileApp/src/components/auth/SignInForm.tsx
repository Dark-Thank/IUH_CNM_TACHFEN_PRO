import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SignInFormProps {
  onSignUpPress?: () => void;
  onForgotPress?: () => void;
}

type SignInErrors = {
  username?: string;
  password?: string;
};

export default function SignInForm({ onSignUpPress, onForgotPress }: SignInFormProps) {
  const { isDark } = useThemeStore();
  const { loading, signIn } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignInErrors>({});

  const colors = getColors(isDark);

  const validate = () => {
    const nextErrors: SignInErrors = {};

    if (username.trim().length < 3) {
      nextErrors.username = "Username phải có it nhất 3 ký tự.";
    }

    if (password.length < 6) {
      nextErrors.password = "Mật khẩu phải có ít nhất 6 ký tự.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || loading) {
      return;
    }
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      // Đã toast lỗi ở store, không throw lại để tránh RN overlay
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={[styles.logo, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.logoText, { color: colors.primary }]}>M</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Chào mừng trở lại
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Đăng nhập vào tài khoản của bạn.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Username</Text>
              <View
                style={[
                  styles.inputShell,
                  {
                    backgroundColor: colors.input,
                    borderColor: errors.username ? colors.danger : colors.border,
                  },
                ]}
              >
                <UserRound
                  size={18}
                  color={colors.muted}
                />
                <TextInput
                  value={username}
                  onChangeText={(value) => {
                    setUsername(value);
                    setErrors((current) => ({ ...current, username: undefined }));
                  }}
                  placeholder="username"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
              {errors.username ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {errors.username}
                </Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Mật khẩu</Text>
              <View
                style={[
                  styles.inputShell,
                  {
                    backgroundColor: colors.input,
                    borderColor: errors.password ? colors.danger : colors.border,
                  },
                ]}
              >
                <LockKeyhole
                  size={18}
                  color={colors.muted}
                />
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  style={[styles.input, { color: colors.text }]}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={10}
                >
                  {showPassword ? (
                    <EyeOff
                      size={18}
                      color={colors.muted}
                    />
                  ) : (
                    <Eye
                      size={18}
                      color={colors.muted}
                    />
                  )}
                </Pressable>
              </View>
              {errors.password ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {errors.password}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: colors.primary,
                  opacity: loading ? 0.65 : pressed ? 0.88 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitText}>Đăng nhập</Text>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.muted }]}>
                Bạn chưa có tài khoản?
              </Text>
              <Pressable onPress={onSignUpPress}>
                <Text style={[styles.switchLink, { color: colors.primary }]}>
                  Đăng ký
                </Text>
              </Pressable>
            </View>
            <View style={[styles.switchRow, { marginTop: 8 }]}>
              <Pressable onPress={() => onForgotPress?.()}>
                <Text style={[styles.switchLink, { color: colors.primary }]}>Quên mật khẩu?</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getColors = (isDark: boolean) => ({
  background: isDark ? "#0f172a" : "#f8fafc",
  card: isDark ? "#111827" : "#ffffff",
  input: isDark ? "#0f172a" : "#f8fafc",
  text: isDark ? "#f8fafc" : "#0f172a",
  muted: isDark ? "#94a3b8" : "#64748b",
  placeholder: isDark ? "#64748b" : "#94a3b8",
  border: isDark ? "#1f2937" : "#e2e8f0",
  primary: isDark ? "#a855f7" : "#7c3aed",
  primarySoft: isDark ? "#312e81" : "#ede9fe",
  danger: "#ef4444",
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    gap: 18,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  inputShell: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: "800",
  },
});
