import { useAuthStore } from '@/stores/useAuthStore';
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { Conversation } from '@/types/chat';
import { Phone, Video } from "lucide-react";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from '../ui/sidebar';
import GroupChatAvatar from "./GroupChatAvatar";
import StatusBadge from "./StatusBadge";
import UserAvatar from "./UserAvatar";

const ChatWindowHeader = ({ chat }: { chat?: Conversation }) => {
    const { conversations, activeConversationId } = useChatStore();
    const { user } = useAuthStore();
    const { onlineUsers } = useSocketStore();
    const { currentCall, startOutgoingCall } = useCallStore();
    let otherUser;

    chat = chat ?? conversations.find((c) => c._id === activeConversationId);

    if (!chat) {
        return (
            <header className="md:hidden sticky top-0 z-10 flex items-center gap-2 px-4 py-2 w-full">
                <SidebarTrigger className="-ml-1 text-foreground" />
            </header>
        );
    }

    if (chat.type === "direct") {
        const otherUsers = chat.participants.filter((p) => p._id !== user?._id);
        otherUser = otherUsers.length > 0 ? otherUsers[0] : null;

        if (!user || !otherUser) return;
    }

    return (
        <header className="sticky top-0 z-10 px-4 py-2 flex items-center bg-background">
            <div className="flex items-center gap-2 w-full">
                <SidebarTrigger className="-ml-1 text-foreground" />
                <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                />

                <div className="p-2 w-full flex items-center gap-3">
                    {/* avatar */}
                    <div className="relative">
                        {chat.type === "direct" ? (
                            <>
                                <UserAvatar
                                    type={"sidebar"}
                                    name={otherUser?.displayName || "Moji"}
                                    avatarUrl={otherUser?.avatarUrl || undefined}
                                />
                                {/* todo: socket io */}
                                <StatusBadge
                                    status={
                                        onlineUsers.includes(otherUser?._id ?? "") ? "online" : "offline"
                                    }
                                />
                            </>
                        ) : (
                            <GroupChatAvatar
                                participants={chat.participants}
                                type="sidebar"
                            />
                        )}
                    </div>

                    {/* name */}
                    <div className="flex w-full items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="truncate font-semibold text-foreground">
                                {chat.type === "direct" ? otherUser?.displayName : chat.group?.name}
                            </h2>
                        </div>

                        {((chat.type === "direct" && otherUser) || chat.type === "group") && (
                            <div className="flex items-center gap-2">
                                {chat.type === "direct" && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full"
                                        onClick={() => void startOutgoingCall(chat, "audio")}
                                        disabled={Boolean(currentCall)}
                                    >
                                        <Phone className="size-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full"
                                    onClick={() => void startOutgoingCall(chat, "video")}
                                    disabled={Boolean(currentCall)}
                                >
                                    <Video className="size-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}

export default ChatWindowHeader