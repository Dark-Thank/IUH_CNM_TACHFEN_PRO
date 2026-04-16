import ChatCard from "@/components/chat/ChatCard";
import FriendListModal from "@/components/chat/FriendListModal";
import MessageInput from "@/components/chat/MessageInput";
import MessageItem from "@/components/chat/MessageItem";


import PinnedSection from "@/components/chat/PinnedSection";

import { toast } from "@/lib/toast";

import type { RootTabParamList } from "@/navigation/AppNavigator";
import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message } from "@/types/chat";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { Bell, ChevronLeft, MessageCircleMore, User, UserPlus, Users } from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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


const uniqueById = <T extends { _id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item._id)) return false;
    seen.add(item._id);
    return true;
  });
};

const getConversationTitle = (conversation: Conversation, currentUserId?: string) => {
  if (conversation.type === "group") return conversation.group?.name || "Nhóm chat";
  return conversation.participants.find((p) => p._id !== currentUserId)?.displayName || "Tin nhắn";
};

export default function ChatAppScreen() {
  const [showAddFriend, setShowAddFriend] = useState(false);
const [showCreateGroup, setShowCreateGroup] = useState(false);
  const navigation = useNavigation<ChatNavigation>();
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList<Message>>(null);
  const [showRequests, setShowRequests] = useState(false);

  const [friendUsername, setFriendUsername] = useState("");
  const [friendMessage, setFriendMessage] = useState("");
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendFound, setFriendFound] = useState<null | { _id: string; displayName: string }>(null);
  const [groupName, setGroupName] = useState("");
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFriendList, setShowFriendList] = useState(false);
  const {
  friends,
  receivedList,
  sentList,
  blockedUsers,
  setBlockedUsers,
  searchByUsername,
  addFriend,
  getAllFriendRequests,
  acceptRequest,
  declineRequest,
  getFriends,
  loading: friendStoreLoading,
} = useFriendStore();
  const {
    activeConversationId,
    conversations,
    messages,
    convoLoading,
    messageLoading,
    setActiveConversation,
    fetchConversations,
    fetchMessages,
    markAsSeen,
    createConversation
  } = useChatStore();
  

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  

  useEffect(() => {
  const checkAllStatus = async () => {
    const statuses = await Promise.all(
      friends.map(async (f) => {
        const isBlocked = await friendService.checkBlockStatus(f._id);
        return isBlocked ? f._id : null;
      })
    );

    setBlockedUsers(statuses.filter(Boolean) as string[])
  };

  if (friends.length > 0) {
    checkAllStatus();
  }
}, [friends]);

  const sortedConversations = useMemo(
    () => uniqueById(conversations).sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    ), [conversations]
  );

  const selectedConvo = sortedConversations.find((c) => c._id === activeConversationId) ?? null;

  const messageItems = useMemo(
    () => selectedConvo ? uniqueById(messages[selectedConvo._id]?.items ?? []) : [],
    [messages, selectedConvo]
  );

  const pinnedMessages = useMemo(() => messageItems.filter((m) => m.isPinned), [messageItems]);
  const hasMoreMessages = selectedConvo ? messages[selectedConvo._id]?.hasMore ?? false : false;
  const latestMessageId = messageItems[messageItems.length - 1]?._id;
  const lastMessageStatus: "delivered" | "seen" = (selectedConvo?.seenBy?.length ?? 0) > 0 ? "seen" : "delivered";

  const handleBack = useCallback(() => setActiveConversation(null), [setActiveConversation]);

  // FIX LỖI 1: "Expected 0-1 arguments, but got 2"
  // Truyền id vào fetchMessages. Store thường tự quản lý trang hoặc nhận tham số loadMore qua object.
  const handleMessageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      if (
        contentOffset.y <= TOP_LOAD_THRESHOLD &&
        hasMoreMessages &&
        !messageLoading &&
        activeConversationId
      ) {
        // Nếu store của bạn yêu cầu loadMore, hãy thử truyền fetchMessages(activeConversationId) 
        // hoặc fetchMessages({ id: activeConversationId, loadMore: true }) tùy theo định nghĩa store.
        fetchMessages(activeConversationId);
      }
    },
    [hasMoreMessages, messageLoading, activeConversationId, fetchMessages]
  );




  const renderHeaderLeft = useCallback(() => {
  if (!selectedConvo) return null;

  return (
    <Pressable
      onPress={handleBack}
      style={[
        styles.headerBackButton,
        { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" },
      ]}
    >
      <ChevronLeft
        size={20}
        color={isDark ? "#f8fafc" : "#0f172a"}
      />
    </Pressable>
  );
}, [selectedConvo?._id, isDark, handleBack]);
  
  const renderHeaderRight = useCallback(() => {
  if (selectedConvo) {
    return (
      <Text
        style={[
          styles.headerMeta,
          { color: isDark ? "#94a3b8" : "#64748b" },
        ]}
      >
        {selectedConvo.type === "group"
          ? `${selectedConvo.participants.length} thành viên`
          : "Cuộc trò chuyện"}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {/* Friend list */}
      {/* <Pressable
        onPress={() => setShowFriendList(true)}
        style={[
          styles.headerIconButton,
          { backgroundColor: isDark ? "#1f2937" : "#eef2ff" },
        ]}
      >
        <MessageCircleMore
          size={18}
          color={isDark ? "#c084fc" : "#4f46e5"}
        />
      </Pressable> */}

      {/* Requests */}
      <Pressable
        onPress={() => setShowRequests(true)}
        style={[
          styles.headerIconButton,
          { backgroundColor: isDark ? "#1f2937" : "#eef2ff" },
        ]}
      >
        <Bell size={18} color={isDark ? "#cbd5e1" : "#4f46e5"} />
        {receivedList.length > 0 && (
          <View
            style={[
              styles.headerBadge,
              { backgroundColor: isDark ? "#a855f7" : "#7c3aed" },
            ]}
          >
            <Text style={styles.headerBadgeText}>
              {receivedList.length}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}, [selectedConvo,
  isDark,
  receivedList.length]);

  useLayoutEffect(() => {
  navigation.setOptions({
    title: selectedConvo
      ? getConversationTitle(selectedConvo, user?._id)
      : "Chat",
    headerLeft: renderHeaderLeft,
    headerRight: renderHeaderRight,
  });
}, [
  navigation,
  selectedConvo?._id,
  user?._id,
  renderHeaderLeft,
  renderHeaderRight,
]);
  useEffect(() => {
    if (!selectedConvo) {
      return;
    }

    if (!messages[selectedConvo._id]) {
      fetchMessages(selectedConvo._id);
    }
  }, [fetchMessages, messages, selectedConvo]);

  useEffect(() => {
    if (!selectedConvo) {
      return;
    }

    markAsSeen();
  }, [markAsSeen, selectedConvo]);

  useEffect(() => {
    if (!selectedConvo || !latestMessageId) {
      return;
    }

    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    return () => clearTimeout(timeout);
  }, [latestMessageId, selectedConvo]);

  useEffect(() => {
    if (!showRequests) {
      return;
    }

    getAllFriendRequests();
  }, [getAllFriendRequests, showRequests]);

  useEffect(() => {
    if (!showCreateGroup) {
      return;
    }

    getFriends();
  }, [getFriends, showCreateGroup]);

  useEffect(() => {
    if (!showAddFriend) {
      return;
    }

    getFriends();
    getAllFriendRequests();
  }, [getAllFriendRequests, getFriends, showAddFriend]);

  const handleSelectConversation = async (conversationId: string) => {
    setActiveConversation(conversationId);

    if (!messages[conversationId]) {
      await fetchMessages(conversationId);
    }
  };
  const directConversations = useMemo(
    () => sortedConversations.filter((conversation) => conversation.type === "direct"),
    [sortedConversations]
  );

  const filteredDirectConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return directConversations;
    }

    return directConversations.filter((conversation) => {
      const title = getConversationTitle(conversation, user?._id).toLowerCase();
      return title.includes(query);
    });
  }, [directConversations, searchQuery, user?._id]);

  const groupConversations = useMemo(
    () => sortedConversations.filter((conversation) => conversation.type === "group"),
    [sortedConversations]
  );

  

  const resetFriendModal = () => {
    setFriendUsername("");
    setFriendMessage("");
    setFriendFound(null);
    setFriendLoading(false);
  };

  const resetGroupModal = () => {
    setGroupName("");
    setGroupLoading(false);
    setSelectedFriendIds([]);
  };

  const handleSearchFriend = async () => {
    if (!friendUsername.trim()) {
      toast.error("Hay nhap username can tim.");
      return;
    }

    setFriendLoading(true);
    setFriendFound(null);

    try {
      const result = await searchByUsername(friendUsername.trim());

      if (!result) {
        toast.error("Khong tim thay nguoi dung.");
        return;
      }

      setFriendFound({ _id: result._id, displayName: result.displayName });
    } catch (error) {
      console.error(error);
      toast.error("Khong the tim nguoi dung luc nay.");
    } finally {
      setFriendLoading(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!friendFound) {
      toast.error("Hay tim nguoi dung truoc khi gui loi moi.");
      return;
    }

    const isAlreadyFriend = friends.some((friend) => friend._id === friendFound._id);
    const isPendingRequest =
      receivedList.some((request) => request.from?._id === friendFound._id) ||
      sentList.some((request) => request.to?._id === friendFound._id);

    if (isAlreadyFriend) {
      toast.error("Nguoi nay da la ban be.");
      return;
    }

    if (isPendingRequest) {
      toast.error("Da co loi moi dang cho xu ly.");
      return;
    }

    setFriendLoading(true);

    try {
      await addFriend(friendFound._id, friendMessage.trim() || undefined);
      toast.success("Da gui loi moi ket ban.");
      setShowAddFriend(false);
      resetFriendModal();
    } catch (error) {
      console.error(error);
      toast.error("Gui loi moi that bai.");
    } finally {
      setFriendLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptRequest(requestId);
      toast.success("Da chap nhan loi moi.");
    } catch (error) {
      console.error(error);
      toast.error("Khong the chap nhan luc nay.");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await declineRequest(requestId);
      toast.success("Da tu choi loi moi.");
    } catch (error) {
      console.error(error);
      toast.error("Khong the tu choi luc nay.");
    }
  };

  const handleStartChat = async (friendId: string) => {
    if (blockedUsers.has(friendId)) {
      toast.error("Bạn đã chặn người này");
      return;
    }

    const existing = conversations.find((c) =>
      c.participants.some((p) => p._id === friendId)
    );

    if (existing) {
      setActiveConversation(existing._id);
      return;
    }

    await createConversation("direct", "Chat", [friendId]);
  };


  const toggleMember = (memberId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Hay nhap ten nhom.");
      return;
    }

    if (selectedFriendIds.length === 0) {
      toast.error("Hay chon it nhat 1 thanh vien.");
      return;
    }

    setGroupLoading(true);

    try {
      await createConversation("group", groupName.trim(), selectedFriendIds);
      toast.success("Tao nhom thanh cong.");
      setShowCreateGroup(false);
      resetGroupModal();
    } catch (error) {
      console.error(error);
      toast.error("Tao nhom that bai.");
    } finally {
      setGroupLoading(false);
    }
  };

  if (selectedConvo) {
    const isBlocked =
  selectedConvo?.type === "direct" &&
  selectedConvo.participants
    .filter((p) => p._id !== user?._id)
    .some((p) => blockedUsers.has(p._id));
    return (
      <SafeAreaView
        style={[
          styles.screen,
          { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
        ]}
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
                  const index = messageItems.findIndex(m => m._id === id);
                  if (index !== -1) flatListRef.current?.scrollToIndex({ index, animated: true });
                }} 
              />
            )}
          </View>
        <FlatList
          ref={flatListRef}
          data={messageItems}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messageListContent}
          style={styles.messageList}
          onScroll={handleMessageScroll}
          scrollEventThrottle={16}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            messageLoading && hasMoreMessages ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#c084fc" : "#8b5cf6"}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text
                style={[
                  styles.emptyText,
                  { color: isDark ? "#cbd5e1" : "#475569" },
                ]}
              >
                Chưa có tin nhắn nào trong cuộc trò chuyện này. Hãy bắt đầu bằng cách gửi một tin nhắn!
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
        {isBlocked ? (
  <Text style={{ textAlign: "center", color: "red", marginBottom: 10 }}>
    Bạn không thể trả lời cuộc trò chuyện này
  </Text>
) : null}

<MessageInput
  selectedConvo={selectedConvo}
  disabled={isBlocked}
/>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // FIX LỖI 2: "Expression expected"
  // MÀN HÌNH DANH SÁCH CÁC CUỘC HỘI THOẠI
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}>
      {/* <FlatList
        data={sortedConversations}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.conversationList}
        renderItem={({ item }) => (
          <ChatCard
            conversation={item}
            onPress={() => setActiveConversation(item._id)}
            currentUserId={user?._id}
          />

        )}
        // ListEmptyComponent={
        //   <View style={styles.emptyMessages}>
        //     <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Chưa có cuộc hội thoại nào.</Text>
        //   </View>
        // }
        /> */}
        {convoLoading ? (
          <View style={styles.loaderState}>
          <Text style={[styles.emptyText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
            Đang tải danh sách hội thoại...
          </Text>
        </View>
        
        
      ) : (
        <FlatList
          data={filteredDirectConversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.conversationList}
          renderItem={({ item }) => (
            <ChatCard
              conversation={item}
              currentUserId={user?._id}
              isActive={item._id === activeConversationId}
              onPress={handleSelectConversation}
            />
          )}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.searchRow}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Tim ban be de nhan tin"
                  placeholderTextColor="#94a3b8"
                  style={[
                    styles.searchInput,
                    { color: isDark ? "#f8fafc" : "#0f172a", borderColor: isDark ? "#1f2937" : "#e2e8f0" },
                  ]}
                  autoCapitalize="none"
                />
              </View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                Chat ban be
              </Text>
              <View style={styles.sectionActions}>
                <Pressable
                  onPress={() => setShowFriendList(true)}
                  style={[
                    styles.sectionAction,
                    { backgroundColor: isDark ? "#1f2937" : "#eef2ff" },
                  ]}
                >
                  <User size={16} color={isDark ? "#c084fc" : "#6366f1"} />
                  <Text style={[styles.sectionActionText, { color: isDark ? "#cbd5e1" : "#4f46e5" }]}>
                    Danh sách bạn bè
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowAddFriend(true)}
                  style={[
                    styles.sectionAction,
                    { backgroundColor: isDark ? "#1f2937" : "#eef2ff" },
                  ]}
                >
                  <UserPlus size={16} color={isDark ? "#c084fc" : "#6366f1"} />
                  <Text style={[styles.sectionActionText, { color: isDark ? "#cbd5e1" : "#4f46e5" }]}>
                    Ket ban
                  </Text>
                </Pressable>
              </View>
            </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MessageCircleMore
                size={46}
                color={isDark ? "#c084fc" : "#8b5cf6"}
              />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: isDark ? "#f8fafc" : "#0f172a" },
                ]}
              >
                Chưa có cuộc trò chuyện nào
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: isDark ? "#cbd5e1" : "#475569" },
                ]}
              >
                Khi đăng nhập và tạo chat, danh sách cuộc trò chuyện sẽ hiện ở đây.
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.groupSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Group
                </Text>
                <Pressable
                  onPress={() => setShowCreateGroup(true)}
                  style={[
                    styles.sectionAction,
                    { backgroundColor: isDark ? "#1f2937" : "#eff6ff" },
                  ]}
                >
                  <Users size={16} color={isDark ? "#c084fc" : "#2563eb"} />
                  <Text style={[styles.sectionActionText, { color: isDark ? "#cbd5e1" : "#1d4ed8" }]}>
                    Tạo nhóm
                  </Text>
                </Pressable>
              </View>
              {groupConversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <MessageCircleMore size={46} color={isDark ? "#c084fc" : "#8b5cf6"} />
                  <Text style={[styles.emptyTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                    Chưa có cuộc trò chuyện nhóm
                  </Text>
                  <Text style={[styles.emptyText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                    Tạo nhóm để bắt đầu cuộc trò chuyện chung.
                  </Text>
                </View>
              ) : (
                groupConversations.map((item) => (
                  <ChatCard
                    key={item._id}
                    conversation={item}
                    currentUserId={user?._id}
                    isActive={item._id === activeConversationId}
                    onPress={handleSelectConversation}
                  />
                ))
              )}
            </View>
          }
        />
      )}
      <Modal
        transparent
        animationType="slide"
        visible={showAddFriend}
        onRequestClose={() => {
          setShowAddFriend(false);
          resetFriendModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={[styles.modalCard, { backgroundColor: isDark ? "#111827" : "#ffffff" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Gửi lời mời kết bạn
            </Text>
            <TextInput
              value={friendUsername}
              onChangeText={setFriendUsername}
              placeholder="Username"
              placeholderTextColor="#94a3b8"
              style={[
                styles.modalInput,
                { color: isDark ? "#f8fafc" : "#0f172a", borderColor: isDark ? "#1f2937" : "#e2e8f0" },
              ]}
              autoCapitalize="none"
            />
            <Pressable
              onPress={handleSearchFriend}
              disabled={friendLoading}
              style={[
                styles.modalPrimary,
                { backgroundColor: isDark ? "#7c3aed" : "#4f46e5", opacity: friendLoading ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.modalPrimaryText}>
                {friendLoading ? "Dang tim..." : "Tim user"}
              </Text>
            </Pressable>
            {friendFound ? (
              <View style={styles.modalHintGroup}>
                <Text style={[styles.modalHint, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  Tim thay: {friendFound.displayName}
                </Text>
                {friends.some((friend) => friend._id === friendFound._id) ? (
                  <Text style={[styles.modalHint, { color: isDark ? "#facc15" : "#b45309" }]}>
                    Da la ban be, khong the gui loi moi.
                  </Text>
                ) : null}
                {receivedList.some((request) => request.from?._id === friendFound._id) ? (
                  <Text style={[styles.modalHint, { color: isDark ? "#facc15" : "#b45309" }]}>
                    Ban dang co loi moi tu nguoi nay.
                  </Text>
                ) : null}
                {sentList.some((request) => request.to?._id === friendFound._id) ? (
                  <Text style={[styles.modalHint, { color: isDark ? "#facc15" : "#b45309" }]}>
                    Da gui loi moi, vui long cho phan hoi.
                  </Text>
                ) : null}
              </View>
            ) : null}
            <TextInput
              value={friendMessage}
              onChangeText={setFriendMessage}
              placeholder="Loi nhan (tuy chon)"
              placeholderTextColor="#94a3b8"
              style={[
                styles.modalInput,
                { color: isDark ? "#f8fafc" : "#0f172a", borderColor: isDark ? "#1f2937" : "#e2e8f0" },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowAddFriend(false);
                  resetFriendModal();
                }}
                style={[styles.modalGhost, { borderColor: isDark ? "#334155" : "#e2e8f0" }]}
              >
                <Text style={[styles.modalGhostText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  Huỷ
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSendFriendRequest}
                disabled={friendLoading}
                style={[
                  styles.modalPrimary,
                  {
                    backgroundColor: isDark ? "#22c55e" : "#16a34a",
                    opacity:
                      friendLoading ||
                      (friendFound
                        ? friends.some((friend) => friend._id === friendFound._id) ||
                          receivedList.some((request) => request.from?._id === friendFound._id) ||
                          sentList.some((request) => request.to?._id === friendFound._id)
                        : false)
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                <Text style={styles.modalPrimaryText}>
                  Gửi lời mời
                </Text>
              </Pressable>
            </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={showCreateGroup}
        onRequestClose={() => {
          setShowCreateGroup(false);
          resetGroupModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={[styles.modalCard, { backgroundColor: isDark ? "#111827" : "#ffffff" }]}>
            <Text style={[styles.modalTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Tạo nhóm chat
            </Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Tên nhóm"
              placeholderTextColor="#94a3b8"
              style={[
                styles.modalInput,
                { color: isDark ? "#f8fafc" : "#0f172a", borderColor: isDark ? "#1f2937" : "#e2e8f0" },
              ]}
            />
            <Text style={[styles.modalHint, { color: isDark ? "#cbd5e1" : "#475569" }]}>
              Chon thanh vien tu danh sach ban be.
            </Text>
            {friendStoreLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={isDark ? "#c084fc" : "#8b5cf6"} />
                <Text style={[styles.modalHint, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  Dang tai ban be...
                </Text>
              </View>
            ) : friends.length === 0 ? (
              <Text style={[styles.modalHint, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                Chua co ban be nao.
              </Text>
            ) : (
              friends.map((friend) => {
                const isSelected = selectedFriendIds.includes(friend._id);
                return (
                  <Pressable
                    key={friend._id}
                    onPress={() => toggleMember(friend._id)}
                    style={[
                      styles.friendRow,
                      {
                        borderColor: isDark ? "#1f2937" : "#e2e8f0",
                        backgroundColor: isSelected
                          ? isDark
                            ? "#1e293b"
                            : "#eef2ff"
                          : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.friendName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                      {friend.displayName}
                    </Text>
                    <Text style={[styles.friendMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                      @{friend.username}
                    </Text>
                  </Pressable>
                );
              })
            )}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowCreateGroup(false);
                  resetGroupModal();
                }}
                style={[styles.modalGhost, { borderColor: isDark ? "#334155" : "#e2e8f0" }]}
              >
                <Text style={[styles.modalGhostText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  Huỷ
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreateGroup}
                disabled={groupLoading}
                style={[
                  styles.modalPrimary,
                  { backgroundColor: isDark ? "#2563eb" : "#1d4ed8", opacity: groupLoading ? 0.7 : 1 },
                ]}
              >
                <Text style={styles.modalPrimaryText}>
                  {groupLoading ? "Đang tạo..." : "Tạo nhóm"}
                </Text>
              </Pressable>
            </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={showRequests}
        onRequestClose={() => setShowRequests(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScrollContent}>
              <View style={[styles.modalCard, { backgroundColor: isDark ? "#111827" : "#ffffff" }]}>
                <Text style={[styles.modalTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Loi moi ket ban
                </Text>
                {friendStoreLoading ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="small" color={isDark ? "#c084fc" : "#8b5cf6"} />
                    <Text style={[styles.modalHint, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                      Dang tai danh sach...
                    </Text>
                  </View>
                ) : receivedList.length === 0 ? (
                  <Text style={[styles.modalHint, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                    Chua co loi moi nao.
                  </Text>
                ) : (
                  receivedList.map((request) => (
                    <View
                      key={request._id}
                      style={[
                        styles.requestRow,
                        { borderColor: isDark ? "#1f2937" : "#e2e8f0" },
                      ]}
                    >
                      <View style={styles.requestInfo}>
                        <Text style={[styles.requestName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                          {request.from?.displayName || "Nguoi dung"}
                        </Text>
                        <Text style={[styles.requestMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                          @{request.from?.username || "username"}
                        </Text>
                        {request.message ? (
                          <Text style={[styles.requestMessage, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                            {request.message}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.requestActions}>
                        <Pressable
                          onPress={() => handleDeclineRequest(request._id)}
                          style={[
                            styles.requestButton,
                            { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" },
                          ]}
                        >
                          <Text style={[styles.requestButtonText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                            Huy
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleAcceptRequest(request._id)}
                          style={[
                            styles.requestButton,
                            { backgroundColor: isDark ? "#22c55e" : "#16a34a" },
                          ]}
                        >
                          <Text style={styles.requestButtonTextPrimary}>Chap nhan</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
                <Pressable
                  onPress={() => setShowRequests(false)}
                  style={[styles.modalGhost, { borderColor: isDark ? "#334155" : "#e2e8f0" }]}
                >
                  <Text style={[styles.modalGhostText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                    Dong
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <FriendListModal
        visible={showFriendList}
        onClose={() => setShowFriendList(false)}
        onSelectFriend={(friend) => handleStartChat(friend._id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  headerBackButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  headerIconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12 },
  headerBadge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
  headerBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  messageList: { flex: 1 },
  pinnedContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1000,
    paddingHorizontal: 4,
  },
  messageListContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 },
  loadingMore: { paddingVertical: 10, alignItems: "center" },
  conversationList: { paddingHorizontal: 16, paddingTop: 10 },
  emptyMessages: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 50 },
  headerMeta: {
    fontSize: 13,
    fontWeight: "500",
    marginRight: 12,
  },
  listHeader: {
    gap: 12,
    marginBottom: 8,
  },
  searchRow: {
    borderRadius: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  groupSection: {
    marginTop: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  loaderState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  modalCard: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 26,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  modalScrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  modalPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 12,
  },
  modalPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalGhost: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
  },
  modalGhostText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalHint: {
    fontSize: 13,
  },
  modalHintGroup: {
    gap: 4,
  },
  modalLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  friendRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  friendName: {
    fontSize: 14,
    fontWeight: "700",
  },
  friendMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  requestRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  requestInfo: {
    gap: 2,
  },
  requestName: {
    fontSize: 15,
    fontWeight: "700",
  },
  requestMeta: {
    fontSize: 12,
  },
  requestMessage: {
    fontSize: 13,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  requestButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 8,
  },
  requestButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  requestButtonTextPrimary: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});