import ChatCard from "@/components/chat/ChatCard";
import MessageInput from "@/components/chat/MessageInput";
import MessageItem from "@/components/chat/MessageItem";
import PinnedSection from "@/components/chat/PinnedSection";
import type { RootTabParamList } from "@/navigation/AppNavigator";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message } from "@/types/chat";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Bell, ChevronLeft } from "lucide-react-native";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
  const navigation = useNavigation<ChatNavigation>();
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const { receivedList } = useFriendStore();
  const flatListRef = useRef<FlatList<Message>>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    activeConversationId,
    conversations,
    messages,
    messageLoading,
    setActiveConversation,
    fetchConversations,
    fetchMessages,
  } = useChatStore();

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: selectedConvo ? getConversationTitle(selectedConvo, user?._id) : "Đoạn chat",
      headerLeft: selectedConvo
        ? () => (
            <Pressable onPress={handleBack} style={[styles.headerBackButton, { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" }]}>
              <ChevronLeft size={20} color={isDark ? "#f8fafc" : "#0f172a"} />
            </Pressable>
          )
        : undefined,
      headerRight: !selectedConvo ? () => (
        <Pressable onPress={() => setShowRequests(true)} style={[styles.headerIconButton, { backgroundColor: isDark ? "#1f2937" : "#eef2ff" }]}>
          <Bell size={18} color={isDark ? "#4f46e5" : "#4f46e5"} />
          {receivedList.length > 0 && (
            <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{receivedList.length}</Text></View>
          )}
        </Pressable>
      ) : undefined,
    });
  }, [handleBack, isDark, navigation, receivedList.length, selectedConvo, user?._id]);

  // MÀN HÌNH CHI TIẾT CHAT
  if (selectedConvo) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]} edges={["left", "right"]}>
        <KeyboardAvoidingView style={styles.keyboardAvoiding} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
          <FlatList
            ref={flatListRef}
            data={messageItems}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messageListContent}
            onScroll={handleMessageScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={() => (
              <>
                {messageLoading && hasMoreMessages && (
                  <View style={styles.loadingMore}><ActivityIndicator size="small" color="#8b5cf6" /></View>
                )}
                {pinnedMessages.length > 0 && (
                  <PinnedSection 
                    pinnedMessages={pinnedMessages} 
                    onJump={(id) => {
                      const index = messageItems.findIndex(m => m._id === id);
                      if (index !== -1) flatListRef.current?.scrollToIndex({ index, animated: true });
                    }} 
                  />
                )}
              </>
            )}
            renderItem={({ item, index }) => (
              <MessageItem
                message={item}
                index={index}
                messages={messageItems}
                selectedConvo={selectedConvo}
                lastMessageStatus={lastMessageStatus}
              />
            )}
          />
          <MessageInput selectedConvo={selectedConvo} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // FIX LỖI 2: "Expression expected"
  // MÀN HÌNH DANH SÁCH CÁC CUỘC HỘI THOẠI
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}>
      <FlatList
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
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Chưa có cuộc hội thoại nào.</Text>
          </View>
        }
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
  messageListContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 },
  loadingMore: { paddingVertical: 10, alignItems: "center" },
  conversationList: { paddingHorizontal: 16, paddingTop: 10 },
  emptyMessages: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 50 },
});