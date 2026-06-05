import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { Conversation, ConversationSummary } from "@/types/chat";
import type { Friend } from "@/types/user";
import { Link2, PanelRightClose, PanelRightOpen, Phone, Search, Sparkles, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileModal } from "../createNewChat/ProfileModal";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";
import GroupChatManagementDialog from "./GroupChatManagementDialog";
import { ShareGroupLinkModal } from "./ShareGroupLinkModal";
import StatusBadge from "./StatusBadge";
import UserAvatar from "./UserAvatar";

type Props = {
  chat?: Conversation;
  panelMode?: "none" | "attachments" | "search";
  searchOpen?: boolean;
  autoTranslateEnabled?: boolean;
  onToggleAttachmentsPanel?: () => void;
  onToggleSearchPanel?: () => void;
};

const ChatWindowHeader = ({
  chat,
  panelMode = "none",
  searchOpen = false,
  autoTranslateEnabled = false,
  onToggleAttachmentsPanel,
  onToggleSearchPanel,
}: Props) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const { conversations, activeConversationId } = useChatStore();
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();
  const { currentCall, startOutgoingCall } = useCallStore();

  let otherUser: Conversation["participants"][number] | null = null;
  let profileFriend: Friend | null = null;

  chat = chat ?? conversations.find((conversation) => conversation._id === activeConversationId);

  if (!chat) {
    return (
      <header className="md:hidden sticky top-0 z-10 flex items-center gap-2 px-4 py-2 w-full">
        <SidebarTrigger className="-ml-1 text-foreground" />
      </header>
    );
  }

  if (chat.type === "direct") {
    otherUser = chat.participants.find((participant) => participant._id !== user?._id) ?? null;

    if (!user || !otherUser) {
      return null;
    }

    profileFriend = {
      _id: otherUser._id,
      displayName: otherUser.displayName,
      avatarUrl: otherUser.avatarUrl ?? undefined,
      username: "",
    };
  }

  const canOpenProfile = chat.type === "direct" && !!profileFriend;
  const canOpenGroupManagement = chat.type === "group";

  const handleSummarizeConversation = async () => {
    try {
      setShowSummaryDialog(true);
      setSummaryLoading(true);

      const nextSummary = await chatService.summarizeConversation(chat._id, {
        scope: "recent",
      });
      setSummary(nextSummary);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể tạo tóm tắt bằng Groq");
      setShowSummaryDialog(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 px-4 py-2 flex items-center bg-background">
        <div className="flex items-center gap-2 w-full">
          <SidebarTrigger className="-ml-1 text-foreground" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />

          <button
            type="button"
            onClick={() => {
              if (canOpenProfile) {
                setShowProfile(true);
                return;
              }

              if (canOpenGroupManagement) {
                setShowGroupManagement(true);
              }
            }}
            disabled={!canOpenProfile && !canOpenGroupManagement}
            className={`p-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors ${canOpenProfile || canOpenGroupManagement ? "hover:bg-accent/60 cursor-pointer" : "cursor-default"
              }`}
          >
            <div className="relative shrink-0">
              {chat.type === "direct" && otherUser ? (
                <>
                  <UserAvatar
                    type="sidebar"
                    name={otherUser.displayName || "TACHFEN"}
                    avatarUrl={otherUser.avatarUrl || undefined}
                  />
                  <StatusBadge
                    status={onlineUsers.includes(otherUser._id) ? "online" : "offline"}
                  />
                </>
              ) : (
                <UserAvatar
                  type="sidebar"
                  name={chat.group?.name || "Nhóm chat"}
                  avatarUrl={chat.group?.avatar || undefined}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-foreground">
                {chat.type === "direct" ? otherUser?.displayName : chat.group?.name}
              </h2>
              {autoTranslateEnabled && (
                <span className="mt-0.5 inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                  Auto Translate ON
                </span>
              )}
            </div>
          </button>

          {chat.type === "direct" && otherUser ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => void startOutgoingCall(chat, "audio")}
                disabled={Boolean(currentCall)}
              >
                <Phone className="size-4" />
                <span className="sr-only">Gọi thoại</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => void startOutgoingCall(chat, "video")}
                disabled={Boolean(currentCall)}
              >
                <Video className="size-4" />
                <span className="sr-only">Gọi video</span>
              </Button>
            </div>
          ) : chat.type === "group" ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => void startOutgoingCall(chat, "video")}
                disabled={Boolean(currentCall)}
              >
                <Video className="size-4" />
                <span className="sr-only">Gọi video nhóm</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setShowShareLink(true)}
                title="Chia sẻ nhóm"
              >
                <Link2 className="size-4" />
                <span className="sr-only">Chia sẻ nhóm</span>
              </Button>
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void handleSummarizeConversation()}
            className="shrink-0 rounded-full"
            title="Tóm tắt bằng AI"
            disabled={summaryLoading}
          >
            <Sparkles className="size-4" />
            <span className="sr-only">Tóm tắt bằng AI</span>
          </Button>

          <Button
            type="button"
            variant={searchOpen ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => onToggleSearchPanel?.()}
            className="shrink-0 rounded-full"
          >
            <Search className="size-4" />
            <span className="sr-only">Toggle search panel</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleAttachmentsPanel?.()}
            className="shrink-0 rounded-full"
          >
            {panelMode === "attachments" ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
            <span className="sr-only">Toggle attachments panel</span>
          </Button>
        </div>
      </header>

      <ProfileModal
        friend={profileFriend}
        open={showProfile}
        onOpenChange={setShowProfile}
      />

      {chat.type === "group" ? (
        <>
          <GroupChatManagementDialog
            conversation={chat}
            open={showGroupManagement}
            onOpenChange={setShowGroupManagement}
          />
          <ShareGroupLinkModal
            isOpen={showShareLink}
            onClose={() => setShowShareLink(false)}
            conversation={chat}
          />
        </>
      ) : null}

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-xl rounded-3xl border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-sm">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="size-5 text-primary" />
              Tóm tắt bằng Groq
            </DialogTitle>
            <DialogDescription>
              Tóm tắt nhanh các tin nhắn gần đây trong cuộc trò chuyện hiện tại.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {summaryLoading ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
                Groq đang đọc hội thoại và tạo tóm tắt...
              </div>
            ) : summary ? (
              <>
                <div className="rounded-2xl bg-muted/40 px-4 py-4">
                  <p className="text-sm font-medium text-foreground">Tóm tắt</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {summary.summary}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Mô hình: {summary.model || summary.provider} • {summary.messageCount} tin nhắn gần nhất
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-2xl border border-border/70 px-4 py-4">
                    <h3 className="text-sm font-semibold text-foreground">Ý chính</h3>
                    {summary.bullets.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {summary.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2">
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Chưa có ý chính riêng để hiển thị.</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-border/70 px-4 py-4">
                    <h3 className="text-sm font-semibold text-foreground">Việc cần theo dõi</h3>
                    {summary.actionItems.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {summary.actionItems.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Không có mục hành động nổi bật.</p>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
                Chưa có dữ liệu tóm tắt.
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSummarizeConversation()}
                disabled={summaryLoading}
                className="rounded-2xl"
              >
                Tạo lại tóm tắt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatWindowHeader;
