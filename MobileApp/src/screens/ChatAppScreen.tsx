import ChatCard from "@/components/chat/ChatCard";
import FriendListModal from "@/components/chat/FriendListModal";
import MessageInput from "@/components/chat/MessageInput";
import MessageItem from "@/components/chat/MessageItem";
import PinnedSection from "@/components/chat/PinnedSection";
import ConversationAssetsModal from "@/components/chat/ConversationAssetsModal";
import ProfileModal from "@/components/chat/ProfileModal";
import UserAvatar from "@/components/chat/UserAvatar";
import { getApiBaseUrl } from "@/lib/backendUrl";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { toast } from "@/lib/toast";
import type { RootTabParamList } from "@/navigation/AppNavigator";
import { chatService } from "@/services/chatServiec";
import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message } from "@/types/chat";
import type { Friend, FriendRequest, User } from "@/types/user";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Bell, ChevronDown, ChevronLeft, Menu, MessageCircle, Phone, UserPlus, Users, Video, X } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TOP_LOAD_THRESHOLD = 72;
const EMPTY_TYPING_USERS: { userId: string; displayName: string }[] = [];
const SCROLL_TO_LATEST_DISTANCE = 180;

type ChatNavigation = BottomTabNavigationProp<RootTabParamList, "Chat">;
type SearchStatus = "idle" | "loading" | "not_found" | "found";
type FriendRelationship = "self" | "friend" | "sent" | "received" | "available";
type GroupAvatarFile = {
  uri: string;
  name: string;
  type: string;
};
type GroupAvatarSlot =
  | { type: "friend"; friend: Friend }
  | { type: "count"; count: number };

const resolveAvatarPreviewUri = (avatarUrl?: string) => {
  if (!avatarUrl) {
    return null;
  }

  if (
    avatarUrl.startsWith("http://") ||
    avatarUrl.startsWith("https://") ||
    avatarUrl.startsWith("file://") ||
    avatarUrl.startsWith("data:")
  ) {
    return avatarUrl;
  }

  return `${getApiBaseUrl()}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
};

const getGroupAvatarSlots = (friends: Friend[]): GroupAvatarSlot[] => {
  if (friends.length <= 4) {
    return friends
      .slice(0, 4)
      .map((friend) => ({ type: "friend" as const, friend }));
  }

  return [
    ...friends
      .slice(0, 3)
      .map((friend) => ({ type: "friend" as const, friend })),
    { type: "count" as const, count: friends.length - 3 },
  ];
};

const getGroupTileLayout = (slotCount: number, index: number) => {
  if (slotCount === 1) {
    return styles.groupAvatarTileSingle;
  }

  if (slotCount === 2) {
    return styles.groupAvatarTileDouble;
  }

  if (slotCount === 3 && index === 0) {
    return styles.groupAvatarTileTripleLead;
  }

  return null;
};

function GroupAvatarPreview({
  groupName,
  members,
  avatarUri,
  isDark,
}: {
  groupName: string;
  members: Friend[];
  avatarUri: string | null;
  isDark: boolean;
}) {
  const slots = getGroupAvatarSlots(members);
  const fallbackLabel = groupName.trim().charAt(0).toUpperCase() || "G";

  if (avatarUri) {
    return <Image source={{ uri: avatarUri }} style={styles.groupAvatarPreview} />;
  }

  if (slots.length === 0) {
    return (
      <View
        style={[
          styles.groupAvatarPreview,
          styles.groupAvatarFallback,
          { backgroundColor: isDark ? "#7c3aed" : "#8b5cf6" },
        ]}
      >
        <Text style={styles.groupAvatarFallbackText}>{fallbackLabel}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.groupAvatarPreview,
        styles.groupAvatarPreviewFrame,
        { backgroundColor: isDark ? "#020617" : "#ffffff", borderColor: isDark ? "#1f2937" : "#e2e8f0" },
      ]}
    >
      <View style={styles.groupAvatarGrid}>
        {slots.map((slot, index) => {
          const layoutStyle = getGroupTileLayout(slots.length, index);

          return (
            <View
              key={slot.type === "count" ? `count-${slot.count}` : slot.friend._id}
              style={[
                styles.groupAvatarTile,
                layoutStyle,
                {
                  backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
                },
              ]}
            >
              {slot.type === "count" ? (
                <View
                  style={[
                    styles.groupAvatarCountTile,
                    { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
                  ]}
                >
                  <Text style={[styles.groupAvatarCountText, { color: isDark ? "#ddd6fe" : "#6d28d9" }]}>+{slot.count}</Text>
                </View>
              ) : resolveAvatarPreviewUri(slot.friend.avatarUrl) ? (
                <Image
                  source={{ uri: resolveAvatarPreviewUri(slot.friend.avatarUrl)! }}
                  style={styles.groupAvatarTileImage}
                />
              ) : (
                <View
                  style={[
                    styles.groupAvatarFallback,
                    { backgroundColor: isDark ? "#334155" : "#cbd5e1" },
                  ]}
                >
                  <Text style={[styles.groupAvatarTileInitial, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                    {slot.friend.displayName.trim().charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const uniqueById = <T extends { _id: string }>(items: T[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item._id)) {
      return false;
    }

    seen.add(item._id);
    return true;
  });
};

const getConversationTitle = (conversation: Conversation, currentUserId?: string) => {
  if (conversation.type === "group") {
    return conversation.group?.name || "Nhóm chat";
  }

  return (
    conversation.participants.find((participant) => participant._id !== currentUserId)
      ?.displayName || "Tin nhắn"
  );
};

const getDirectParticipant = (conversation: Conversation, currentUserId?: string) =>
  conversation.participants.find((participant) => participant._id !== currentUserId);

const getConversationActivityLabel = (
  conversation: Conversation,
  onlineUserIds: Set<string>,
  currentUserId?: string
) => {
  if (conversation.type === "direct") {
    const otherUser = getDirectParticipant(conversation, currentUserId);

    if (!otherUser) {
      return "";
    }

    return onlineUserIds.has(otherUser._id) ? "Đang hoạt động" : "Đang ngoại tuyến";
  }

  const members = conversation.participants.filter(
    (participant) => participant._id !== currentUserId
  );
  const onlineCount = members.filter((participant) => onlineUserIds.has(participant._id)).length;

  if (onlineCount <= 0) {
    return `${members.length} thành viên`;
  }

  return `${onlineCount} thành viên đang hoạt động`;
};

const getRequestUser = (request: FriendRequest, type: "received" | "sent") =>
  type === "received" ? request.from : request.to;

const matchesQuery = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase());

const parseInviteToken = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const matchedToken = trimmedValue.match(/\/join-group\/([a-f0-9]+)/i);
  return matchedToken?.[1] ?? trimmedValue;
};

const GROUP_ROLE_LABELS: Record<"owner" | "deputy" | "member", string> = {
  owner: "Chủ nhóm",
  deputy: "Phó nhóm",
  member: "Thành viên",
};

const isSuccessMessage = (message: string) => /thanh cong|thành công/i.test(message);

function SidebarActionCard({
  title,
  icon,
  onPress,
  accessory,
}: {
  title: string;
  icon: ReactNode;
  onPress: () => void;
  accessory?: ReactNode;
}) {
  const { isDark } = useThemeStore();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sidebarActionCard,
        {
          backgroundColor: isDark ? "rgba(30, 41, 59, 0.84)" : "#ffffff",
          borderColor: isDark ? "rgba(148, 163, 184, 0.2)" : "#d7def0",
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.sidebarActionCardContent}>
        <View style={styles.sidebarActionCardLead}>
          <View style={styles.sidebarActionIconWrap}>{icon}</View>
          <Text style={[styles.sidebarActionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
            {title}
          </Text>
        </View>

        {accessory ? <View style={styles.sidebarActionAccessory}>{accessory}</View> : null}
      </View>
    </Pressable>
  );
}

function OverlayModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { isDark } = useThemeStore();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboard}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                style={[
                  styles.modalCloseButton,
                  { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" },
                ]}
              >
                <X size={18} color={isDark ? "#f8fafc" : "#0f172a"} />
              </Pressable>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function ChatAppScreen() {
  const navigation = useNavigation<ChatNavigation>();
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const socket = useSocketStore((state) => state.socket);
  const currentCall = useCallStore((state) => state.currentCall);
  const startOutgoingCall = useCallStore((state) => state.startOutgoingCall);
  const flatListRef = useRef<FlatList<Message>>(null);
  const isCreatingGroupRef = useRef(false);
  const pendingScrollToLatestRef = useRef(false);

  const [showRequests, setShowRequests] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showFriendList, setShowFriendList] = useState(false);
  const [showConversationProfile, setShowConversationProfile] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showConversationAssets, setShowConversationAssets] = useState(false);

  const [friendUsername, setFriendUsername] = useState("");
  const [friendRequestMessage, setFriendRequestMessage] = useState("");
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [newMessageQuery, setNewMessageQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [joinGroupMode, setJoinGroupMode] = useState<"link" | "camera">("link");
  const [joinGroupToken, setJoinGroupToken] = useState("");
  const [joinGroupLoading, setJoinGroupLoading] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Friend[]>([]);
  const [selectedGroupAvatar, setSelectedGroupAvatar] = useState<GroupAvatarFile | null>(null);
  const [groupManageQuery, setGroupManageQuery] = useState("");
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<Friend[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const joinScanLockRef = useRef(false);

  const {
    friends,
    receivedList,
    sentList,
    blockedUsers,
    setBlockedUsers,
    loading: friendStoreLoading,
    searchByUsername,
    addFriend,
    getAllFriendRequests,
    acceptRequest,
    declineRequest,
    getFriends,
  } = useFriendStore();

  const {
    activeConversationId,
    conversations,
    messages,
    convoLoading,
    messageLoading,
    loading: chatLoading,
    setActiveConversation,
    fetchConversations,
    fetchMessages,
    markAsSeen,
    createConversation,
    addGroupMembers,
    removeGroupMember,
    updateGroupMemberRole,
    transferGroupOwnership,
    leaveGroup,
    disbandGroup,
  } = useChatStore();

  const loadSocialData = useCallback(async () => {
    await Promise.all([getFriends(), getAllFriendRequests()]);
  }, [getAllFriendRequests, getFriends]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      loadSocialData().catch((error) => {
        console.error("Lỗi khi tải dữ liệu bạn bè:", error);
      });
    }, [fetchConversations, loadSocialData])
  );

  useEffect(() => {
    const checkAllStatuses = async () => {
      try {
        const statuses = await Promise.all(
          friends.map(async (friend) => {
            const isBlocked = await friendService.checkBlockStatus(friend._id);
            return isBlocked ? friend._id : null;
          })
        );

        setBlockedUsers(statuses.filter(Boolean) as string[]);
      } catch (error) {
        console.error("Loi khi kiem tra block status:", error);
      }
    };

    if (friends.length > 0) {
      checkAllStatuses();
    }
  }, [friends, setBlockedUsers]);

  const sortedConversations = useMemo(
    () =>
      uniqueById(conversations).sort(
        (left, right) => {
          const leftTimestamp = new Date(
            left.lastMessageAt || left.lastMessage?.createdAt || left.updatedAt || left.createdAt || 0
          ).getTime();
          const rightTimestamp = new Date(
            right.lastMessageAt || right.lastMessage?.createdAt || right.updatedAt || right.createdAt || 0
          ).getTime();

          return rightTimestamp - leftTimestamp;
        }
      ),
    [conversations]
  );

  const directConversations = useMemo(
    () => sortedConversations.filter((conversation) => conversation.type === "direct"),
    [sortedConversations]
  );

  const onlineUserIds = useMemo(() => new Set(onlineUsers), [onlineUsers]);

  const selectedConvo =
    sortedConversations.find((conversation) => conversation._id === activeConversationId) ?? null;
  const selectedConversationId = selectedConvo?._id ?? null;
  const typingUsers = useSocketStore((state) =>
    selectedConversationId
      ? state.typingByConversation[selectedConversationId] ?? EMPTY_TYPING_USERS
      : EMPTY_TYPING_USERS
  );

  const selectedConversationStatus = useMemo(
    () =>
      selectedConvo
        ? getConversationActivityLabel(selectedConvo, onlineUserIds, user?._id)
        : "",
    [onlineUserIds, selectedConvo, user?._id]
  );

  const selectedConversationFriend = useMemo<Friend | null>(() => {
    if (!selectedConvo || selectedConvo.type !== "direct" || !user?._id) {
      return null;
    }

    const participant = getDirectParticipant(selectedConvo, user._id);

    if (!participant) {
      return null;
    }

    return {
      _id: participant._id,
      displayName: participant.displayName,
      avatarUrl: participant.avatarUrl ?? undefined,
      username: "",
    };
  }, [selectedConvo, user?._id]);

  const isSelectedConversationFriendOnline = useMemo(
    () =>
      selectedConversationFriend
        ? onlineUserIds.has(selectedConversationFriend._id)
        : false,
    [onlineUserIds, selectedConversationFriend]
  );

  const messageItems = useMemo(
    () => (
      selectedConvo
        ? uniqueById(messages[selectedConvo._id]?.items ?? []).sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        )
        : []
    ),
    [messages, selectedConvo]
  );

  const pinnedMessages = useMemo(
    () => messageItems.filter((message) => message.isPinned),
    [messageItems]
  );

  const hasMoreMessages = selectedConvo ? messages[selectedConvo._id]?.hasMore ?? false : false;
  const latestMessageId = messageItems[messageItems.length - 1]?._id;

  const keyExtractor = useCallback((item: Message) => item._id, []);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => (
      <MessageItem
        message={item}
        previousMessage={index > 0 ? messageItems[index - 1] : undefined}
        selectedConvo={selectedConvo!}
      />
    ),
    [messageItems, selectedConvo]
  );

  const typingLabel = typingUsers.length === 0
    ? ""
    : typingUsers.length === 1
      ? `${typingUsers[0].displayName || "Ai đó"} đang soạn tin nhắn`
      : `${typingUsers[0].displayName || "Ai đó"} và ${typingUsers.length - 1} người khác đang soạn tin nhắn`;
  const typingLeadUser = typingUsers.length > 0 && selectedConvo
    ? selectedConvo.participants.find((participant) => participant._id === typingUsers[0].userId) ?? null
    : null;
  const typingDotAnimations = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.4),
    new Animated.Value(0.4),
  ]).current;

  useEffect(() => {
    if (!typingLabel || !typingLeadUser) {
      typingDotAnimations.forEach((value) => {
        value.stopAnimation();
        value.setValue(0.4);
      });
      return;
    }

    const loops = typingDotAnimations.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.4,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.delay(240),
        ])
      )
    );

    loops.forEach((animation) => animation.start());

    return () => {
      loops.forEach((animation) => animation.stop());
      typingDotAnimations.forEach((value) => {
        value.stopAnimation();
        value.setValue(0.4);
      });
    };
  }, [typingDotAnimations, typingLabel, typingLeadUser]);

  const filteredFriendsForMessage = useMemo(() => {
    const baseFriends = uniqueById(friends);

    if (!newMessageQuery.trim()) {
      return baseFriends;
    }

    return baseFriends.filter(
      (friend) =>
        matchesQuery(friend.displayName, newMessageQuery) ||
        matchesQuery(friend.username, newMessageQuery)
    );
  }, [friends, newMessageQuery]);

  const filteredFriendsForGroup = useMemo(() => {
    const selectedIds = new Set(selectedGroupMembers.map((friend) => friend._id));

    return uniqueById(friends).filter((friend) => {
      if (selectedIds.has(friend._id)) {
        return false;
      }

      if (!groupQuery.trim()) {
        return true;
      }

      return matchesQuery(friend.displayName, groupQuery) || matchesQuery(friend.username, groupQuery);
    });
  }, [friends, groupQuery, selectedGroupMembers]);

  const friendIds = useMemo(() => new Set(friends.map((friend) => friend._id)), [friends]);

  const pendingFriendInviteIds = useMemo(
    () => new Set(sentList.map((request) => request.to?._id).filter(Boolean)),
    [sentList]
  );

  const selectedGroupRole = useMemo(() => {
    if (!selectedConvo || selectedConvo.type !== "group" || !user?._id) {
      return null;
    }

    return selectedConvo.participants.find((participant) => participant._id === user._id) ?? null;
  }, [selectedConvo, user?._id]);

  const filteredFriendsForGroupManagement = useMemo(() => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return [] as Friend[];
    }

    const selectedIds = new Set(selectedMembersToAdd.map((friend) => friend._id));
    const participantIds = new Set(selectedConvo.participants.map((participant) => participant._id));

    return uniqueById(friends).filter((friend) => {
      if (participantIds.has(friend._id) || selectedIds.has(friend._id)) {
        return false;
      }

      if (!groupManageQuery.trim()) {
        return true;
      }

      return matchesQuery(friend.displayName, groupManageQuery) || matchesQuery(friend.username, groupManageQuery);
    });
  }, [friends, groupManageQuery, selectedConvo, selectedMembersToAdd]);

  const searchedUserRelationship = useMemo<FriendRelationship>(() => {
    if (!searchedUser || !user) {
      return "available";
    }

    if (searchedUser._id === user._id) {
      return "self";
    }

    if (friends.some((friend) => friend._id === searchedUser._id)) {
      return "friend";
    }

    if (sentList.some((request) => request.to?._id === searchedUser._id)) {
      return "sent";
    }

    if (receivedList.some((request) => request.from?._id === searchedUser._id)) {
      return "received";
    }

    return "available";
  }, [friends, receivedList, searchedUser, sentList, user]);

  const isConversationBlocked = useMemo(() => {
    if (!selectedConvo || selectedConvo.type !== "direct" || !user?._id) {
      return false;
    }

    const otherUser = getDirectParticipant(selectedConvo, user._id);
    return !!otherUser && blockedUsers.has(otherUser._id);
  }, [blockedUsers, selectedConvo, user?._id]);

  const armScrollToLatest = useCallback(() => {
    pendingScrollToLatestRef.current = true;
    setShowScrollToLatest(false);
  }, []);

  const openConversationById = useCallback(
    (conversationId: string) => {
      armScrollToLatest();
      setActiveConversation(conversationId);
    },
    [armScrollToLatest, setActiveConversation]
  );

  const handleStartAudioCall = useCallback(() => {
    if (!selectedConvo || selectedConvo.type !== "direct") {
      return;
    }

    void startOutgoingCall(selectedConvo, "audio");
  }, [selectedConvo, startOutgoingCall]);

  const handleStartVideoCall = useCallback(() => {
    if (!selectedConvo) {
      return;
    }

    void startOutgoingCall(selectedConvo, "video");
  }, [selectedConvo, startOutgoingCall]);

  const handleBack = useCallback(() => {
    pendingScrollToLatestRef.current = false;
    setActiveConversation(null);
  }, [setActiveConversation]);

  const resetAddFriendState = useCallback(() => {
    setFriendUsername("");
    setFriendRequestMessage("");
    setSearchedUser(null);
    setSearchStatus("idle");
  }, []);

  const resetNewMessageState = useCallback(() => {
    setNewMessageQuery("");
  }, []);

  const resetCreateGroupState = useCallback(() => {
    setGroupName("");
    setGroupQuery("");
    setSelectedGroupMembers([]);
    setSelectedGroupAvatar(null);
  }, []);

  const resetGroupManagementState = useCallback(() => {
    setGroupManageQuery("");
    setSelectedMembersToAdd([]);
  }, []);

  const openRequestsModal = useCallback(() => {
    setShowRequests(true);
    getAllFriendRequests().catch((error) => {
      console.error("Lỗi khi tải danh sách lời mời:", error);
    });
  }, [getAllFriendRequests]);

  const openAddFriendModal = useCallback(() => {
    setShowAddFriend(true);
    resetAddFriendState();
    loadSocialData().catch((error) => {
      console.error("Lỗi khi tải dữ liệu kết bạn:", error);
    });
  }, [loadSocialData, resetAddFriendState]);

  const openNewMessageModal = useCallback(() => {
    setShowNewMessage(true);
    resetNewMessageState();
    getFriends().catch((error) => {
      console.error("Lỗi khi tải danh sách bạn bè:", error);
    });
  }, [getFriends, resetNewMessageState]);

  const openCreateGroupModal = useCallback(() => {
    setShowCreateGroup(true);
    resetCreateGroupState();
    getFriends().catch((error) => {
      console.error("Lỗi khi tải danh sách bạn bè:", error);
    });
  }, [getFriends, resetCreateGroupState]);

  const openGroupManagementModal = useCallback(() => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return;
    }

    setShowGroupManagement(true);
    resetGroupManagementState();
    getFriends().catch((error) => {
      console.error("Lỗi khi tải danh sách bạn bè để quản lý nhóm:", error);
    });
  }, [getFriends, resetGroupManagementState, selectedConvo]);

  const openFriendListModal = useCallback(() => {
    setShowFriendList(true);
  }, []);

  const handleSearchUser = useCallback(async () => {
    const normalizedUsername = friendUsername.trim().toLowerCase();

    if (!normalizedUsername) {
      toast.info("Nhập tên đăng nhập để tìm kiếm.");
      return;
    }

    setSearchStatus("loading");
    const foundUser = await searchByUsername(normalizedUsername);
    setSearchedUser(foundUser);
    setSearchStatus(foundUser ? "found" : "not_found");
  }, [friendUsername, searchByUsername]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!searchedUser || searchedUserRelationship !== "available") {
      return;
    }

    const resultMessage = await addFriend(
      searchedUser._id,
      friendRequestMessage.trim() || undefined
    );

    if (isSuccessMessage(resultMessage)) {
      toast.success(resultMessage);
      await getAllFriendRequests();
      setShowAddFriend(false);
      resetAddFriendState();
      return;
    }

    toast.info(resultMessage);
  }, [
    addFriend,
    friendRequestMessage,
    getAllFriendRequests,
    resetAddFriendState,
    searchedUser,
    searchedUserRelationship,
  ]);

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      await acceptRequest(requestId);
      await loadSocialData();
      toast.success("Đã chấp nhận lời mời kết bạn.");
    },
    [acceptRequest, loadSocialData]
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      await declineRequest(requestId);
      await getAllFriendRequests();
      toast.info("Đã hủy lời mời kết bạn.");
    },
    [declineRequest, getAllFriendRequests]
  );

  const handleOpenConversation = useCallback(
    async (friend: Friend) => {
      if (blockedUsers.has(friend._id)) {
        toast.error("Bạn không thể nhắn tin với người này.");
        return;
      }

      const existingConversation = directConversations.find((conversation) =>
        conversation.participants.some((participant) => participant._id === friend._id)
      );

      setShowNewMessage(false);
      resetNewMessageState();

      if (existingConversation) {
        openConversationById(existingConversation._id);
        return;
      }

      armScrollToLatest();
      await createConversation("direct", "", [friend._id]);
    },
    [armScrollToLatest, blockedUsers, createConversation, directConversations, openConversationById, resetNewMessageState]
  );

  const handleFriendListSelect = useCallback(
    async (friend: Friend) => {
      setShowFriendList(false);
      await handleOpenConversation(friend);
    },
    [handleOpenConversation]
  );

  const handleToggleGroupMember = useCallback((friend: Friend) => {
    setSelectedGroupMembers((currentMembers) => {
      const exists = currentMembers.some((member) => member._id === friend._id);

      return exists
        ? currentMembers.filter((member) => member._id !== friend._id)
        : [...currentMembers, friend];
    });
  }, []);

  const handlePickGroupAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      toast.info("Cần cấp quyền thư viện ảnh để chọn avatar nhóm.");
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

    setSelectedGroupAvatar({
      uri: asset.uri,
      name: asset.fileName || `group-avatar-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (isCreatingGroupRef.current || isCreatingGroup || chatLoading) {
      return;
    }

    if (!groupName.trim()) {
      toast.warning("Nhập tên nhóm trước khi tạo.");
      return;
    }

    if (selectedGroupMembers.length === 0) {
      toast.warning("Chọn ít nhất một bạn để tạo nhóm.");
      return;
    }

    isCreatingGroupRef.current = true;
    setIsCreatingGroup(true);

    try {
      const createdConversation = await createConversation(
        "group",
        groupName.trim(),
        selectedGroupMembers.map((friend) => friend._id)
      );

      if (!createdConversation) {
        toast.error("Không thể tạo nhóm lúc này.");
        return;
      }

      if (selectedGroupAvatar) {
        try {
          const updated = await chatService.updateGroupAvatar(
            createdConversation._id,
            selectedGroupAvatar
          );

          useChatStore.getState().updateConversation({
            _id: createdConversation._id,
            group: {
              ...createdConversation.group,
              avatar: updated.conversation.group.avatar,
            },
          });
        } catch (error) {
          console.error("Lỗi upload avatar nhóm:", error);
          toast.info("Nhóm đã được tạo nhưng chưa cập nhật được avatar.");
        }
      }

      setShowCreateGroup(false);
      resetCreateGroupState();
    } finally {
      isCreatingGroupRef.current = false;
      setIsCreatingGroup(false);
    }
  }, [chatLoading, createConversation, groupName, isCreatingGroup, resetCreateGroupState, selectedGroupAvatar, selectedGroupMembers]);

  const resetJoinGroupState = useCallback(() => {
    setJoinGroupMode("link");
    setJoinGroupToken("");
    setJoinGroupLoading(false);
    joinScanLockRef.current = false;
  }, []);

  const handleCloseJoinGroupModal = useCallback(() => {
    setShowJoinGroup(false);
    resetJoinGroupState();
  }, [resetJoinGroupState]);

  const handleJoinGroup = useCallback(async (rawValue?: string) => {
    const normalizedToken = parseInviteToken(rawValue ?? joinGroupToken);

    if (!normalizedToken) {
      toast.error("Nhập link mời hoặc mã nhóm trước.");
      return;
    }

    try {
      setJoinGroupLoading(true);
      const data = await chatService.joinGroupByToken(normalizedToken);

      toast.success(data?.message || "Tham gia nhóm thành công.");
      await fetchConversations();
      setActiveConversation(data.conversation._id);
      handleCloseJoinGroupModal();
    } catch (error: any) {
      joinScanLockRef.current = false;
      toast.error(error?.response?.data?.message || "Không thể tham gia nhóm.");
    } finally {
      setJoinGroupLoading(false);
    }
  }, [fetchConversations, handleCloseJoinGroupModal, joinGroupToken, setActiveConversation]);

  const handleOpenJoinCamera = useCallback(async () => {
    setJoinGroupMode("camera");
    joinScanLockRef.current = false;

    if (cameraPermission?.granted) {
      return;
    }

    const permission = await requestCameraPermission();

    if (!permission.granted) {
      toast.error("Cần cấp quyền camera để quét mã QR.");
    }
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handleJoinGroupScan = useCallback((event: { data?: string }) => {
    if (joinScanLockRef.current || joinGroupLoading) {
      return;
    }

    const scannedToken = parseInviteToken(event.data || "");

    if (!scannedToken) {
      toast.error("Mã QR không hợp lệ.");
      return;
    }

    joinScanLockRef.current = true;
    setJoinGroupToken(scannedToken);
    void handleJoinGroup(scannedToken);
  }, [handleJoinGroup, joinGroupLoading]);

  const handleToggleMemberToAdd = useCallback((friend: Friend) => {
    setSelectedMembersToAdd((currentMembers) => {
      const exists = currentMembers.some((member) => member._id === friend._id);

      return exists
        ? currentMembers.filter((member) => member._id !== friend._id)
        : [...currentMembers, friend];
    });
  }, []);

  const handleAddMembersToCurrentGroup = useCallback(async () => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return;
    }

    if (selectedMembersToAdd.length === 0) {
      toast.info("Chọn ít nhất một bạn để thêm vào nhóm.");
      return;
    }

    try {
      await addGroupMembers(selectedConvo._id, selectedMembersToAdd.map((friend) => friend._id));
      resetGroupManagementState();
      toast.success("Đã thêm thành viên vào nhóm.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Thêm thành viên thất bại.");
    }
  }, [addGroupMembers, resetGroupManagementState, selectedConvo, selectedMembersToAdd]);

  const handleSendFriendRequestToGroupMember = useCallback(async (participant: Conversation["participants"][number]) => {
    const resultMessage = await addFriend(participant._id);

    if (!resultMessage) {
      toast.error("Không thể gửi lời mời kết bạn.");
      return;
    }

    if (/lỗi|that bai|thất bại/i.test(resultMessage)) {
      toast.error(resultMessage);
      return;
    }

    toast.success(resultMessage);
    await getAllFriendRequests();
  }, [addFriend, getAllFriendRequests]);

  const canRemoveGroupParticipant = useCallback((participant: Conversation["participants"][number]) => {
    if (!selectedGroupRole || participant._id === selectedGroupRole._id) {
      return false;
    }

    if (selectedGroupRole.role === "owner") {
      return true;
    }

    if (selectedGroupRole.role === "deputy") {
      return participant.role !== "owner";
    }

    return false;
  }, [selectedGroupRole]);

  const confirmGroupAction = useCallback((
    title: string,
    message: string,
    action: () => Promise<void>,
    successMessage: string,
    onAfterSuccess?: () => void
  ) => {
    Alert.alert(title, message, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        style: "destructive",
        onPress: () => {
          void action()
            .then(() => {
              toast.success(successMessage);
              onAfterSuccess?.();
            })
            .catch((error: any) => {
              toast.error(error?.response?.data?.message || "Thao tác thất bại.");
            });
        },
      },
    ]);
  }, []);

  const handleToggleDeputyRole = useCallback((participant: Conversation["participants"][number]) => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return;
    }

    const nextRole = participant.role === "deputy" ? "member" : "deputy";

    confirmGroupAction(
      nextRole === "deputy" ? "Bổ nhiệm phó nhóm" : "Thu hồi quyền phó nhóm",
      nextRole === "deputy"
        ? `Bổ nhiệm ${participant.displayName} làm phó nhóm?`
        : `Thu hồi quyền phó nhóm của ${participant.displayName}?`,
      () => updateGroupMemberRole(selectedConvo._id, participant._id, nextRole),
      nextRole === "deputy" ? "Đã bổ nhiệm phó nhóm." : "Đã thu hồi quyền phó nhóm."
    );
  }, [confirmGroupAction, selectedConvo, updateGroupMemberRole]);

  const handleTransferOwner = useCallback((participant: Conversation["participants"][number]) => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return;
    }

    confirmGroupAction(
      "Chuyển quyền chủ nhóm",
      `Chuyển quyền chủ nhóm cho ${participant.displayName}?`,
      () => transferGroupOwnership(selectedConvo._id, participant._id),
      "Đã chuyển quyền chủ nhóm."
    );
  }, [confirmGroupAction, selectedConvo, transferGroupOwnership]);

  const handleRemoveGroupParticipant = useCallback((participant: Conversation["participants"][number]) => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return;
    }

    confirmGroupAction(
      "Xóa thành viên",
      `Xóa ${participant.displayName} khỏi nhóm?`,
      () => removeGroupMember(selectedConvo._id, participant._id),
      "Đã xóa thành viên khỏi nhóm."
    );
  }, [confirmGroupAction, removeGroupMember, selectedConvo]);

  const handleLeaveCurrentGroup = useCallback(() => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return;
    }

    confirmGroupAction(
      "Rời nhóm",
      "Bạn có chắc chắn muốn rời khỏi nhóm này?",
      () => leaveGroup(selectedConvo._id),
      "Đã rời nhóm.",
      () => {
        setShowGroupManagement(false);
        resetGroupManagementState();
      }
    );
  }, [confirmGroupAction, leaveGroup, resetGroupManagementState, selectedConvo]);

  const handleDisbandCurrentGroup = useCallback(() => {
    if (!selectedConvo || selectedConvo.type !== "group") {
      return;
    }

    confirmGroupAction(
      "Giải tán nhóm",
      "Giải tán nhóm chat này? Hành động này không thể hoàn tác.",
      () => disbandGroup(selectedConvo._id),
      "Đã giải tán nhóm chat.",
      () => {
        setShowGroupManagement(false);
        resetGroupManagementState();
      }
    );
  }, [confirmGroupAction, disbandGroup, resetGroupManagementState, selectedConvo]);

  useEffect(() => {
    if (!selectedConversationId || messages[selectedConversationId]) {
      return;
    }

    fetchMessages(selectedConversationId).catch((error) => {
      console.error("Lỗi khi tải tin nhắn:", error);
    });
  }, [fetchMessages, messages, selectedConversationId]);
  useEffect(() => {
    if (!socket) return;

    const handler = (data: any) => {
      const message = data?.message ?? data;

      if (!message?._id || !message?.conversationId) return;

      useChatStore.getState().updateMessage(message);
    };

    socket.on("update-message", handler);

    return () => {
      socket.off("update-message", handler);
    };
  }, [socket]);
  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    markAsSeen().catch((error) => {
      console.error("Lỗi khi đánh dấu đã xem:", error);
    });
  }, [markAsSeen, selectedConversationId]);

  useEffect(() => {
    setShowConversationProfile(false);
    setShowGroupManagement(false);
    setShowConversationAssets(false);
    resetGroupManagementState();
  }, [resetGroupManagementState, selectedConversationId]);

  useEffect(() => {
    if (
      !showConversationAssets ||
      !selectedConversationId ||
      messageLoading ||
      !hasMoreMessages
    ) {
      return;
    }

    fetchMessages(selectedConversationId).catch((error) => {
      console.error("Lỗi khi tải thêm tệp đính kèm:", error);
    });
  }, [
    fetchMessages,
    hasMoreMessages,
    messageLoading,
    selectedConversationId,
    showConversationAssets,
  ]);

  useEffect(() => {
    if (!selectedConvo || !latestMessageId) {
      return;
    }

    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    setShowScrollToLatest(false);

    return () => clearTimeout(timeout);
  }, [latestMessageId, selectedConvo]);

  useLayoutEffect(() => {
    if (!selectedConversationId) {
      pendingScrollToLatestRef.current = false;
      return;
    }

    pendingScrollToLatestRef.current = true;
    setShowScrollToLatest(false);
  }, [selectedConversationId]);

  const handleScrollToLatest = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollToLatest(false);
  }, []);

  const flushPendingScrollToLatest = useCallback(() => {
    if (!pendingScrollToLatestRef.current || !selectedConversationId) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        pendingScrollToLatestRef.current = false;
        setShowScrollToLatest(false);
      });
    });
  }, [selectedConversationId]);

  useEffect(() => {
    if (!pendingScrollToLatestRef.current || !selectedConversationId || messageItems.length === 0) {
      return;
    }

    flushPendingScrollToLatest();
  }, [flushPendingScrollToLatest, messageItems.length, selectedConversationId]);

  const handleMessageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;

      setShowScrollToLatest(distanceFromBottom > SCROLL_TO_LATEST_DISTANCE);

      if (
        contentOffset.y <= TOP_LOAD_THRESHOLD &&
        hasMoreMessages &&
        !messageLoading &&
        activeConversationId
      ) {
        fetchMessages(activeConversationId);
      }
    },
    [activeConversationId, fetchMessages, hasMoreMessages, messageLoading]
  );

  const handleOpenConversationProfile = useCallback(() => {
    if (selectedConversationFriend) {
      setShowConversationProfile(true);
    }
  }, [selectedConversationFriend]);

  const handleOpenGroupManagement = useCallback(() => {
    if (selectedConvo?.type === "group") {
      openGroupManagementModal();
    }
  }, [openGroupManagementModal, selectedConvo]);

  const handleOpenConversationAssets = useCallback(() => {
    if (selectedConvo) {
      setShowConversationAssets(true);
    }
  }, [selectedConvo]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: selectedConvo ? getConversationTitle(selectedConvo, user?._id) : "Đoạn chat",
      headerTitleAlign: "left",
      headerTitleContainerStyle: {
        left: 56,
        right: selectedConvo?.type === "direct" ? 134 : 96,
      },
      headerLeftContainerStyle: {
        paddingLeft: 12,
      },
      headerRightContainerStyle: {
        paddingRight: 12,
      },
      headerTitle: selectedConvo
        ? () =>
          selectedConversationFriend ? (
            <Pressable
              onPress={handleOpenConversationProfile}
              style={({ pressed }) => [
                styles.headerConversationButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.headerAvatarWrap, { borderColor: isDark ? "rgba(148, 163, 184, 0.22)" : "#dbe4f3" }]}>
                <UserAvatar
                  name={selectedConversationFriend.displayName}
                  avatarUrl={selectedConversationFriend.avatarUrl}
                  size={40}
                  isOnline={isSelectedConversationFriendOnline}
                  showPresence
                />
              </View>

              <View style={styles.headerProfileTextWrap}>
                <Text
                  numberOfLines={1}
                  style={[styles.headerTitleText, { color: isDark ? "#f8fafc" : "#0f172a" }]}
                >
                  {getConversationTitle(selectedConvo, user?._id)}
                </Text>
                {!!selectedConversationStatus && (
                  <Text
                    numberOfLines={1}
                    style={[styles.headerSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}
                  >
                    {selectedConversationStatus}
                  </Text>
                )}
              </View>
            </Pressable>
          ) : selectedConvo.type === "group" ? (
            <Pressable
              onPress={handleOpenGroupManagement}
              style={({ pressed }) => [
                styles.headerConversationButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.headerAvatarWrap, { borderColor: isDark ? "rgba(148, 163, 184, 0.22)" : "#dbe4f3" }]}>
                <UserAvatar
                  name={selectedConvo.group?.name || "Nhóm chat"}
                  avatarUrl={selectedConvo.group?.avatar}
                  size={40}
                />
              </View>

              <View style={styles.headerProfileTextWrap}>
                <Text
                  numberOfLines={1}
                  style={[styles.headerTitleText, { color: isDark ? "#f8fafc" : "#0f172a" }]}
                >
                  {getConversationTitle(selectedConvo, user?._id)}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.headerTitleWrap}>
              <Text
                numberOfLines={1}
                style={[styles.headerTitleText, { color: isDark ? "#f8fafc" : "#0f172a" }]}
              >
                {getConversationTitle(selectedConvo, user?._id)}
              </Text>
              {!!selectedConversationStatus && (
                <Text
                  numberOfLines={1}
                  style={[styles.headerSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}
                >
                  {selectedConversationStatus}
                </Text>
              )}
            </View>
          )
        : undefined,
      headerLeft: selectedConvo
        ? () => (
          <Pressable
            onPress={handleBack}
            style={[
              styles.headerBackButton,
              { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" },
            ]}
          >
            <ChevronLeft size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
          </Pressable>
        )
        : undefined,
      headerRight: selectedConvo
        ? () => (
          <View style={styles.headerActionGroup}>
            {selectedConvo.type === "direct" ? (
              <Pressable
                onPress={handleStartAudioCall}
                disabled={Boolean(currentCall) || isConversationBlocked}
                style={[
                  styles.headerIconButton,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#eef2ff",
                    opacity: Boolean(currentCall) || isConversationBlocked ? 0.45 : 1,
                  },
                ]}
              >
                <Phone size={18} color={isDark ? "#cbd5e1" : "#4f46e5"} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleStartVideoCall}
              disabled={Boolean(currentCall) || isConversationBlocked}
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: isDark ? "#1f2937" : "#eef2ff",
                  opacity: Boolean(currentCall) || isConversationBlocked ? 0.45 : 1,
                },
              ]}
            >
              <Video size={18} color={isDark ? "#cbd5e1" : "#4f46e5"} />
            </Pressable>

            <Pressable
              onPress={handleOpenConversationAssets}
              style={[
                styles.headerIconButton,
                { backgroundColor: isDark ? "#1f2937" : "#eef2ff" },
              ]}
            >
              <Menu size={18} color={isDark ? "#cbd5e1" : "#4f46e5"} />
            </Pressable>
          </View>
        )
        : () => (
          <Pressable
            onPress={openRequestsModal}
            style={[
              styles.headerIconButton,
              { backgroundColor: isDark ? "#1f2937" : "#eef2ff" },
            ]}
          >
            <Bell size={18} color={isDark ? "#cbd5e1" : "#4f46e5"} />
            {receivedList.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {receivedList.length > 9 ? "9+" : receivedList.length}
                </Text>
              </View>
            )}
          </Pressable>
        ),
    });
  }, [
    currentCall,
    handleStartAudioCall,
    handleStartVideoCall,
    isConversationBlocked,
    handleBack,
    handleOpenGroupManagement,
    handleOpenConversationAssets,
    handleOpenConversationProfile,
    isDark,
    navigation,
    openRequestsModal,
    receivedList.length,
    selectedConvo,
    selectedConversationFriend,
    isSelectedConversationFriendOnline,
    selectedConversationStatus,
    user?._id,
  ]);

  if (selectedConvo) {
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}
        edges={["left", "right"]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        >
          <View style={styles.pinnedContainer}>
            {pinnedMessages.length > 0 && (
              <PinnedSection
                pinnedMessages={pinnedMessages}
                onJump={(id) => {
                  const index = messageItems.findIndex((message) => message._id === id);

                  if (index !== -1) {
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                  }
                }}
              />
            )}
          </View>

          <FlatList
            ref={flatListRef}
            key={selectedConversationId ?? "chat-empty"}
            data={messageItems}
            keyExtractor={keyExtractor}
            initialNumToRender={18}
            maxToRenderPerBatch={12}
            windowSize={8}
            removeClippedSubviews={Platform.OS === "android"}
            contentContainerStyle={[
              styles.messageListContent,
              { paddingTop: pinnedMessages.length > 0 ? 120 : 14 },
            ]}
            onLayout={flushPendingScrollToLatest}
            onContentSizeChange={flushPendingScrollToLatest}
            onScroll={handleMessageScroll}
            scrollEventThrottle={16}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              messageLoading && hasMoreMessages ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#8b5cf6" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={[styles.emptyMessageText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  Chưa có tin nhắn nào trong cuộc trò chuyện này.
                </Text>
              </View>
            }
            renderItem={renderMessageItem}
          />

          {isConversationBlocked ? (
            <Text style={styles.blockedNotice}>Bạn không thể trả lời cuộc trò chuyện này.</Text>
          ) : null}

          {typingLabel && typingLeadUser ? (
            <View
              style={[
                styles.typingBubble,
                {
                  backgroundColor: isDark ? "rgba(17, 24, 39, 0.96)" : "rgba(255, 255, 255, 0.96)",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                },
              ]}
            >
              <UserAvatar
                name={typingLeadUser.displayName}
                avatarUrl={typingLeadUser.avatarUrl ?? undefined}
                size={28}
              />

              <View style={styles.typingBubbleContent}>
                <Text numberOfLines={1} style={[styles.typingBubbleLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  {typingLabel}
                </Text>
                <View style={styles.typingBubbleDots}>
                  {typingDotAnimations.map((opacity, index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.typingBubbleDot,
                        {
                          backgroundColor: isDark ? "#c4b5fd" : "#8b5cf6",
                          opacity,
                          transform: [
                            {
                              translateY: opacity.interpolate({
                                inputRange: [0.4, 1],
                                outputRange: [1.5, -1.5],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {showScrollToLatest ? (
            <Pressable
              onPress={handleScrollToLatest}
              style={[
                styles.scrollToLatestButton,
                { backgroundColor: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.96)" },
              ]}
            >
              <ChevronDown size={18} color={isDark ? "#f8fafc" : "#0f172a"} />
              <Text style={[styles.scrollToLatestText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Tin mới nhất</Text>
            </Pressable>
          ) : null}

          <MessageInput
            selectedConvo={selectedConvo}
            disabled={isConversationBlocked}
          />
        </KeyboardAvoidingView>

        <ProfileModal
          visible={showConversationProfile}
          friend={selectedConversationFriend}
          onClose={() => setShowConversationProfile(false)}
        />

        <OverlayModal
          visible={showGroupManagement && selectedConvo?.type === "group"}
          title={selectedConvo?.group?.name || "Quản lý nhóm"}
          onClose={() => {
            setShowGroupManagement(false);
            resetGroupManagementState();
          }}
        >
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.requestCard,
                {
                  backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                  borderColor: isDark ? "#1f2937" : "#e2e8f0",
                },
              ]}
            >
              <Text style={[styles.modalSectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Thành viên nhóm</Text>
              <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>Vai trò của bạn: {selectedGroupRole ? GROUP_ROLE_LABELS[selectedGroupRole.role] : "Không xác định"}</Text>

              {selectedConvo?.type === "group"
                ? selectedConvo.participants.map((participant) => (
                  <View
                    key={participant._id}
                    style={[
                      styles.friendRow,
                      {
                        backgroundColor: isDark ? "#111827" : "#ffffff",
                        borderColor: isDark ? "#1f2937" : "#e2e8f0",
                      },
                    ]}
                  >
                    <View style={styles.requestInfo}>
                      <UserAvatar name={participant.displayName} avatarUrl={participant.avatarUrl} size={42} />
                      <View style={styles.requestTextBlock}>
                        <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                          {participant.displayName}{participant._id === user?._id ? " (Bạn)" : ""}
                        </Text>
                        <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                          {GROUP_ROLE_LABELS[participant.role]}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.groupActionColumn}>
                      {participant._id === user?._id ? (
                        <View style={[styles.relationshipPill, { backgroundColor: isDark ? "#312e81" : "#ede9fe" }]}>
                          <Text style={[styles.relationshipPillText, { color: isDark ? "#ddd6fe" : "#6d28d9" }]}>Bạn</Text>
                        </View>
                      ) : friendIds.has(participant._id) ? (
                        <View style={[styles.relationshipPill, { backgroundColor: isDark ? "#1d4ed8" : "#dbeafe" }]}>
                          <Text style={[styles.relationshipPillText, { color: isDark ? "#bfdbfe" : "#1d4ed8" }]}>Bạn bè</Text>
                        </View>
                      ) : pendingFriendInviteIds.has(participant._id) ? (
                        <View style={[styles.relationshipPill, { backgroundColor: isDark ? "#334155" : "#e2e8f0" }]}>
                          <Text style={[styles.relationshipPillText, { color: isDark ? "#e2e8f0" : "#475569" }]}>Đã gửi lời mời</Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => void handleSendFriendRequestToGroupMember(participant)}
                          disabled={friendStoreLoading}
                          style={[
                            styles.secondaryButton,
                            styles.groupActionButton,
                            {
                              backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                              borderColor: isDark ? "#334155" : "#d7def0",
                              opacity: friendStoreLoading ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.secondaryButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Gửi lời mời kết bạn</Text>
                        </Pressable>
                      )}

                      {selectedGroupRole?.role === "owner" && participant._id !== user?._id && participant.role !== "owner" ? (
                        <Pressable
                          onPress={() => handleToggleDeputyRole(participant)}
                          style={[
                            styles.secondaryButton,
                            styles.groupActionButton,
                            {
                              backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                              borderColor: isDark ? "#334155" : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text style={[styles.secondaryButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                            {participant.role === "deputy" ? "Thu hồi phó" : "Bổ nhiệm phó"}
                          </Text>
                        </Pressable>
                      ) : null}

                      {selectedGroupRole?.role === "owner" && participant._id !== user?._id ? (
                        <Pressable onPress={() => handleTransferOwner(participant)} style={[styles.primaryButton, styles.groupActionButton]}>
                          <Text style={styles.primaryButtonText}>Chuyển chủ nhóm</Text>
                        </Pressable>
                      ) : null}

                      {canRemoveGroupParticipant(participant) ? (
                        <Pressable
                          onPress={() => handleRemoveGroupParticipant(participant)}
                          style={[
                            styles.secondaryButton,
                            styles.groupActionButton,
                            {
                              backgroundColor: isDark ? "#3f1d24" : "#fff1f2",
                              borderColor: isDark ? "#7f1d1d" : "#fecdd3",
                            },
                          ]}
                        >
                          <Text style={[styles.secondaryButtonText, { color: isDark ? "#fecdd3" : "#be123c" }]}>Xóa khỏi nhóm</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
                : null}
            </View>

            <View
              style={[
                styles.requestCard,
                {
                  backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                  borderColor: isDark ? "#1f2937" : "#e2e8f0",
                },
              ]}
            >
              <Text style={[styles.modalSectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Thêm thành viên</Text>
              <TextInput
                value={groupManageQuery}
                onChangeText={setGroupManageQuery}
                placeholder="Tìm bạn để thêm vào nhóm"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                style={[
                  styles.textInput,
                  {
                    color: isDark ? "#f8fafc" : "#0f172a",
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                  },
                ]}
              />

              {selectedMembersToAdd.length > 0 ? (
                <View style={styles.selectedMembersWrap}>
                  {selectedMembersToAdd.map((friend) => (
                    <Pressable
                      key={friend._id}
                      onPress={() => handleToggleMemberToAdd(friend)}
                      style={[
                        styles.selectedMemberChip,
                        { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectedMemberText,
                          { color: isDark ? "#ddd6fe" : "#6d28d9" },
                        ]}
                      >
                        {friend.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {filteredFriendsForGroupManagement.length === 0 ? (
                  <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>Không còn bạn phù hợp để thêm vào nhóm.</Text>
                ) : (
                  filteredFriendsForGroupManagement.map((friend) => (
                    <Pressable
                      key={friend._id}
                      onPress={() => handleToggleMemberToAdd(friend)}
                      style={({ pressed }) => [
                        styles.friendRow,
                        {
                          backgroundColor: isDark ? "#111827" : "#ffffff",
                          borderColor: isDark ? "#1f2937" : "#e2e8f0",
                          opacity: pressed ? 0.92 : 1,
                        },
                      ]}
                    >
                      <View style={styles.requestInfo}>
                        <UserAvatar name={friend.displayName} avatarUrl={friend.avatarUrl} size={42} />
                        <View style={styles.requestTextBlock}>
                          <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>{friend.displayName}</Text>
                          <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>@{friend.username}</Text>
                        </View>
                      </View>

                      <Text style={[styles.linkText, { color: isDark ? "#c084fc" : "#7c3aed" }]}>Thêm</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>

              <Pressable onPress={handleAddMembersToCurrentGroup} disabled={chatLoading || selectedMembersToAdd.length === 0} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{chatLoading ? "Đang xử lý..." : "Thêm thành viên"}</Text>
              </Pressable>
            </View>

            <View style={styles.requestActionsRow}>
              <Pressable
                onPress={handleLeaveCurrentGroup}
                style={[
                  styles.secondaryButton,
                  styles.groupFooterButton,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                  },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Rời nhóm</Text>
              </Pressable>

              {selectedGroupRole?.role === "owner" ? (
                <Pressable onPress={handleDisbandCurrentGroup} style={[styles.primaryButton, styles.groupFooterButton, { backgroundColor: "#e11d48" }]}>
                  <Text style={styles.primaryButtonText}>Giải tán nhóm</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </OverlayModal>

        <ConversationAssetsModal
          visible={showConversationAssets}
          messages={messageItems}
          conversation={selectedConvo}
          onClose={() => setShowConversationAssets(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}
      edges={["left", "right"]}
    >
      {convoLoading ? (
        <View style={styles.loaderState}>
          <ActivityIndicator size="small" color="#8b5cf6" />
          <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
            Đang tải danh sách đoạn chat...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.conversationList} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <SidebarActionCard
              title="Danh Sách Bạn Bè"
              onPress={openFriendListModal}
              icon={<MessageCircle size={18} color="#ffffff" />}
              accessory={
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    openAddFriendModal();
                  }}
                  style={({ pressed }) => [
                    styles.sidebarActionAccessoryButton,
                    {
                      backgroundColor: isDark ? "rgba(15, 23, 42, 0.82)" : "#f8fafc",
                      borderColor: isDark ? "rgba(148, 163, 184, 0.18)" : "#d7def0",
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <UserPlus size={16} color={isDark ? "#e2e8f0" : "#4f46e5"} />
                </Pressable>
              }
            />

            <SidebarActionCard
              title="Tạo Nhóm Mới"
              onPress={openCreateGroupModal}
              icon={<Users size={18} color="#ffffff" />}
              accessory={
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    setShowJoinGroup(true);
                    resetJoinGroupState();
                  }}
                  style={({ pressed }) => [
                    styles.sidebarActionAccessoryButton,
                    {
                      backgroundColor: isDark ? "rgba(15, 23, 42, 0.82)" : "#f8fafc",
                      borderColor: isDark ? "rgba(148, 163, 184, 0.18)" : "#d7def0",
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <UserPlus size={16} color={isDark ? "#e2e8f0" : "#4f46e5"} />
                </Pressable>
              }
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderCompact}>
              <View style={styles.sectionTitleBlock}>
                <Text style={[styles.sectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Cuộc trò chuyện
                </Text>

              </View>

              <Pressable
                onPress={openNewMessageModal}
                style={({ pressed }) => [
                  styles.inlineActionButton,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                    borderColor: isDark ? "#334155" : "#d7def0",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Text style={[styles.inlineActionButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Tin nhắn mới</Text>
              </Pressable>
            </View>

            {sortedConversations.length > 0 ? (
              sortedConversations.map((conversation) => {
                const otherUser = conversation.type === "direct"
                  ? getDirectParticipant(conversation, user?._id)
                  : null;

                return (
                  <ChatCard
                    key={conversation._id}
                    conversation={conversation}
                    onPress={() => openConversationById(conversation._id)}
                    currentUserId={user?._id}
                    isOnline={!!otherUser && onlineUserIds.has(otherUser._id)}
                  />
                );
              })
            ) : (
              <View
                style={[
                  styles.emptySection,
                  {
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                    borderColor: isDark ? "#1f2937" : "#e2e8f0",
                  },
                ]}
              >
                <Text style={[styles.emptySectionText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  Chưa có cuộc trò chuyện nào.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <OverlayModal visible={showRequests} title="Lời mời kết bạn" onClose={() => setShowRequests(false)}>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.modalSectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Đã nhận</Text>

          {receivedList.length === 0 ? (
            <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              Bạn chưa có lời mời kết bạn nào.
            </Text>
          ) : (
            receivedList.map((request) => {
              const info = getRequestUser(request, "received");

              if (!info) {
                return null;
              }

              return (
                <View
                  key={request._id}
                  style={[
                    styles.requestCard,
                    {
                      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                      borderColor: isDark ? "#1f2937" : "#e2e8f0",
                    },
                  ]}
                >
                  <View style={styles.requestInfo}>
                    <UserAvatar name={info.displayName} avatarUrl={info.avatarUrl} size={42} />
                    <View style={styles.requestTextBlock}>
                      <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                        {info.displayName}
                      </Text>
                      <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>@{info.username}</Text>
                    </View>
                  </View>

                  <View style={styles.requestActions}>
                    <Pressable
                      onPress={() => handleDeclineRequest(request._id)}
                      disabled={friendStoreLoading}
                      style={[
                        styles.secondaryButton,
                        {
                          backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                        },
                      ]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Hủy</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleAcceptRequest(request._id)}
                      disabled={friendStoreLoading}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>Chấp nhận</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Text
            style={[
              styles.modalSectionTitle,
              styles.modalSecondarySection,
              { color: isDark ? "#f8fafc" : "#0f172a" },
            ]}
          >
            Đã gửi
          </Text>

          {sentList.length === 0 ? (
            <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              Bạn chưa gửi lời mời kết bạn nào.
            </Text>
          ) : (
            sentList.map((request) => {
              const info = getRequestUser(request, "sent");

              if (!info) {
                return null;
              }

              return (
                <View
                  key={request._id}
                  style={[
                    styles.requestCard,
                    {
                      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                      borderColor: isDark ? "#1f2937" : "#e2e8f0",
                    },
                  ]}
                >
                  <View style={styles.requestInfo}>
                    <UserAvatar name={info.displayName} avatarUrl={info.avatarUrl} size={42} />
                    <View style={styles.requestTextBlock}>
                      <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                        {info.displayName}
                      </Text>
                      <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>@{info.username}</Text>
                    </View>
                  </View>

                  <Text style={[styles.pendingLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}>Đang chờ phản hồi</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </OverlayModal>

      <OverlayModal
        visible={showAddFriend}
        title="Kết bạn"
        onClose={() => {
          setShowAddFriend(false);
          resetAddFriendState();
        }}
      >
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <TextInput
            value={friendUsername}
            onChangeText={(value) => {
              setFriendUsername(value);
              setSearchStatus("idle");
              setSearchedUser(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Nhập tên đăng nhập cần tìm"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textInput,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          <Pressable
            onPress={handleSearchUser}
            disabled={searchStatus === "loading" || friendStoreLoading}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{searchStatus === "loading" ? "Đang tìm..." : "Tìm người dùng"}</Text>
          </Pressable>

          {searchStatus === "not_found" && (
            <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              Không tìm thấy người dùng phù hợp.
            </Text>
          )}

          {searchedUser && (
            <View
              style={[
                styles.requestCard,
                {
                  backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                  borderColor: isDark ? "#1f2937" : "#e2e8f0",
                },
              ]}
            >
              <View style={styles.requestInfo}>
                <UserAvatar name={searchedUser.displayName} avatarUrl={searchedUser.avatarUrl} size={46} />
                <View style={styles.requestTextBlock}>
                  <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                    {searchedUser.displayName}
                  </Text>
                  <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>@{searchedUser.username}</Text>
                </View>
              </View>

              {searchedUserRelationship === "available" ? (
                <>
                  <TextInput
                    value={friendRequestMessage}
                    onChangeText={setFriendRequestMessage}
                    placeholder="Lời nhắn (không bắt buộc)"
                    placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                    multiline
                    style={[
                      styles.textArea,
                      {
                        color: isDark ? "#f8fafc" : "#0f172a",
                        backgroundColor: isDark ? "#111827" : "#ffffff",
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                      },
                    ]}
                  />

                  <Pressable
                    onPress={handleSendFriendRequest}
                    disabled={friendStoreLoading}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>
                      {friendStoreLoading ? "Đang gửi..." : "Gửi lời mời kết bạn"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.statusText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  {searchedUserRelationship === "self" && "Bạn không thể gửi lời mời cho chính mình."}
                  {searchedUserRelationship === "friend" && "Người này đã là bạn của bạn."}
                  {searchedUserRelationship === "sent" && "Bạn đã gửi lời mời cho người này rồi."}
                  {searchedUserRelationship === "received" &&
                    "Người này đã gửi lời mời cho bạn. Hãy mở cửa sổ lời mời để chấp nhận."}
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </OverlayModal>

      <OverlayModal
        visible={showNewMessage}
        title="Tin nhắn mới"
        onClose={() => {
          setShowNewMessage(false);
          resetNewMessageState();
        }}
      >
        <View style={styles.modalContent}>
          <TextInput
            value={newMessageQuery}
            onChangeText={setNewMessageQuery}
            placeholder="Tìm theo tên hoặc tên đăng nhập"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textInput,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
            {filteredFriendsForMessage.length === 0 ? (
              <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                {friends.length === 0
                  ? "Bạn chưa có bạn bè nào để bắt đầu trò chuyện."
                  : "Không tìm thấy bạn bè phù hợp."}
              </Text>
            ) : (
              filteredFriendsForMessage.map((friend) => (
                <Pressable
                  key={friend._id}
                  onPress={() => handleOpenConversation(friend)}
                  style={({ pressed }) => [
                    styles.friendRow,
                    {
                      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                      borderColor: isDark ? "#1f2937" : "#e2e8f0",
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <View style={styles.requestInfo}>
                    <UserAvatar name={friend.displayName} avatarUrl={friend.avatarUrl} size={42} />
                    <View style={styles.requestTextBlock}>
                      <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                        {friend.displayName}
                      </Text>
                      <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>@{friend.username}</Text>
                    </View>
                  </View>

                  <Text style={[styles.linkText, { color: isDark ? "#c084fc" : "#7c3aed" }]}>Mở chat</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </OverlayModal>

      <OverlayModal
        visible={showJoinGroup}
        title="Tham gia nhóm"
        onClose={handleCloseJoinGroupModal}
      >
        <View style={styles.modalContent}>
          <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
            Nhập link mời hoặc quét mã QR để tham gia nhóm chat.
          </Text>

          <View
            style={[
              styles.joinGroupTabRow,
              { backgroundColor: isDark ? "#0f172a" : "#f8fafc", borderColor: isDark ? "#1f2937" : "#e2e8f0" },
            ]}
          >
            <Pressable
              onPress={() => {
                joinScanLockRef.current = false;
                setJoinGroupMode("link");
              }}
              style={[
                styles.joinGroupTabButton,
                joinGroupMode === "link" && { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
              ]}
            >
              <Text
                style={{
                  color: joinGroupMode === "link"
                    ? isDark ? "#ddd6fe" : "#6d28d9"
                    : isDark ? "#94a3b8" : "#64748b",
                  fontWeight: "700",
                }}
              >
                Link/Mã
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void handleOpenJoinCamera();
              }}
              style={[
                styles.joinGroupTabButton,
                joinGroupMode === "camera" && { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
              ]}
            >
              <Text
                style={{
                  color: joinGroupMode === "camera"
                    ? isDark ? "#ddd6fe" : "#6d28d9"
                    : isDark ? "#94a3b8" : "#64748b",
                  fontWeight: "700",
                }}
              >
                Camera
              </Text>
            </Pressable>
          </View>

          {joinGroupMode === "link" ? (
            <>
              <TextInput
                value={joinGroupToken}
                onChangeText={setJoinGroupToken}
                placeholder="Dán link mời hoặc nhập mã token"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.textInput,
                  {
                    color: isDark ? "#f8fafc" : "#0f172a",
                    backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                    borderColor: isDark ? "#1f2937" : "#e2e8f0",
                  },
                ]}
              />

              <Pressable
                onPress={() => {
                  void handleJoinGroup();
                }}
                disabled={joinGroupLoading || !joinGroupToken.trim()}
                style={[
                  styles.primaryButton,
                  (!joinGroupToken.trim() || joinGroupLoading) && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {joinGroupLoading ? "Đang tham gia..." : "Tham gia nhóm"}
                </Text>
              </Pressable>
            </>
          ) : cameraPermission?.granted ? (
            <View style={styles.joinGroupCameraWrap}>
              <View style={styles.joinGroupCameraFrame}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={handleJoinGroupScan}
                />
              </View>

              <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b", textAlign: "center" }]}>
                Đưa mã QR vào giữa khung để tham gia nhóm.
              </Text>
            </View>
          ) : (
            <View style={styles.joinGroupCameraWrap}>
              <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b", textAlign: "center" }]}>
                Camera chưa được cấp quyền. Hãy cho phép truy cập để quét mã QR.
              </Text>

              <Pressable onPress={() => void handleOpenJoinCamera()} style={styles.secondaryButton}>
                <Text style={[styles.secondaryButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Mở camera</Text>
              </Pressable>
            </View>
          )}
        </View>
      </OverlayModal>

      <OverlayModal
        visible={showCreateGroup}
        title="Tạo nhóm"
        onClose={() => {
          setShowCreateGroup(false);
          resetCreateGroupState();
        }}
      >
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Nhập tên nhóm"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textInput,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          <View
            style={[
              styles.groupAvatarCard,
              {
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <GroupAvatarPreview
              groupName={groupName}
              members={selectedGroupMembers}
              avatarUri={selectedGroupAvatar?.uri || null}
              isDark={isDark}
            />

            <View style={styles.groupAvatarMeta}>
              <View style={styles.groupAvatarTextBlock}>
                <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Avatar nhóm</Text>
                <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  Chọn ảnh riêng hoặc để hệ thống ghép avatar từ các thành viên đã chọn.
                </Text>
              </View>

              <View style={styles.requestActionsRow}>
                <Pressable onPress={() => void handlePickGroupAvatar()} style={[styles.secondaryButton, styles.groupFooterButton]}>
                  <Text style={[styles.secondaryButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Chọn ảnh</Text>
                </Pressable>

                {selectedGroupAvatar ? (
                  <Pressable
                    onPress={() => setSelectedGroupAvatar(null)}
                    style={[
                      styles.secondaryButton,
                      styles.groupFooterButton,
                      { borderColor: isDark ? "#312e81" : "#c4b5fd" },
                    ]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: isDark ? "#ddd6fe" : "#6d28d9" }]}>Xóa ảnh</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <TextInput
            value={groupQuery}
            onChangeText={setGroupQuery}
            placeholder="Tìm bạn để thêm vào nhóm"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textInput,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          {selectedGroupMembers.length > 0 && (
            <View style={styles.groupActionColumn}>
              <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>Đã chọn {selectedGroupMembers.length} thành viên</Text>
              {selectedGroupMembers.map((friend) => (
                <Pressable
                  key={friend._id}
                  onPress={() => handleToggleGroupMember(friend)}
                  style={[
                    styles.friendRow,
                    {
                      backgroundColor: isDark ? "#111827" : "#f5f3ff",
                      borderColor: isDark ? "#312e81" : "#c4b5fd",
                    },
                  ]}
                >
                  <View style={styles.requestInfo}>
                    <UserAvatar name={friend.displayName} avatarUrl={friend.avatarUrl} size={42} />
                    <View style={styles.requestTextBlock}>
                      <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                        {friend.displayName}
                      </Text>
                      <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>@{friend.username}</Text>
                    </View>
                  </View>

                  <Text style={[styles.linkText, { color: isDark ? "#ddd6fe" : "#6d28d9" }]}>Bỏ chọn</Text>
                </Pressable>
              ))}
            </View>
          )}

          <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
            {filteredFriendsForGroup.length === 0 ? (
              <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                {friends.length === 0
                  ? "Bạn chưa có bạn bè nào để tạo nhóm."
                  : "Không tìm thấy bạn bè phù hợp."}
              </Text>
            ) : (
              filteredFriendsForGroup.map((friend) => (
                <Pressable
                  key={friend._id}
                  onPress={() => handleToggleGroupMember(friend)}
                  style={({ pressed }) => [
                    styles.friendRow,
                    {
                      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                      borderColor: isDark ? "#1f2937" : "#e2e8f0",
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <View style={styles.requestInfo}>
                    <UserAvatar name={friend.displayName} avatarUrl={friend.avatarUrl} size={42} />
                    <View style={styles.requestTextBlock}>
                      <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                        {friend.displayName}
                      </Text>
                      <Text style={[styles.requestUsername, { color: isDark ? "#94a3b8" : "#64748b" }]}>@{friend.username}</Text>
                    </View>
                  </View>

                  <Text style={[styles.linkText, { color: isDark ? "#c084fc" : "#7c3aed" }]}>Thêm</Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <Pressable
            onPress={handleCreateGroup}
            disabled={chatLoading || isCreatingGroup}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {chatLoading || isCreatingGroup ? "Đang tạo..." : "Tạo nhóm chat"}
            </Text>
          </Pressable>
        </ScrollView>
      </OverlayModal>

      <FriendListModal
        visible={showFriendList}
        onClose={() => setShowFriendList(false)}
        onSelectFriend={(friend) => {
          void handleFriendListSelect(friend);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  headerTitleWrap: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerConversationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    width: "100%",
    minHeight: 52,
    borderRadius: 20,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
  },
  headerAvatarWrap: {
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 24,
    padding: 2,
  },
  headerProfileTextWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 2,
  },
  headerTitleText: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
  headerSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  headerActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pinnedContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1000,
    paddingHorizontal: 4,
  },
  messageListContent: { paddingHorizontal: 14, paddingBottom: 24 },
  loadingMore: { paddingVertical: 10, alignItems: "center" },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyMessageText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  blockedNotice: {
    textAlign: "center",
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 8,
  },
  typingBubble: {
    marginLeft: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "78%",
  },
  typingBubbleContent: {
    minWidth: 0,
    flexShrink: 1,
  },
  typingBubbleLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  typingBubbleDots: {
    marginTop: 2,
    flexDirection: "row",
    gap: 5,
    alignItems: "flex-start",
  },
  typingBubbleDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  scrollToLatestButton: {
    position: "absolute",
    right: 16,
    bottom: 74,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  scrollToLatestText: {
    fontSize: 13,
    fontWeight: "800",
  },
  conversationList: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 22 },
  section: { gap: 12 },
  sectionHeaderCompact: { gap: 10 },
  sectionTitleBlock: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  sidebarActionCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sidebarActionCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sidebarActionCardLead: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  sidebarActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d946ef",
  },
  sidebarActionTitle: { fontSize: 16, fontWeight: "800" },
  sidebarActionAccessory: { marginLeft: 8 },
  sidebarActionAccessoryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineActionButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineActionButtonText: { fontSize: 12, fontWeight: "700" },
  emptySection: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 18 },
  emptySectionText: { fontSize: 14, lineHeight: 20 },
  loaderState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  modalKeyboard: { flex: 1, justifyContent: "center" },
  modalCard: { borderRadius: 28, borderWidth: 1, maxHeight: "82%", overflow: "hidden" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 19, fontWeight: "800" },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { paddingHorizontal: 18, paddingBottom: 20, gap: 12 },
  modalSectionTitle: { fontSize: 15, fontWeight: "800" },
  modalSecondarySection: { marginTop: 8 },
  emptyModalText: { fontSize: 14, lineHeight: 20 },
  joinGroupTabRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  joinGroupTabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  joinGroupCameraWrap: {
    gap: 12,
  },
  joinGroupCameraFrame: {
    height: 260,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#020617",
  },
  requestCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  requestInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  requestTextBlock: { flex: 1, gap: 2 },
  requestName: { fontSize: 15, fontWeight: "700" },
  requestUsername: { fontSize: 13 },
  requestActions: { flexDirection: "row", gap: 10 },
  requestActionsRow: { flexDirection: "row", gap: 10 },
  primaryButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  groupActionColumn: {
    alignItems: "stretch",
    gap: 8,
    width: "100%",
  },
  groupAvatarCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  groupAvatarPreview: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  groupAvatarPreviewFrame: {
    overflow: "hidden",
    borderWidth: 1,
    padding: 4,
  },
  groupAvatarGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    overflow: "hidden",
    borderRadius: 999,
  },
  groupAvatarTile: {
    width: "49%",
    height: "49%",
    overflow: "hidden",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarTileSingle: {
    width: "100%",
    height: "100%",
  },
  groupAvatarTileDouble: {
    width: "49%",
    height: "100%",
  },
  groupAvatarTileTripleLead: {
    width: "49%",
    height: "100%",
  },
  groupAvatarTileImage: {
    width: "100%",
    height: "100%",
  },
  groupAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarFallbackText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  groupAvatarTileInitial: {
    fontSize: 15,
    fontWeight: "700",
  },
  groupAvatarCountTile: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarCountText: {
    fontSize: 15,
    fontWeight: "800",
  },
  groupAvatarMeta: {
    flex: 1,
    gap: 10,
  },
  groupAvatarTextBlock: {
    gap: 4,
  },
  groupActionButton: {
    width: "100%",
  },
  groupFooterButton: {
    flex: 1,
  },
  relationshipPill: {
    minHeight: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  relationshipPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "700" },
  pendingLabel: { fontSize: 13, fontWeight: "600" },
  textInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  textArea: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  statusText: { fontSize: 14, lineHeight: 20 },
  friendList: { maxHeight: 320 },
  friendRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  linkText: { fontSize: 13, fontWeight: "800" },
  selectedMembersWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectedMemberChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  selectedMemberText: { fontSize: 12, fontWeight: "700" },
});
