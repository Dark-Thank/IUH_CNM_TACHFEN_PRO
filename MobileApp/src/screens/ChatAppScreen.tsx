import ChatCard from "@/components/chat/ChatCard";
import FriendListModal from "@/components/chat/FriendListModal";
import MessageInput from "@/components/chat/MessageInput";
import MessageItem from "@/components/chat/MessageItem";
import PinnedSection from "@/components/chat/PinnedSection";
import ConversationAssetsModal from "@/components/chat/ConversationAssetsModal";
import ProfileModal from "@/components/chat/ProfileModal";
import UserAvatar from "@/components/chat/UserAvatar";
import { toast } from "@/lib/toast";
import type { RootTabParamList } from "@/navigation/AppNavigator";
import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message } from "@/types/chat";
import type { Friend, FriendRequest, User } from "@/types/user";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Bell, ChevronLeft, Menu, X } from "lucide-react-native";
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
  ActivityIndicator,
  FlatList,
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

type ChatNavigation = BottomTabNavigationProp<RootTabParamList, "Chat">;
type SearchStatus = "idle" | "loading" | "not_found" | "found";
type FriendRelationship = "self" | "friend" | "sent" | "received" | "available";

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
    return conversation.group?.name || "Nhom chat";
  }

  return (
    conversation.participants.find((participant) => participant._id !== currentUserId)
      ?.displayName || "Tin nhan"
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

    return onlineUserIds.has(otherUser._id) ? "Dang hoat dong" : "Dang ngoai tuyen";
  }

  const members = conversation.participants.filter(
    (participant) => participant._id !== currentUserId
  );
  const onlineCount = members.filter((participant) => onlineUserIds.has(participant._id)).length;

  if (onlineCount <= 0) {
    return `${members.length} thanh vien`;
  }

  return `${onlineCount} thanh vien dang hoat dong`;
};

const getRequestUser = (request: FriendRequest, type: "received" | "sent") =>
  type === "received" ? request.from : request.to;

const matchesQuery = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase());

const isSuccessMessage = (message: string) => /thanh cong|thành công/i.test(message);

function SectionActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { isDark } = useThemeStore();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sectionActionButton,
        {
          backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
          borderColor: isDark ? "#334155" : "#e2e8f0",
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={[styles.sectionActionText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
        {label}
      </Text>
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
  const flatListRef = useRef<FlatList<Message>>(null);
  const isCreatingGroupRef = useRef(false);

  const [showRequests, setShowRequests] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showFriendList, setShowFriendList] = useState(false);
  const [showConversationProfile, setShowConversationProfile] = useState(false);
  const [showConversationAssets, setShowConversationAssets] = useState(false);

  const [friendUsername, setFriendUsername] = useState("");
  const [friendRequestMessage, setFriendRequestMessage] = useState("");
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [newMessageQuery, setNewMessageQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Friend[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

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
  } = useChatStore();

  const loadSocialData = useCallback(async () => {
    await Promise.all([getFriends(), getAllFriendRequests()]);
  }, [getAllFriendRequests, getFriends]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      loadSocialData().catch((error) => {
        console.error("Loi khi tai du lieu ban be:", error);
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
        (left, right) =>
          new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
      ),
    [conversations]
  );

  const directConversations = useMemo(
    () => sortedConversations.filter((conversation) => conversation.type === "direct"),
    [sortedConversations]
  );

  const groupConversations = useMemo(
    () => sortedConversations.filter((conversation) => conversation.type === "group"),
    [sortedConversations]
  );

  const onlineUserIds = useMemo(() => new Set(onlineUsers), [onlineUsers]);

  const selectedConvo =
    sortedConversations.find((conversation) => conversation._id === activeConversationId) ?? null;
  const selectedConversationId = selectedConvo?._id ?? null;
  const typingUsers = useSocketStore((state) =>
    selectedConversationId ? state.typingByConversation[selectedConversationId] ?? [] : []
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
    () => (selectedConvo ? uniqueById(messages[selectedConvo._id]?.items ?? []) : []),
    [messages, selectedConvo]
  );

  const pinnedMessages = useMemo(
    () => messageItems.filter((message) => message.isPinned),
    [messageItems]
  );

  const hasMoreMessages = selectedConvo ? messages[selectedConvo._id]?.hasMore ?? false : false;
  const latestMessageId = messageItems[messageItems.length - 1]?._id;

  const lastMessageStatus: "delivered" | "seen" =
    (selectedConvo?.seenBy?.length ?? 0) > 0 ? "seen" : "delivered";
  const typingLabel = typingUsers.length === 0
    ? ""
    : typingUsers.length === 1
      ? `${typingUsers[0].displayName || "Ai do"} dang soan tin nhan`
      : `${typingUsers[0].displayName || "Ai do"} va ${typingUsers.length - 1} nguoi khac dang soan tin nhan`;

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

  const handleBack = useCallback(() => {
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
  }, []);

  const openRequestsModal = useCallback(() => {
    setShowRequests(true);
    getAllFriendRequests().catch((error) => {
      console.error("Loi khi tai danh sach loi moi:", error);
    });
  }, [getAllFriendRequests]);

  const openAddFriendModal = useCallback(() => {
    setShowAddFriend(true);
    resetAddFriendState();
    loadSocialData().catch((error) => {
      console.error("Loi khi tai du lieu ket ban:", error);
    });
  }, [loadSocialData, resetAddFriendState]);

  const openNewMessageModal = useCallback(() => {
    setShowNewMessage(true);
    resetNewMessageState();
    getFriends().catch((error) => {
      console.error("Loi khi tai danh sach ban be:", error);
    });
  }, [getFriends, resetNewMessageState]);

  const openCreateGroupModal = useCallback(() => {
    setShowCreateGroup(true);
    resetCreateGroupState();
    getFriends().catch((error) => {
      console.error("Loi khi tai danh sach ban be:", error);
    });
  }, [getFriends, resetCreateGroupState]);

  const openFriendListModal = useCallback(() => {
    setShowFriendList(true);
  }, []);

  const handleSearchUser = useCallback(async () => {
    const normalizedUsername = friendUsername.trim().toLowerCase();

    if (!normalizedUsername) {
      toast.info("Nhap username de tim kiem.");
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
      toast.success("Da chap nhan loi moi ket ban.");
    },
    [acceptRequest, loadSocialData]
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      await declineRequest(requestId);
      await getAllFriendRequests();
      toast.info("Da huy loi moi ket ban.");
    },
    [declineRequest, getAllFriendRequests]
  );

  const handleOpenConversation = useCallback(
    async (friend: Friend) => {
      if (blockedUsers.has(friend._id)) {
        toast.error("Ban khong the nhan tin voi nguoi nay.");
        return;
      }

      const existingConversation = directConversations.find((conversation) =>
        conversation.participants.some((participant) => participant._id === friend._id)
      );

      setShowNewMessage(false);
      resetNewMessageState();

      if (existingConversation) {
        setActiveConversation(existingConversation._id);
        return;
      }

      await createConversation("direct", "", [friend._id]);
    },
    [blockedUsers, createConversation, directConversations, resetNewMessageState, setActiveConversation]
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

  const handleCreateGroup = useCallback(async () => {
    if (isCreatingGroupRef.current || isCreatingGroup || chatLoading) {
      return;
    }

    if (!groupName.trim()) {
      toast.warning("Nhap ten nhom truoc khi tao.");
      return;
    }

    if (selectedGroupMembers.length === 0) {
      toast.warning("Chon it nhat mot ban de tao nhom.");
      return;
    }

    isCreatingGroupRef.current = true;
    setIsCreatingGroup(true);

    try {
      await createConversation(
        "group",
        groupName.trim(),
        selectedGroupMembers.map((friend) => friend._id)
      );

      setShowCreateGroup(false);
      resetCreateGroupState();
    } finally {
      isCreatingGroupRef.current = false;
      setIsCreatingGroup(false);
    }
  }, [chatLoading, createConversation, groupName, isCreatingGroup, resetCreateGroupState, selectedGroupMembers]);

  useEffect(() => {
    if (!selectedConversationId || messages[selectedConversationId]) {
      return;
    }

    fetchMessages(selectedConversationId).catch((error) => {
      console.error("Loi khi tai tin nhan:", error);
    });
  }, [fetchMessages, messages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    markAsSeen().catch((error) => {
      console.error("Loi khi danh dau da xem:", error);
    });
  }, [markAsSeen, selectedConversationId]);

  useEffect(() => {
    setShowConversationProfile(false);
    setShowConversationAssets(false);
  }, [selectedConversationId]);

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
      console.error("Loi khi tai them attachment:", error);
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

    return () => clearTimeout(timeout);
  }, [latestMessageId, selectedConvo]);

  const handleMessageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;

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

  const handleOpenConversationAssets = useCallback(() => {
    if (selectedConvo) {
      setShowConversationAssets(true);
    }
  }, [selectedConvo]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: selectedConvo ? getConversationTitle(selectedConvo, user?._id) : "Doan chat",
      headerTitle: selectedConvo
        ? () =>
          selectedConversationFriend ? (
            <Pressable
              onPress={handleOpenConversationProfile}
              style={({ pressed }) => [
                styles.headerProfileButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <UserAvatar
                name={selectedConversationFriend.displayName}
                avatarUrl={selectedConversationFriend.avatarUrl}
                size={40}
                isOnline={isSelectedConversationFriendOnline}
                showPresence
              />

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
          <Pressable
            onPress={handleOpenConversationAssets}
            style={[
              styles.headerIconButton,
              { backgroundColor: isDark ? "#1f2937" : "#eef2ff" },
            ]}
          >
            <Menu size={18} color={isDark ? "#cbd5e1" : "#4f46e5"} />
          </Pressable>
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
    handleBack,
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
            data={messageItems}
            keyExtractor={(item) => item._id}
            contentContainerStyle={[
              styles.messageListContent,
              { paddingTop: pinnedMessages.length > 0 ? 120 : 14 },
            ]}
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
                  Chua co tin nhan nao trong cuoc tro chuyen nay.
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <MessageItem
                message={item}
                index={index}
                messages={messageItems}
                previousMessage={index > 0 ? messageItems[index - 1] : undefined}
                selectedConvo={selectedConvo}
                lastMessageStatus={lastMessageStatus}
              />
            )}
          />

          {isConversationBlocked ? (
            <Text style={styles.blockedNotice}>Ban khong the tra loi cuoc tro chuyen nay.</Text>
          ) : null}

          {typingLabel ? (
            <Text style={[styles.typingNotice, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {typingLabel}
            </Text>
          ) : null}

          <MessageInput selectedConvo={selectedConvo} disabled={isConversationBlocked} />
        </KeyboardAvoidingView>

        <ProfileModal
          visible={showConversationProfile}
          friend={selectedConversationFriend}
          onClose={() => setShowConversationProfile(false)}
        />

        <ConversationAssetsModal
          visible={showConversationAssets}
          messages={messageItems}
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
            Dang tai danh sach doan chat...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.conversationList} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleBlock}>
                <Text style={[styles.sectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Ban be
                </Text>
              </View>

              <View style={styles.sectionActions}>
                <SectionActionButton label="Ban be" onPress={openFriendListModal} />
                <SectionActionButton label="Ket ban" onPress={openAddFriendModal} />
                <SectionActionButton label="Tin nhan moi" onPress={openNewMessageModal} />
              </View>
            </View>

            {directConversations.length > 0 ? (
              directConversations.map((conversation) => {
                const otherUser = getDirectParticipant(conversation, user?._id);

                return (
                  <ChatCard
                    key={conversation._id}
                    conversation={conversation}
                    onPress={() => setActiveConversation(conversation._id)}
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
                  Chua co doan chat voi ban be nao.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleBlock}>
                <Text style={[styles.sectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Group
                </Text>
                <Text style={[styles.sectionSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  Tao nhom de tro chuyen voi nhieu ban cung luc.
                </Text>
              </View>

              <View style={styles.sectionActions}>
                <SectionActionButton label="Tao nhom" onPress={openCreateGroupModal} />
              </View>
            </View>

            {groupConversations.length > 0 ? (
              groupConversations.map((conversation) => (
                <ChatCard
                  key={conversation._id}
                  conversation={conversation}
                  onPress={() => setActiveConversation(conversation._id)}
                  currentUserId={user?._id}
                />
              ))
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
                  Chua co nhom chat nao.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <OverlayModal visible={showRequests} title="Loi moi ket ban" onClose={() => setShowRequests(false)}>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.modalSectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Da nhan</Text>

          {receivedList.length === 0 ? (
            <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              Ban chua co loi moi ket ban nao.
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
                      <Text style={[styles.secondaryButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Huy</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleAcceptRequest(request._id)}
                      disabled={friendStoreLoading}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>Chap nhan</Text>
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
            Da gui
          </Text>

          {sentList.length === 0 ? (
            <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              Ban chua gui loi moi ket ban nao.
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

                  <Text style={[styles.pendingLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}>Dang cho phan hoi</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </OverlayModal>

      <OverlayModal
        visible={showAddFriend}
        title="Ket ban"
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
            placeholder="Nhap username can tim"
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
            <Text style={styles.primaryButtonText}>{searchStatus === "loading" ? "Dang tim..." : "Tim nguoi dung"}</Text>
          </Pressable>

          {searchStatus === "not_found" && (
            <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              Khong tim thay nguoi dung phu hop.
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
                    placeholder="Loi nhan (khong bat buoc)"
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
                      {friendStoreLoading ? "Dang gui..." : "Gui loi moi ket ban"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.statusText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  {searchedUserRelationship === "self" && "Ban khong the gui loi moi cho chinh minh."}
                  {searchedUserRelationship === "friend" && "Nguoi nay da la ban cua ban."}
                  {searchedUserRelationship === "sent" && "Ban da gui loi moi cho nguoi nay roi."}
                  {searchedUserRelationship === "received" &&
                    "Nguoi nay da gui loi moi cho ban. Hay mo cua so loi moi de chap nhan."}
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </OverlayModal>

      <OverlayModal
        visible={showNewMessage}
        title="Tin nhan moi"
        onClose={() => {
          setShowNewMessage(false);
          resetNewMessageState();
        }}
      >
        <View style={styles.modalContent}>
          <TextInput
            value={newMessageQuery}
            onChangeText={setNewMessageQuery}
            placeholder="Tim theo ten hoac username"
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
                  ? "Ban chua co ban be nao de bat dau tro chuyen."
                  : "Khong tim thay ban be phu hop."}
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

                  <Text style={[styles.linkText, { color: isDark ? "#c084fc" : "#7c3aed" }]}>Mo chat</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </OverlayModal>

      <OverlayModal
        visible={showCreateGroup}
        title="Tao nhom"
        onClose={() => {
          setShowCreateGroup(false);
          resetCreateGroupState();
        }}
      >
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Nhap ten nhom"
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

          <TextInput
            value={groupQuery}
            onChangeText={setGroupQuery}
            placeholder="Tim ban de them vao nhom"
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
            <View style={styles.selectedMembersWrap}>
              {selectedGroupMembers.map((friend) => (
                <Pressable
                  key={friend._id}
                  onPress={() => handleToggleGroupMember(friend)}
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
          )}

          <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
            {filteredFriendsForGroup.length === 0 ? (
              <Text style={[styles.emptyModalText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                {friends.length === 0
                  ? "Ban chua co ban be nao de tao nhom."
                  : "Khong tim thay ban be phu hop."}
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

                  <Text style={[styles.linkText, { color: isDark ? "#c084fc" : "#7c3aed" }]}>Them</Text>
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
              {chatLoading || isCreatingGroup ? "Dang tao..." : "Tao nhom chat"}
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
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 220,
  },
  headerProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 240,
  },
  headerProfileTextWrap: {
    flexShrink: 1,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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
  typingNotice: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    fontSize: 13,
    fontStyle: "italic",
  },
  conversationList: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 22 },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitleBlock: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  sectionActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  sectionActionButton: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionActionText: { fontSize: 12, fontWeight: "700" },
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
  requestCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  requestInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  requestTextBlock: { flex: 1, gap: 2 },
  requestName: { fontSize: 15, fontWeight: "700" },
  requestUsername: { fontSize: 13 },
  requestActions: { flexDirection: "row", gap: 10 },
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
