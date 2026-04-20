import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Message } from "@/types/chat";
import { ChevronDown, MessageCircle, Pin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const getPinnedPreview = (message: Message) => {
  if (message.messageType === "voice") {
    return "Tin nhắn thoại";
  }

  if ((message.content ?? "").trim()) {
    return message.content;
  }

  if (message.imgUrls?.length) {
    return "[Hình ảnh]";
  }

  return "[Tệp]";
};

interface PinnedSectionProps {
  pinnedMessages: Message[];
  onJump: (id: string) => void;
}

export default function PinnedSection({ pinnedMessages, onJump }: PinnedSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { togglePinMessage } = useChatStore();
  const { isDark } = useThemeStore();

  if (pinnedMessages.length === 0) return null;

  // Sort pinned messages by pinnedAt (newest first)
  const sortedPinned = [...pinnedMessages].sort((a, b) => 
    new Date(b.pinnedAt || b.createdAt).getTime() - new Date(a.pinnedAt || a.createdAt).getTime()
  );

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('vi-VN', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });

  return (
    <View style={styles.container}>
      {/* THANH GHIM CHÍNH (Giữ nguyên màu tím và icon trắng giống ảnh bạn gửi trước đó) */}
      <Pressable 
        style={[
          styles.header, 
          { backgroundColor: isDark ? "#4c1d95" : "#a78bfa" }
        ]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Pin size={18} color="#ffffff" />
        <Text style={styles.headerText}>
          Tin nhắn đã ghim ({pinnedMessages.length})
        </Text>
        <ChevronDown 
          size={20} 
          color="#ffffff"
          style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} 
        />
      </Pressable>

      {/* 🔥 ALL PINNED MESSAGES LIST */}
      {isOpen && (
        <View style={[styles.pinnedListContainer, { backgroundColor: isDark ? "#1e2937" : "#ffffff" }]}>
          <Text style={[styles.pinnedListTitle, { color: isDark ? "#f8fafc" : "#1e2937" }]}>
            Tin nhắn đã ghim ({sortedPinned.length})
          </Text>
          <ScrollView style={styles.pinnedScroll} nestedScrollEnabled>
            {sortedPinned.map((msg) => (
              <View key={msg._id} style={styles.pinnedItem}>
                {/* Preview */}
                <Pressable 
                  style={styles.pinnedPreview}
                  onPress={() => onJump(msg._id)}
                >
                  <View style={[styles.miniAvatar, { backgroundColor: isDark ? "#374151" : "#eef2ff" }]}>
                    <MessageCircle size={16} color={isDark ? "#c084fc" : "#8b5cf6"} />
                  </View>
                  <View style={styles.previewText}>
                    <Text 
                      style={[styles.previewContent, { color: isDark ? "#f8fafc" : "#1e2937" }]} 
                      numberOfLines={1}
                    >
                      {getPinnedPreview(msg)}
                    </Text>
                    <Text style={[styles.previewTime, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                      {formatTime(msg.createdAt)}
                    </Text>
                  </View>
                </Pressable>
                
                {/* UNPIN BUTTON */}
                <Pressable 
                  style={styles.unpinButton}
                  onPress={() => {
                    togglePinMessage(msg._id);
                    setIsOpen(false); // Collapse after unpin
                  }}
                >
                  <Text style={styles.unpinText}>Bỏ ghim</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 10,
    zIndex: 1000, // 🔥 Sticky on top always
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },     // Stronger drop shadow
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,                               // 🔥 Sticky shadow effect
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 8,
  },
  pinnedListContainer: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxHeight: 300, // Limit height
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  pinnedListTitle: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  pinnedScroll: {
    maxHeight: 240,
  },
  pinnedItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pinnedPreview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  previewText: {
    flex: 1,
  },
  previewContent: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  previewTime: {
    fontSize: 12,
  },
  unpinButton: {
    width: 60,
    height: 22,
    borderRadius: 5,
    backgroundColor: "#afa9cf",
    alignItems: "center",
    justifyContent: "center",
  },
  unpinText: {
    fontSize: 12,
    fontWeight: "500",
    fontStyle: "italic",
    color: "#dc2626",
  },
})
