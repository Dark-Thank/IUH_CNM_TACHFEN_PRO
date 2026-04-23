import { useState } from "react";
import { PanelRightClose, PanelRightOpen, Phone, Video, Link2 } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { Conversation } from "@/types/chat";
import type { Friend } from "@/types/user";
import { ProfileModal } from "../createNewChat/ProfileModal";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";
import GroupChatManagementDialog from "./GroupChatManagementDialog";
import StatusBadge from "./StatusBadge";
import UserAvatar from "./UserAvatar";
import { ShareGroupLinkModal } from "./ShareGroupLinkModal";

type Props = {
  chat?: Conversation;
  attachmentsOpen?: boolean;
  onToggleAttachmentsPanel?: () => void;
};

const ChatWindowHeader = ({
  chat,
  attachmentsOpen = false,
  onToggleAttachmentsPanel,
}: Props) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
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
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleAttachmentsPanel?.()}
            className="shrink-0 rounded-full"
          >
            {attachmentsOpen ? (
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
    </>
  );
};

export default ChatWindowHeader;
