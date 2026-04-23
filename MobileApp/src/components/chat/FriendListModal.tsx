import { toast } from "@/lib/toast";
import { friendService } from "@/services/friendService";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ProfileModal from "./ProfileModal";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectFriend: (friend: Friend) => void;
}

export default function FriendListModal({
  visible,
  onClose,
  onSelectFriend,
}: Props) {
  const { friends, removeFriend, getFriends } = useFriendStore();

  const {
  blockedUsers,
  setBlockedUsers,
  blockUser,
  unblockUser,
} = useFriendStore();

  const [activeTab, setActiveTab] = useState<"friends">("friends");
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // load friends
  useEffect(() => {
    if (visible) getFriends();
  }, [visible]);

  // check block status
  useEffect(() => {
  const checkAll = async () => {
    const results = await Promise.all(
      friends.map(async (f) => {
        const isBlocked = await friendService.checkBlockStatus(f._id);
        return isBlocked ? f._id : null;
      })
    );

    const blockedIds = results.filter((id): id is string => id !== null);
    setBlockedUsers([...new Set(blockedIds)]);
  };

  if (friends.length > 0) checkAll();
}, [friends]);

  const handleStartChat = (friend: Friend) => {
    console.log("Kiểu dữ liệu:", typeof blockedUsers, "Nội dung:", blockedUsers);
    if (blockedUsers.has(friend._id)) {
      toast.error("Bạn không thể nhắn tin với người này");
      return;
    }
    onSelectFriend(friend);
    onClose();
  };

  const handleToggleBlock = async (friend: Friend) => {
  try {
    const isBlocked = blockedUsers.has(friend._id);

    if (isBlocked) {
      await friendService.unblockFriend(friend._id);
      unblockUser(friend._id);
      toast.success(`Đã bỏ chặn ${friend.displayName}`);
    } else {
      await friendService.blockFriend(friend._id);
      blockUser(friend._id);
      toast.success(`Đã chặn ${friend.displayName}`);
    }
  } catch {
    toast.error("Không thể thay đổi trạng thái");
  }
};

  const handleRemoveFriend = async (friend: Friend) => {
    try {
      await removeFriend(friend._id);
      setMenuVisible(false);
      setSelectedFriend(null);
      toast.success("Đã xóa bạn");
    } catch {
      toast.error("Không thể xóa bạn");
    }
  };

  const openMenu = (friend: Friend) => {
    setSelectedFriend(friend);
    setMenuVisible(true);
  };

  const blockedList = friends.filter((f) =>
    blockedUsers.has(f._id)
  );

  const renderFriend = (friend: Friend) => {
    const isBlocked = blockedUsers.has(friend._id);

    return (
      <View key={friend._id} style={styles.card}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => handleStartChat(friend)}
          disabled={isBlocked}
        >
        <Text style={[styles.name, isBlocked && { opacity: 0.5 }]}>
            {friend.displayName}
            {isBlocked && " (Đã chặn)"}
          </Text>
          <Text style={styles.username}>@{friend.username}</Text>
        </Pressable>

        <Pressable onPress={() => openMenu(friend)}>
          <Text style={styles.more}>⋮</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      {/* MAIN MODAL */}
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.title}>Bạn bè</Text>
            <Pressable onPress={onClose} style={styles.closeIcon}>
              <Text style={{ fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          {/* TABS */}
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setActiveTab("friends")}
              style={[
                styles.tab,
                activeTab === "friends" && styles.tabActive,
              ]}
            >
              <Text>Bạn bè</Text>
            </Pressable>

            {/* Removed blocked tab */}
          </View>

          {/* LIST */}
          <ScrollView style={{ flex: 1 }}>
            {activeTab === "friends" &&
              (friends.length === 0 ? (
                <Text style={styles.empty}>Chưa có bạn bè</Text>
              ) : (
                friends.map(renderFriend)
              ))}

            {/* Removed blocked list */}
          </ScrollView>
        </View>
      </Modal>

      {/* DROPDOWN MENU */}
      <Modal transparent visible={menuVisible} animationType="fade">
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setTimeout(() => setShowProfile(true), 100);
              }}
            >
              <Text>Xem profile</Text>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                if (selectedFriend) handleToggleBlock(selectedFriend);
                setMenuVisible(false);
              }}
            >
              <Text>
                {selectedFriend &&
                blockedUsers.has(selectedFriend._id)
                  ? "Bỏ chặn"
                  : "Chặn"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                if (selectedFriend) handleRemoveFriend(selectedFriend);
              }}
            >
              <Text style={{ color: "red" }}>Xóa bạn</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* PROFILE MODAL */}
      {selectedFriend && (
        <ProfileModal
          visible={showProfile}
          friend={selectedFriend}
          onClose={() => {
            setShowProfile(false);
            setSelectedFriend(null);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
  },

  closeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },

  tabs: {
    flexDirection: "row",
    marginBottom: 10,
  },

  tab: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },

  tabActive: {
    borderColor: "#6366f1",
  },

  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  name: {
    fontWeight: "700",
    fontSize: 15,
  },

  username: {
    fontSize: 12,
    color: "#666",
  },

  more: {
    fontSize: 20,
    paddingHorizontal: 10,
  },

  empty: {
    textAlign: "center",
    marginTop: 40,
    color: "#666",
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
  },

  menu: {
    backgroundColor: "white",
    marginHorizontal: 40,
    borderRadius: 12,
    padding: 10,
  },

  menuItem: {
    paddingVertical: 10,
  },
});