import ChatCard from "@/components/chat/ChatCard";
import MessageInput from "@/components/chat/MessageInput";
import MessageItem from "@/components/chat/MessageItem";
import type { RootTabParamList } from "@/navigation/AppNavigator";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message } from "@/types/chat";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ChevronLeft, MessageCircleMore } from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
    if (seen.has(item._id)) {
      return false;
    }

    seen.add(item._id);
    return true;
  });
};

const getConversationTitle = (
  conversation: Conversation,
  currentUserId?: string
) => {
  if (conversation.type === "group") {
    return conversation.group?.name || "Nhom chat";
  }

  return (
    conversation.participants.find((participant) => participant._id !== currentUserId)
      ?.displayName || "Tin nhan"
  );
};

export default function ChatAppScreen() {
  const navigation = useNavigation<ChatNavigation>();
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList<Message>>(null);

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
  } = useChatStore();

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const sortedConversations = useMemo(
    () =>
      uniqueById(conversations).sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      ),
    [conversations]
  );

  const selectedConvo =
    sortedConversations.find((conversation) => conversation._id === activeConversationId) ??
    null;

  const messageItems = useMemo(
    () =>
      selectedConvo
        ? uniqueById(messages[selectedConvo._id]?.items ?? [])
        : [],
    [messages, selectedConvo]
  );

  const hasMoreMessages = selectedConvo
    ? messages[selectedConvo._id]?.hasMore ?? false
    : false;

  const latestMessageId = messageItems[messageItems.length - 1]?._id;

  const lastMessageStatus: "delivered" | "seen" =
    (selectedConvo?.seenBy?.length ?? 0) > 0 ? "seen" : "delivered";

  const handleBack = useCallback(() => {
    setActiveConversation(null);
  }, [setActiveConversation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: selectedConvo
        ? getConversationTitle(selectedConvo, user?._id)
        : "Chat",
      headerLeft: selectedConvo
        ? () => (
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
          )
        : undefined,
      headerRight: selectedConvo
        ? () => (
            <Text
              style={[
                styles.headerMeta,
                { color: isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              {selectedConvo.type === "group"
                ? `${selectedConvo.participants.length} thanh vien`
                : "Cuộc trò chuyện"}
            </Text>
          )
        : undefined,
    });
  }, [handleBack, isDark, navigation, selectedConvo, user?._id]);

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

  const handleSelectConversation = async (conversationId: string) => {
    setActiveConversation(conversationId);

    if (!messages[conversationId]) {
      await fetchMessages(conversationId);
    }
  };

  const handleMessageScroll = async (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (!selectedConvo || !hasMoreMessages || messageLoading) {
      return;
    }

    if (event.nativeEvent.contentOffset.y <= TOP_LOAD_THRESHOLD) {
      await fetchMessages(selectedConvo._id);
    }
  };

  if (selectedConvo) {
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
              previousMessage={index > 0 ? messageItems[index - 1] : undefined}
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

  return (
    <SafeAreaView
      style={[
        styles.screen,
        { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
      ]}
      edges={["left", "right"]}
    >
      {convoLoading ? (
        <View style={styles.loaderState}>
          <ActivityIndicator
            size="large"
            color={isDark ? "#c084fc" : "#8b5cf6"}
          />
          <Text style={[styles.emptyText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
            Đang tải danh sách hội thoại...
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedConversations}
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
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  conversationList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
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
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  headerMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginRight: 14,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
  },
  emptyMessages: {
    paddingTop: 48,
    alignItems: "center",
  },
  loadingMore: {
    alignItems: "center",
    paddingBottom: 12,
  },
});
