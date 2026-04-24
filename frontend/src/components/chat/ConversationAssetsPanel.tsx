import { useMemo } from "react";
import { Download, FileText, ImageIcon } from "lucide-react";
import { chatService } from "@/services/chatServiec";
import type { Message, Conversation } from "@/types/chat";
import ConversationSettings from "./ConversationSettings";

type Props = {

  messages: Message[];
  conversation: Conversation;
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
    year: "numeric",
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

const ConversationAssetsPanel = ({ messages, conversation }: Props) => {
  console.log("conversation:", conversation);
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [messages]
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

  const handleDownloadFile = async (entry: FileEntry) => {
    try {
      await chatService.downloadMessageFile(
        entry.messageId,
        entry.fileIndex,
        entry.file.name
      );
    } catch (error) {
      console.error("Khong the tai tep dinh kem:", error);
    }
  };

  return (
    <aside className="w-[320px] shrink-0 border-l bg-background/95 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-4">
          <h3 className="text-sm font-semibold text-foreground">Tệp và hình ảnh</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Xem nhanh các tệp và hình ảnh trong cuộc trò chuyện hiện tại.
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <ConversationSettings conversation={conversation} />
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">
                Hình ảnh gần đây ({images.length})
              </h4>
            </div>

            {images.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                Chưa có hình ảnh nào trong dữ liệu đã tải.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {images.map((image) => (
                  <div
                    key={`${image.url}-${image.createdAt}`}
                    className="rounded-xl border bg-card p-2 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => window.open(image.url, "_blank", "noopener,noreferrer")}
                      className="w-full overflow-hidden rounded-lg"
                    >
                      <img
                        src={image.url}
                        alt="Conversation attachment"
                        className="h-24 w-full rounded-lg object-cover transition-transform hover:scale-[1.02]"
                      />
                    </button>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {formatAttachmentDate(image.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">
                Tệp gần đây ({files.length})
              </h4>
            </div>

            {files.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                Chưa có tệp nào trong dữ liệu đã tải.
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((entry) => (
                  <div
                    key={`${entry.file.url}-${entry.createdAt}`}
                    className="rounded-xl border bg-card p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {entry.file.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.file.type || "Không rõ định dạng"}
                          {formatFileSize(entry.file.size)
                            ? ` - ${formatFileSize(entry.file.size)}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatAttachmentDate(entry.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDownloadFile(entry)}
                        className="inline-flex size-9 items-center justify-center rounded-full border bg-background text-foreground transition-colors hover:bg-accent"
                      >
                        <Download className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
};

export default ConversationAssetsPanel;
