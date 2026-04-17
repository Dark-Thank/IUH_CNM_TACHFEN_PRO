import { useEffect, useRef, useState } from "react";
import {
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
import { ChevronRight, LogOut, Moon, Sun, UserRound } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useUserStore } from "@/stores/useUserStore";

const ACCOUNT_SHEET_SNAP_POINTS = ["85%"];

export default function SettingsScreen() {
  const accountSheetRef = useRef<BottomSheetModal>(null);
  const { isDark, toggleTheme } = useThemeStore();
  const { user, loading, signOut } = useAuthStore();
  const { updateProfile, deleteAccount } = useUserStore();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      console.error("Khong the cap nhat profile", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Xoa tai khoan",
      "Toan bo du lieu lien quan den tai khoan se bi xoa. Ban co chac chan muon tiep tuc?",
      [
        {
          text: "Huy",
          style: "cancel",
        },
        {
          text: "Xoa",
          style: "destructive",
          onPress: async () => {
            accountSheetRef.current?.dismiss();
            setDeleting(true);

            try {
              await deleteAccount();
            } catch (error) {
              console.error("Khong the xoa tai khoan", error);
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
              {user?.displayName || "Moji user"}
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Giao dien</Text>
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
              <Text style={[styles.settingTitle, { color: colors.text }]}>Dark mode</Text>
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
            <Text style={[styles.settingTitle, { color: colors.text }]}>Tai khoan</Text>
            <Text style={[styles.settingDesc, { color: colors.muted }]}>
              Xem va sua thong tin tai khoan cua ban
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
          {loading ? "Dang dang xuat..." : "Dang xuat"}
        </Text>
      </Pressable>

      <BottomSheetModal
        ref={accountSheetRef}
        snapPoints={ACCOUNT_SHEET_SNAP_POINTS}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.muted }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Tai khoan</Text>

          <View style={[styles.infoBox, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Email</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.email || "Chua co email"}
            </Text>
          </View>

          <View style={[styles.infoBox, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Username</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.username || "Chua cap nhat"}
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
                {user?.avatarUrl ? "Da co avatar" : "Chua co avatar"}
              </Text>
            </View>
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
                  Ten hien thi
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
                <Text style={[styles.inputLabel, { color: colors.muted }]}>Gioi thieu</Text>
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
                  {saving ? "Dang luu..." : "Luu thay doi"}
                </Text>
              </Pressable>

              <View style={[styles.dangerZone, { borderColor: colors.border }]}>
                <Text style={[styles.dangerTitle, { color: colors.danger }]}>
                  Khu vuc nguy hiem
                </Text>
                <Text style={[styles.dangerDesc, { color: colors.muted }]}>
                  Xoa tai khoan se xoa du lieu lien quan den ban trong he thong.
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
                    {deleting ? "Dang xoa tai khoan..." : "Xoa tai khoan"}
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
