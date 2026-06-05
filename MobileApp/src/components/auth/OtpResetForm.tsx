import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { Eye, EyeOff, LockKeyhole } from "lucide-react-native";
import { useState } from "react";
import { authService } from "@/services/authService";
import { toast } from "@/lib/toast";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
    onCancel?: () => void;
    onSuccess?: () => void;
}

export default function OtpResetForm({ onCancel, onSuccess }: Props) {
    const { isDark } = useThemeStore();
    const { pendingOtpEmail } = useAuthStore();
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const colors = getColors(isDark);

    const handleSubmit = async () => {
        if (!pendingOtpEmail) return;
        try {
            setLoading(true);
            // basic client-side validation
            const trimmedOtp = otp.trim();
            if (!trimmedOtp || trimmedOtp.length < 4) {
                toast.error("Vui lòng nhập mã OTP hợp lệ.");
                return;
            }

            if (!newPassword || newPassword.length < 6) {
                toast.error("Mật khẩu mới phải có ít nhất 6 ký tự.");
                return;
            }

            await authService.resetPassword(pendingOtpEmail, trimmedOtp, newPassword);
            toast.success("Đặt lại mật khẩu thành công. Vui lòng đăng nhập.");
            if (onSuccess) {
                onSuccess();
            } else {
                useAuthStore.setState({ pendingOtpForReset: false, pendingOtpEmail: null });
            }
        } catch (e) {
            // show server-provided message when available to help debugging
            // eslint-disable-next-line no-console
            console.error(e);
            // Try to surface backend error message if present
            const serverMessage = (e as any)?.response?.data?.message || (e as any)?.message;
            toast.error(serverMessage || "Đặt lại mật khẩu thất bại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardView}
            >
                <View style={[styles.container, { backgroundColor: colors.card }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Đặt lại mật khẩu</Text>
                    <Text style={[styles.help, { color: colors.muted }]}>Mã OTP đã được gửi tới: {pendingOtpEmail}</Text>

                    <TextInput
                        value={otp}
                        onChangeText={setOtp}
                        placeholder="Nhập mã OTP"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="number-pad"
                        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    />

                    <View style={[styles.inputShell, { backgroundColor: colors.input, borderColor: colors.border }]}>
                        <LockKeyhole size={18} color={colors.muted} />
                        <TextInput
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Mật khẩu mới"
                            placeholderTextColor={colors.placeholder}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[styles.inputFlex, { color: colors.text }]}
                        />
                        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                            {showPassword ? (
                                <EyeOff size={18} color={colors.muted} />
                            ) : (
                                <Eye size={18} color={colors.muted} />
                            )}
                        </Pressable>
                    </View>

                    <Pressable
                        onPress={handleSubmit}
                        disabled={loading}
                        style={({ pressed }) => [
                            styles.submit,
                            { backgroundColor: colors.primary, opacity: loading ? 0.65 : pressed ? 0.88 : 1 },
                        ]}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Xác thực và Đổi mật khẩu</Text>}
                    </Pressable>

                    <View style={styles.row}>
                        <Pressable onPress={onCancel}>
                            <Text style={[styles.cancelText, { color: colors.muted }]}>Hủy</Text>
                        </Pressable>
                    </View>
                </View>
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
});

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    keyboardView: { flex: 1 },
    container: {
        margin: 20,
        borderRadius: 16,
        padding: 20,
        gap: 12,
    },
    title: { fontSize: 20, fontWeight: "800", textAlign: "center" },
    help: { textAlign: "center", fontSize: 13 },
    input: {
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        marginTop: 12,
    },
    inputShell: {
        minHeight: 50,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    inputFlex: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 0,
    },
    submit: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
    submitText: { color: "#fff", fontWeight: "800" },
    row: { marginTop: 8, alignItems: "center" },
    cancelText: { fontSize: 14 },
});
