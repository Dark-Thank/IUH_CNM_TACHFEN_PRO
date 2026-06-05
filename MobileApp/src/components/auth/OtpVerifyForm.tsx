import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useState } from "react";
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
}

export default function OtpVerifyForm({ onCancel }: Props) {
    const { isDark } = useThemeStore();
    const { pendingOtpEmail, verifyOtp, loading } = useAuthStore();
    const [otp, setOtp] = useState("");
    const colors = getColors(isDark);

    const handleSubmit = async () => {
        if (!pendingOtpEmail) return;

        await verifyOtp(pendingOtpEmail, otp.trim());
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardView}
            >
                <View style={[styles.container, { backgroundColor: colors.card }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Xác thực OTP</Text>
                    <Text style={[styles.help, { color: colors.muted }]}>Mã OTP đã được gửi tới: {pendingOtpEmail}</Text>

                    <TextInput
                        value={otp}
                        onChangeText={setOtp}
                        placeholder="Nhập mã OTP"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="number-pad"
                        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    />

                    {/* OTP-only flow (used for sign-in / sign-up) */}

                    <Pressable
                        onPress={handleSubmit}
                        disabled={loading}
                        style={({ pressed }) => [
                            styles.submit,
                            { backgroundColor: colors.primary, opacity: loading ? 0.65 : pressed ? 0.88 : 1 },
                        ]}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Xác thực</Text>}
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
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    submit: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
    submitText: { color: "#fff", fontWeight: "800" },
    row: { marginTop: 8, alignItems: "center" },
    cancelText: { fontSize: 14 },
});
