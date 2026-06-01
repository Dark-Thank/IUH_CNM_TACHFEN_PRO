import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { friendService } from "@/services/friendService";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import { MessageCircleMore, MoreVertical, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import UserAvatar from "../chat/UserAvatar";
import { Card } from "../ui/card";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface FriendListModalProps {
  onSelectFriend: (friend: Friend) => void;
  onClose?: () => void;
}

const FriendListModal = ({ onSelectFriend, onClose }: FriendListModalProps) => {
  const { friends, removeFriend } = useFriendStore();
const {
  createConversation,
  setActiveConversation,
  fetchMessages,
} = useChatStore();  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  // const [allBlockedUsers, setAllBlockedUsers] = useState<Friend[]>([]);
  const [activeTab, setActiveTab] = useState("friends");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check block status for all friends on load
  useEffect(() => {
  const checkAllStatus = async () => {
    const blockStatuses = await Promise.all(
      friends.map(async (friend) => {
        const isBlocked = await friendService.checkBlockStatus(friend._id);
        return isBlocked ? friend._id : null;
      })
    );
    
    const blockedIds = blockStatuses.filter((id): id is string => id !== null);
    setBlockedUsers(new Set(blockedIds));
  };

  if (friends.length > 0) {
    checkAllStatus();
  }
}, [friends]);

const handleAddConversation = async (friendId: string) => {
  // Check if friend is blocked before allowing conversation
  if (blockedUsers.has(friendId)) {
    alert("Bạn không thể nhắn tin với người dùng này vì đã bị chặn");
    return;
  }

  try {
    // tạo hoặc lấy conversation cũ
    const conversation = await createConversation(
      "direct",
      "",
      [friendId]
    );

    if (!conversation) return;

    // set conversation active
    setActiveConversation(conversation._id);

    // load lịch sử tin nhắn
    await fetchMessages(conversation._id);

    // đóng modal
    onClose?.();

  } catch (error) {
    console.error("Lỗi tạo cuộc trò chuyện:", error);
  }
};

  const handleRemoveFriend = async (friendId: string, displayName: string) => {
    const confirmed = window.confirm(`Xác nhận xóa bạn ${displayName}?`);
    if (confirmed) {
      try {
        await removeFriend(friendId);
        setOpenDropdownId(null);
      } catch (error) {
        console.error("Lỗi xóa bạn:", error);
      }
    }
  };

  const handleToggleBlock = async (friendId: string, displayName: string) => {
    try {
      const isBlocked = blockedUsers.has(friendId);
      
      if (isBlocked) {
        await friendService.unblockFriend(friendId);
        setBlockedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(friendId);
          return newSet;
        });
// setAllBlockedUsers(prev => prev.filter(u => u._id !== friendId));
        toast.success(`Đã bỏ chặn ${displayName}`);
      } else {
        await friendService.blockFriend(friendId);
        setBlockedUsers(prev => new Set([...prev, friendId]));
        toast.success(`Đã chặn ${displayName}`);
      }
      
      setOpenDropdownId(null);
    } catch (error) {
      console.error("Lỗi khi thay đổi trạng thái chặn:", error);
      toast.error("Không thể thay đổi trạng thái chặn");
    }
  };

  // const handleUnblockFromList = async (userId: string, displayName: string) => {
    //   try {
    //     await friendService.unblockFriend(userId);
    //     setBlockedUsers(prev => {
    //       const newSet = new Set(prev);
    //       newSet.delete(userId);
    //       return newSet;
    //     });
    //     setAllBlockedUsers(prev => prev.filter(u => u._id !== userId));
    //     toast.success(`Đã bỏ chặn ${displayName}`);
    //   } catch (error) {
    //     console.error("Lỗi khi bỏ chặn:", error);
    //     toast.error("Không thể bỏ chặn");
    //   }
    // };

  // Nhóm bạn bè theo chữ cái đầu
  const groupedFriends = friends
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'))
    .reduce((groups: Record<string, Friend[]>, friend) => {
      const firstLetter = friend.displayName.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(friend);
      return groups;
    }, {});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdownId]);

  return (
    <DialogContent className="glass max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl capitalize">
          <MessageCircleMore className="size-5" />
          bắt đầu hội thoại mới
        </DialogTitle>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="friends">Bạn bè</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          {/* friends list */}
          <div className="space-y-4">
            <h1 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              danh sách bạn bè
            </h1>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(groupedFriends).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="size-12 mx-auto mb-3 opacity-50" />
                  Chưa có bạn bè. Thêm bạn vô để tám!
                </div>
              ) : (
                Object.entries(groupedFriends).map(([letter, friendsInGroup]) => (
                  <div key={letter}>
                    {/* Letter header */}
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      {letter}
                    </h3>

                    {/* Friends in this group */}
                    <div className="space-y-2">
                      {friendsInGroup.map((friend) => (
                    <Card
                      key={friend._id}
                      className={`p-3 transition-smooth hover:shadow-soft glass flex flex-row items-center gap-3 w-full ${
                        blockedUsers.has(friend._id) 
                          ? "opacity-60 hover:bg-muted/20" 
                          : "hover:bg-muted/30"
                      }`}
                    >
                      {/* avatar */}
                      <div 
                        className={`w-10 h-10 flex-shrink-0 ${
                          blockedUsers.has(friend._id) ? "" : "cursor-pointer"
                        }`}
                        onClick={() =>  handleAddConversation(friend._id)}
                      >
                        <UserAvatar
                          type="sidebar"
                          name={friend.displayName}
                          avatarUrl={friend.avatarUrl}
                        />
                      </div>

                      {/* info */}
                      <div 
                        className={`flex-1 min-w-0 flex flex-col justify-center ${
                          blockedUsers.has(friend._id) ? "" : "cursor-pointer"
                        }`}
                        onClick={() =>  handleAddConversation(friend._id)}
                      >
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-sm truncate">
                            {friend.displayName}
                          </h2>
                          {blockedUsers.has(friend._id) && (
                            <span className="text-xs px-2 py-0.5 bg-destructive/20 text-destructive rounded">
                              Đã chặn
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground truncate">
                          @{friend.username}
                        </span>
                      </div>

                      {/* more options menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent">
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="cursor-pointer hover:bg-accent/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectFriend(friend);
                              onClose?.();
                            }}
                          >
                            Xem profile
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="cursor-pointer hover:bg-accent/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBlock(friend._id, friend.displayName);
                            }}
                          >
                            {blockedUsers.has(friend._id) ? "Bỏ chặn" : "Chặn"}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer hover:bg-destructive/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFriend(friend._id, friend.displayName);
                            }}
                          >
                            Xóa bạn
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Card>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* No blocked tab - removed as requested */}
      </Tabs>
    </DialogContent>
  );
};

export default FriendListModal;