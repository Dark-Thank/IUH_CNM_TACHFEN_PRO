import { toast } from "@/lib/toast";
import { friendService } from "@/services/friendService";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import UserAvatar from "./UserAvatar";

interface Props {
  visible: boolean;
  friend: Friend | null;
  onClose: () => void;
}

export default function ProfileModal({ visible, friend, onClose }: Props) {
  const { createConversation } = useChatStore();
  const { removeFriend, blockUser, unblockUser } = useFriendStore();

  const [fullUser, setFullUser] = useState<Friend | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!friend || !visible) return;

    setLoading(true);

    Promise.all([
      friendService.getUserById(friend._id),
      friendService.checkBlockStatus(friend._id),
    ])
      .then(([userData, blockStatus]) => {
        setFullUser(userData);
        setIsBlocked(blockStatus);
      })
      .catch(() => {
        setFullUser(friend);
      })
      .finally(() => setLoading(false));
  }, [friend, visible]);

  const user = fullUser || friend;

  const handleChat = async () => {
    if (!user) return;

    if (isBlocked) {
      toast.error("Bạn đã chặn người này");
      return;
    }

    await createConversation("direct", "", [user._id]);
    onClose();
  };

  const handleRemove = async () => {
    if (!user) return;

    try {
      await removeFriend(user._id);
      toast.success("Đã xóa bạn");
      onClose();
    } catch {
      toast.error("Không thể xóa bạn");
    }
  };

  const handleBlock = async () => {
    if (!user) return;

    try {
      setLoading(true);

      if (isBlocked) {
        await friendService.unblockFriend(user._id);
        setIsBlocked(false);
        unblockUser(user._id);
        toast.success("Đã bỏ chặn");
      } else {
        await friendService.blockFriend(user._id);
        setIsBlocked(true);
        blockUser(user._id);
        toast.success("Đã chặn");
      }
    } catch {
      toast.error("Lỗi thao tác");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
  <View style={styles.overlay}>
    <View style={styles.container}>
      
      {/* Nút X */}
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={{ fontSize: 20 }}>✕</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : user ? (
        <ScrollView>
          {/* Cover */}
          <View style={styles.cover} />

          {/* Avatar + name */}
          <View style={styles.header}>
            <UserAvatar
              name={user.displayName}
              avatarUrl={user.avatarUrl}
              size={80}
            />

            <Text style={styles.name}>{user.displayName}</Text>
            <Text style={styles.username}>@{user.username}</Text>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            {user.bio && <Text style={styles.info}>🧑 {user.bio}</Text>}
            {user.email && <Text style={styles.info}>📧 {user.email}</Text>}
            {user.phone && <Text style={styles.info}>📞 {user.phone}</Text>}
            {user.createdAt && (
              <Text style={styles.info}>
                📅 {new Date(user.createdAt).toLocaleDateString("vi-VN")}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, isBlocked && { backgroundColor: "#94a3b8" }]}
              onPress={handleChat}
              disabled={isBlocked}
            >
              <Text style={styles.btnText}>
                {isBlocked ? "Đã chặn" : "Nhắn tin"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.btn, { backgroundColor: "#f59e0b" }]}
              onPress={handleBlock}
            >
              <Text style={styles.btnText}>
                {isBlocked ? "Bỏ chặn" : "Chặn"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.btn, { backgroundColor: "#ef4444" }]}
              onPress={handleRemove}
            >
              <Text style={styles.btnText}>Xóa bạn</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}
    </View>
  </View>
</Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#fff", // full trắng luôn
  },

  container: {
    flex: 1,
    padding: 16,
  },

  closeBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: "#e5e7eb",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  cover: {
    height: 160,
    borderRadius: 12,
    backgroundColor: "#6366f1",
  },

  header: {
    alignItems: "center",
    marginTop: -50,
    marginBottom: 16,
  },

  name: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 10,
  },

  username: {
    color: "#666",
  },

  infoBox: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },

  info: {
    fontSize: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },

  btn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#6366f1",
  },

  btnText: {
    color: "#fff",
    fontWeight: "700",
  },
});