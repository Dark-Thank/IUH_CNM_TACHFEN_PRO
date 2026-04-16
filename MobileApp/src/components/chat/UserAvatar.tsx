import { Image, StyleSheet, Text, View } from "react-native";
import { useThemeStore } from "@/stores/useThemeStore";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  isOnline?: boolean;
  showPresence?: boolean;
}

const getInitials = (name: string) => {
  const trimmed = name.trim();

  if (!trimmed) {
    return "M";
  }

  const parts = trimmed.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function UserAvatar({
  name,
  avatarUrl,
  size = 44,
  isOnline = false,
  showPresence = false,
}: UserAvatarProps) {
  const { isDark } = useThemeStore();

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  } as const;

  const presenceSize = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={[styles.container, avatarStyle]}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={avatarStyle} />
      ) : (
        <View
          style={[
            styles.fallback,
            avatarStyle,
            { backgroundColor: isDark ? "#7c3aed" : "#8b5cf6" },
          ]}
        >
          <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.35) }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}

      {showPresence ? (
        <View
          style={[
            styles.presenceDot,
            {
              width: presenceSize,
              height: presenceSize,
              borderRadius: presenceSize / 2,
              backgroundColor: isOnline ? "#22c55e" : isDark ? "#475569" : "#cbd5e1",
              borderColor: isDark ? "#111827" : "#ffffff",
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#ffffff",
    fontWeight: "700",
  },
  presenceDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    borderWidth: 2,
  },
});
