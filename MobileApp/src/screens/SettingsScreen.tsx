import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import { Camera, ChevronRight, KeyRound, LogOut, Moon, Sun, UserRound } from "lucide-react-native";
import { authService } from "@/services/authService";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useUserStore } from "@/stores/useUserStore";

const ACCOUNT_SHEET_SNAP_POINTS = ["85%"];

export default function SettingsScreen() {
  const accountSheetRef = useRef<BottomSheetModal>(null);
  const { isDark, toggleTheme } = useThemeStore();
  const { user, loading, signOut } = useAuthStore();
  const { updateAvatarUrl, updateProfile, deleteAccount } = useUserStore();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [requestingPasswordChange, setRequestingPasswordChange] = useState(false);
  const [confirmingPasswordChange, setConfirmingPasswordChange] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [awaitingPasswordOtp, setAwaitingPasswordOtp] = useState(false);

  const colors = {
    background: isDark ? "#0f172a" : "#f8fafc",
    card: isDark ? "#111827" : "#ffffff",
    cardSoft: isDark ? "#1e293b" : "#f1f5f9",
    border: isDark ? "#1f2937" : "#e2e8f0",
    text: isDark ? "#f8fafc" : "#0f172a",
    muted: isDark ? "#94a3b8" : "#64748b",
    danger: "#ef4444",
    primary: isDark ? "#c084fc" : "#7c3aed",
  };

  const syncFormWithUser = () => {
    setDisplayName(user?.displayName || "");
    setBio(user?.bio || "");
    setCurrentPassword("");
    setNewPassword("");
    setPasswordOtp("");
    setAwaitingPasswordOtp(false);
  };

  const openAccountSheet = () => {
    syncFormWithUser();
    accountSheetRef.current?.present();
  };

  useEffect(() => {
    syncFormWithUser();
  }, [user?._id, user?.displayName, user?.bio]);

  const trimmedDisplayName = displayName.trim();
  const trimmedBio = bio.trim();
  const hasChanges =
    trimmedDisplayName !== (user?.displayName ?? "").trim() ||
    trimmedBio !== (user?.bio ?? "").trim();

  const handleSignOut = async () => {
    accountSheetRef.current?.dismiss();
    await signOut();
  };

  const handleSaveProfile = async () => {
    if (!trimmedDisplayName || !hasChanges) {
      return;
    }

    setSaving(true);

    try {
      await updateProfile({
        displayName: trimmedDisplayName,
        bio: trimmedBio,
      });
    } catch (error) {
      console.error("Không thể cập nhật hồ sơ", error);
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      toast.info("Cần cấp quyền thư viện ảnh để cập nhật ảnh đại diện.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];
    const formData = new FormData();

    formData.append("file", {
      uri: asset.uri,
      name: asset.fileName || `avatar-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    } as any);

    setUploadingAvatar(true);

    try {
      await updateAvatarUrl(formData);
      toast.success("Đã cập nhật ảnh đại diện.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRequestPasswordChange = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.info("Nhập mật khẩu hiện tại và mật khẩu mới trước.");
      return;
    }

    setRequestingPasswordChange(true);

    try {
      await authService.requestChangePassword(currentPassword.trim(), newPassword.trim());
      setAwaitingPasswordOtp(true);
      toast.success("Mã OTP đã được gửi tới email của bạn.");
    } catch (error: any) {
      console.error("Không thể gửi yêu cầu đổi mật khẩu", error);
      toast.error(error?.response?.data?.message || "Yêu cầu đổi mật khẩu thất bại.");
    } finally {
      setRequestingPasswordChange(false);
    }
  };

  const handleConfirmPasswordChange = async () => {
    if (!user?.email) {
      toast.error("Không tìm thấy email người dùng.");
      return;
    }

    if (!passwordOtp.trim() || !newPassword.trim()) {
      toast.info("Nhập mã OTP và mật khẩu mới để xác nhận.");
      return;
    }

    setConfirmingPasswordChange(true);

    try {
      await authService.resetPassword(user.email, passwordOtp.trim(), newPassword.trim());
      setCurrentPassword("");
      setNewPassword("");
      setPasswordOtp("");
      setAwaitingPasswordOtp(false);
      toast.success("Đổi mật khẩu thành công.");
    } catch (error: any) {
      console.error("Không thể xác nhận đổi mật khẩu", error);
      toast.error(error?.response?.data?.message || "Mã OTP không chính xác.");
    } finally {
      setConfirmingPasswordChange(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Xóa tài khoản",
      "Toàn bộ dữ liệu liên quan đến tài khoản sẽ bị xóa. Bạn có chắc chắn muốn tiếp tục?",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            accountSheetRef.current?.dismiss();
            setDeleting(true);

            try {
              await deleteAccount();
            } catch (error) {
              console.error("Không thể xóa tài khoản", error);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={["left", "right"]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.cardSoft }]}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(user?.displayName || user?.username || "M").charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user?.displayName || "Người dùng Tachfen"}
            </Text>
            <Text style={[styles.profileMeta, { color: colors.muted }]}>
              @{user?.username || "username"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Giao diện</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.cardSoft }]}>
              {isDark ? (
                <Moon size={20} color={colors.primary} />
              ) : (
                <Sun size={20} color={colors.primary} />
              )}
            </View>

            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Chế độ tối</Text>
            </View>

            <Switch value={isDark} onValueChange={toggleTheme} />
          </View>
        </View>

        <Pressable
          onPress={openAccountSheet}
          style={[
            styles.section,
            styles.accountButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.settingIcon, { backgroundColor: colors.cardSoft }]}>
            <UserRound size={20} color={colors.primary} />
          </View>

          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Tài khoản</Text>
            <Text style={[styles.settingDesc, { color: colors.muted }]}>
              Xem và sửa thông tin tài khoản của bạn
            </Text>
          </View>

          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={handleSignOut}
        disabled={loading || deleting}
        style={[
          styles.signOutButton,
          {
            backgroundColor: colors.danger,
            opacity: loading || deleting ? 0.6 : 1,
          },
        ]}
      >
        <LogOut size={19} color="#ffffff" />
        <Text style={styles.signOutText}>
          {loading ? "Đang đăng xuất..." : "Đăng xuất"}
        </Text>
      </Pressable>

      <BottomSheetModal
        ref={accountSheetRef}
        snapPoints={ACCOUNT_SHEET_SNAP_POINTS}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.muted }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Tài khoản</Text>

          <View style={[styles.infoBox, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Email</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.email || "Chưa có email"}
            </Text>
          </View>

          <View style={[styles.infoBox, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Tên đăng nhập</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.username || "Chưa cập nhật"}
            </Text>
          </View>

          <View style={[styles.infoBox, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Avatar</Text>
            <View style={styles.avatarRow}>
              <View style={[styles.avatarSmall, { backgroundColor: colors.cardSoft }]}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarTextSmall, { color: colors.primary }]}>
                    {(user?.displayName || user?.username || "M").charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <Text style={[styles.infoValue, { color: colors.text }]}>
                {user?.avatarUrl ? "Đã có ảnh đại diện" : "Chưa có ảnh đại diện"}
              </Text>
            </View>

            <Pressable
              onPress={handlePickAvatar}
              disabled={uploadingAvatar || saving || deleting}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.cardSoft,
                  borderColor: colors.border,
                  opacity: uploadingAvatar || saving || deleting ? 0.6 : 1,
                },
              ]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Camera size={18} color={colors.primary} />
              )}
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}> 
                {uploadingAvatar ? "Đang tải ảnh..." : "Đổi ảnh đại diện"}
              </Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>
                  Tên hiển thị
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.cardSoft,
                    },
                  ]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>Giới thiệu</Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  style={[
                    styles.input,
                    styles.inputMultiline,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.cardSoft,
                    },
                  ]}
                />
              </View>

              <Pressable
                onPress={handleSaveProfile}
                disabled={saving || deleting || !trimmedDisplayName || !hasChanges}
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: colors.primary,
                    opacity:
                      saving || deleting || !trimmedDisplayName || !hasChanges ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </Text>
              </Pressable>

              <View style={[styles.securityCard, { borderColor: colors.border, backgroundColor: colors.cardSoft }]}> 
                <View style={styles.securityHeader}>
                  <View style={[styles.settingIcon, { backgroundColor: colors.card }]}> 
                    <KeyRound size={18} color={colors.primary} />
                  </View>

                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>Đổi mật khẩu</Text>
                    <Text style={[styles.settingDesc, { color: colors.muted }]}> 
                      Xác nhận bằng OTP gửi về email để tăng độ an toàn.
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.muted }]}>Mật khẩu hiện tại</Text>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.muted }]}>Mật khẩu mới</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  />
                </View>

                {awaitingPasswordOtp ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.muted }]}>Mã OTP</Text>
                      <TextInput
                        value={passwordOtp}
                        onChangeText={setPasswordOtp}
                        autoCapitalize="none"
                        keyboardType="number-pad"
                        style={[
                          styles.input,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                          },
                        ]}
                      />
                    </View>

                    <Pressable
                      onPress={handleConfirmPasswordChange}
                      disabled={confirmingPasswordChange || deleting || saving}
                      style={[
                        styles.saveButton,
                        {
                          backgroundColor: colors.primary,
                          opacity: confirmingPasswordChange || deleting || saving ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.saveButtonText}>
                        {confirmingPasswordChange ? "Đang xác nhận..." : "Xác nhận OTP"}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={handleRequestPasswordChange}
                    disabled={requestingPasswordChange || deleting || saving}
                    style={[
                      styles.saveButton,
                      {
                        backgroundColor: colors.primary,
                        opacity: requestingPasswordChange || deleting || saving ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.saveButtonText}>
                      {requestingPasswordChange ? "Đang gửi yêu cầu..." : "Gửi yêu cầu đổi mật khẩu"}
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={[styles.dangerZone, { borderColor: colors.border }]}>
                <Text style={[styles.dangerTitle, { color: colors.danger }]}>
                  Khu vực nguy hiểm
                </Text>
                <Text style={[styles.dangerDesc, { color: colors.muted }]}>
                  Xóa tài khoản sẽ xóa dữ liệu liên quan đến bạn trong hệ thống.
                </Text>

                <Pressable
                  onPress={handleDeleteAccount}
                  disabled={deleting || saving}
                  style={[
                    styles.deleteButton,
                    {
                      backgroundColor: colors.danger,
                      opacity: deleting || saving ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={styles.deleteButtonText}>
                    {deleting ? "Đang xóa tài khoản..." : "Xóa tài khoản"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "900",
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
  },
  profileMeta: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  sheetContent: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    gap: 14,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextSmall: {
    fontSize: 18,
    fontWeight: "900",
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  formContent: {
    gap: 12,
    paddingBottom: 8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  securityCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    gap: 12,
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dangerZone: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    gap: 10,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  dangerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
    marginHorizontal: 20,
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
});
