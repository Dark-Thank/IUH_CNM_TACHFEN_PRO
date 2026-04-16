import { Pin, ChevronDown, MessageCircle } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Message } from "@/types/chat";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useState } from "react";

interface PinnedSectionProps {
  pinnedMessages: Message[];
  onJump: (id: string) => void;
}

export default function PinnedSection({ pinnedMessages, onJump }: PinnedSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  // useChatStore không còn được dùng trực tiếp ở đây nhưng vẫn nên giữ import cho tương lai
  const togglePinMessage = useChatStore((state) => state.togglePinMessage);
  const { isDark } = useThemeStore();

  if (pinnedMessages.length === 0) return null;

  // Lấy tin nhắn được ghim mới nhất để hiển thị
  const latestPinnedMessage = pinnedMessages[pinnedMessages.length - 1];

  // Định dạng thời gian cho tin nhắn
  const formattedTime = new Date(latestPinnedMessage.createdAt).toLocaleTimeString('vi-VN', { 
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

      {/* Ô CHI TIẾT TIN NHẮN (Hiển thị khi mở ra, giống hệt ảnh bạn vừa gửi) */}
      {isOpen && latestPinnedMessage && (
        <View style={[styles.detailDropdown, { backgroundColor: isDark ? "#1e2937" : "#ffffff" }]}>
          <Pressable 
            style={styles.messageDetailContainer} 
            onPress={() => onJump(latestPinnedMessage._id)}
          >
            {/* Avatar/Icon đại diện cho tin nhắn */}
            <View style={[styles.messageAvatar, { backgroundColor: isDark ? "#374151" : "#eef2ff" }]}>
              <MessageCircle size={18} color={isDark ? "#c084fc" : "#8b5cf6"} />
            </View>

            {/* Nội dung và thời gian tin nhắn */}
            <View style={styles.messageTextContainer}>
              <Text 
                style={[styles.messageContent, { color: isDark ? "#f8fafc" : "#1e2937" }]} 
                numberOfLines={1}
              >
                {latestPinnedMessage.content || "[Hình ảnh]"}
              </Text>
              <Text style={[styles.messageTime, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                {formattedTime}
              </Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 10,
    zIndex: 100, // Đảm bảo thanh ghim luôn nằm trên các tin nhắn khác
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25, // Tạo hình viên thuốc
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 8,
  },
  detailDropdown: {
    marginTop: 4,
    borderRadius: 15, // Bo góc cho khung chi tiết
    borderWidth: 1, // Thêm khung viền giống ảnh
    borderColor: "#e2e8f0",
    overflow: "hidden", // Đảm bảo nội dung không tràn khỏi góc bo
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  messageDetailContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12, // Khoảng cách bên trong giống ảnh
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18, // Tạo hình tròn cho avatar
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12, // Khoảng cách với phần chữ
  },
  messageTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  messageContent: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2, // Khoảng cách với dòng thời gian
  },
  messageTime: {
    fontSize: 12,
  },
});