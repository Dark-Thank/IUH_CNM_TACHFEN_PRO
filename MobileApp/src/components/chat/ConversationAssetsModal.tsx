import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { chatService } from "@/services/chatServiec";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Message } from "@/types/chat";

type Props = {
  visible: boolean;
  messages: Message[];
  onClose: () => void;
};

type FileEntry = {
  messageId: string;
  fileIndex: number;
  createdAt: string;
  file: NonNullable<Message["fileUrls"]>[number];
};

type ImageEntry = {
  messageId: string;
  imageIndex: number;
  createdAt: string;
  url: string;
};

const RECENT_ASSETS_LIMIT = 6;

const formatAttachmentDate = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) {
    return null;
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ConversationAssetsModal({
  visible,
  messages,
  onClose,
}: Props) {
  const { isDark } = useThemeStore();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [messages]
  );

  const images = useMemo<ImageEntry[]>(
    () =>
      sortedMessages
        .flatMap((message) =>
          (message.imgUrls ?? []).map((url, imageIndex) => ({
            messageId: message._id,
            imageIndex,
            createdAt: message.createdAt,
            url,
          }))
        )
        .slice(0, RECENT_ASSETS_LIMIT),
    [sortedMessages]
  );

  const files = useMemo<FileEntry[]>(
    () =>
      sortedMessages
        .flatMap((message) =>
          (message.fileUrls ?? []).map((file, fileIndex) => ({
            messageId: message._id,
            fileIndex,
            createdAt: message.createdAt,
            file,
          }))
        )
        .slice(0, RECENT_ASSETS_LIMIT),
    [sortedMessages]
  );

  const handleDownloadFile = async (entry: FileEntry) => {
    try {
      await chatService.downloadMessageFile(
        entry.messageId,
        entry.fileIndex,
        entry.file.name,
        entry.file.type
      );
    } catch (error) {
      console.error("Loi khi tai tep dinh kem:", error);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />

          <View
            style={[
              styles.container,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.header}>
              <View>
                <Text style={[styles.title, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Tep va Hinh anh
                </Text>
                <Text style={[styles.subtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  Cac attachment trong cuoc tro chuyen hien tai
                </Text>
              </View>

              <Pressable
                onPress={onClose}
                style={[
                  styles.closeButton,
                  { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" },
                ]}
              >
                <X size={18} color={isDark ? "#f8fafc" : "#0f172a"} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Hinh anh gan day ({images.length})
                </Text>

                {images.length === 0 ? (
                  <View
                    style={[
                      styles.emptyCard,
                      { borderColor: isDark ? "#334155" : "#e2e8f0" },
                    ]}
                  >
                    <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                      Chua co hinh anh nao trong du lieu da tai.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {images.map((image) => (
                      <Pressable
                        key={`${image.messageId}-${image.imageIndex}`}
                        onPress={() => setPreviewImage(image.url)}
                        style={[
                          styles.imageCard,
                          {
                            backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                            borderColor: isDark ? "#1f2937" : "#e2e8f0",
                          },
                        ]}
                      >
                        <Image source={{ uri: image.url }} style={styles.imagePreview} />
                        <Text
                          style={[
                            styles.cardMeta,
                            { color: isDark ? "#94a3b8" : "#64748b" },
                          ]}
                        >
                          {formatAttachmentDate(image.createdAt)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  Tep gan day ({files.length})
                </Text>

                {files.length === 0 ? (
                  <View
                    style={[
                      styles.emptyCard,
                      { borderColor: isDark ? "#334155" : "#e2e8f0" },
                    ]}
                  >
                    <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                      Chua co tep nao trong du lieu da tai.
                    </Text>
                  </View>
                ) : (
                  files.map((entry) => (
                    <Pressable
                      key={`${entry.messageId}-${entry.fileIndex}`}
                      onPress={() => void handleDownloadFile(entry)}
                      style={[
                        styles.fileCard,
                        {
                          backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                          borderColor: isDark ? "#1f2937" : "#e2e8f0",
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.fileName, { color: isDark ? "#f8fafc" : "#0f172a" }]}
                      >
                        {entry.file.name}
                      </Text>
                      <Text
                        style={[
                          styles.cardMeta,
                          { color: isDark ? "#94a3b8" : "#64748b" },
                        ]}
                      >
                        {entry.file.type || "Khong ro dinh dang"}
                        {formatFileSize(entry.file.size)
                          ? ` - ${formatFileSize(entry.file.size)}`
                          : ""}
                      </Text>
                      <Text
                        style={[
                          styles.cardMeta,
                          { color: isDark ? "#94a3b8" : "#64748b" },
                        ]}
                      >
                        {formatAttachmentDate(entry.createdAt)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewImage(null)}>
          <Image
            source={{ uri: previewImage ?? "" }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  container: {
    maxHeight: "82%",
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  imageCard: {
    width: "31%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 6,
    gap: 6,
  },
  imagePreview: {
    width: "100%",
    height: 84,
    borderRadius: 12,
  },
  fileCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
});
