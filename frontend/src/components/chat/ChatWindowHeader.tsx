import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { Conversation } from "@/types/chat";
import type { Friend } from "@/types/user";
import { ProfileModal } from "../createNewChat/ProfileModal";
import { Button } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";
import { Separator } from "../ui/separator";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import GroupChatAvatar from "./GroupChatAvatar";

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
  const { conversations, activeConversationId } = useChatStore();
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();

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
              }
            }}
            disabled={!canOpenProfile}
            className={`p-2 w-full flex items-center gap-3 rounded-xl text-left transition-colors ${
              canOpenProfile ? "hover:bg-accent/60 cursor-pointer" : "cursor-default"
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
                <GroupChatAvatar participants={chat.participants} type="sidebar" />
              )}
            </div>

            <h2 className="font-semibold text-foreground truncate">
              {chat.type === "direct" ? otherUser?.displayName : chat.group?.name}
            </h2>
          </button>

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
    </>
  );
};

export default ChatWindowHeader;
