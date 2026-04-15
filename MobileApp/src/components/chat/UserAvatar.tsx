import { Image, StyleSheet, Text, View } from "react-native";
import { useThemeStore } from "@/stores/useThemeStore";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
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
}: UserAvatarProps) {
  const { isDark } = useThemeStore();

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  } as const;

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={avatarStyle} />;
  }

  return (
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
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
