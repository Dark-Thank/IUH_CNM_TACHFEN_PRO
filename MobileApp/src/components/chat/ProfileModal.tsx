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
import { toast } from "@/lib/toast";
import { friendService } from "@/services/friendService";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import UserAvatar from "./UserAvatar";

interface Props {
  visible: boolean;
  friend: Friend | null;
  onClose: () => void;
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileModal({ visible, friend, onClose }: Props) {
  const { createConversation } = useChatStore();
  const { removeFriend, blockUser, unblockUser } = useFriendStore();

  const [fullUser, setFullUser] = useState<Friend | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!friend || !visible) {
      return;
    }

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
    if (!user) {
      return;
    }

    if (isBlocked) {
      toast.error("Ban da chan nguoi nay");
      return;
    }

    await createConversation("direct", "", [user._id]);
    onClose();
  };

  const handleRemove = async () => {
    if (!user) {
      return;
    }

    try {
      await removeFriend(user._id);
      toast.success("Da xoa ban");
      onClose();
    } catch {
      toast.error("Khong the xoa ban");
    }
  };

  const handleBlock = async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);

      if (isBlocked) {
        await friendService.unblockFriend(user._id);
        setIsBlocked(false);
        unblockUser(user._id);
        toast.success("Da bo chan");
      } else {
        await friendService.blockFriend(user._id);
        setIsBlocked(true);
        blockUser(user._id);
        toast.success("Da chan");
      }
    } catch {
      toast.error("Loi thao tac");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>x</Text>
          </Pressable>

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : user ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.cover} />

              <View style={styles.header}>
                <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size={80} />
                <Text style={styles.name}>{user.displayName}</Text>
                <Text style={styles.username}>@{user.username}</Text>
              </View>

              <View style={styles.infoBox}>
                <InfoRow label="username" value={`@${user.username}`} />

                {user.bio ? <InfoRow label="Giới thiệu" value={user.bio} /> : null}
                {user.email ? <InfoRow label="Email" value={user.email} /> : null}
                {user.createdAt ? (
                  <InfoRow
                    label="Ngày tham gia"
                    value={new Date(user.createdAt).toLocaleDateString("vi-VN")}
                  />
                ) : null}
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, isBlocked && { backgroundColor: "#94a3b8" }]}
                  onPress={handleChat}
                  disabled={isBlocked}
                >
                  <Text style={styles.btnText}>{isBlocked ? "Da chan" : "Nhan tin"}</Text>
                </Pressable>

                <Pressable
                  style={[styles.btn, { backgroundColor: "#f59e0b" }]}
                  onPress={handleBlock}
                >
                  <Text style={styles.btnText}>{isBlocked ? "Bo chan" : "Chan"}</Text>
                </Pressable>

                <Pressable
                  style={[styles.btn, { backgroundColor: "#ef4444" }]}
                  onPress={handleRemove}
                >
                  <Text style={styles.btnText}>Xoa ban</Text>
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
    backgroundColor: "#ffffff",
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
  closeText: {
    fontSize: 20,
    textTransform: "uppercase",
  },
  loader: {
    marginTop: 40,
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
    color: "#666666",
  },
  infoBox: {
    backgroundColor: "#f1f5f9",
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 14,
    color: "#0f172a",
    lineHeight: 20,
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
    color: "#ffffff",
    fontWeight: "700",
  },
});
