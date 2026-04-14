import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { ChevronRight, LogOut, Moon, Sun, UserRound } from "lucide-react-native";
import { useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCOUNT_SHEET_SNAP_POINTS = ["48%"];

export default function SettingsScreen() {
  const accountSheetRef = useRef<BottomSheetModal>(null);
  const { isDark, toggleTheme } = useThemeStore();
  const { user, loading, signOut } = useAuthStore();

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

  const openAccountSheet = () => {
    accountSheetRef.current?.present();
  };

  const handleSignOut = async () => {
    accountSheetRef.current?.dismiss();
    await signOut();
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
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(user?.displayName || user?.username || "M").charAt(0).toUpperCase()}
            </Text>
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Giao diện
            </Text>
          </View>
          <View style={styles.settingRow}>
            <View
              style={[styles.settingIcon, { backgroundColor: colors.cardSoft }]}
            >
              {isDark ? (
                <Moon size={20} color={colors.primary} />
              ) : (
                <Sun size={20} color={colors.primary} />
              )}
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Dark mode
              </Text>
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
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              Tài khoản
            </Text>
            <Text style={[styles.settingDesc, { color: colors.muted }]}>
              Xem và sửa thông tin tài khoản của bạn
            </Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      </ScrollView>
      <Pressable
            onPress={handleSignOut}
            disabled={loading}
            style={[
              styles.signOutButton,
              { backgroundColor: colors.danger, opacity: loading ? 0.6 : 1 },
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
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            Tài khoản
          </Text>
          <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>
            Màn hình này thay thế modal profile rỗng trên web bằng bottom sheet để
            thao tác nhanh hơn trên mobile.
          </Text>

          <View style={[styles.infoBox, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Email</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.email || "Chưa có email"}
            </Text>
          </View>

          <View style={[styles.infoBox, { borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>
              Display name
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.displayName || "Chưa cập nhật"}
            </Text>
          </View>

          
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
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 21,
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
