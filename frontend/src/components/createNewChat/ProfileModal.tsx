import { friendService } from "@/services/friendService";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import { Calendar, Mail, Phone, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import UserAvatar from "../chat/UserAvatar";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface ProfileModalProps {
  friend: Friend | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileModal = ({ 
  friend, 
  open, 
  onOpenChange 
}: ProfileModalProps) => {
  const { createConversation } = useChatStore();
  const { removeFriend } = useFriendStore();
  const [fullUserData, setFullUserData] = useState<Friend | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (friend && open) {
      setIsLoading(true);
      Promise.all([
        friendService.getUserById(friend._id),
        friendService.checkBlockStatus(friend._id)
      ])
        .then(([userData, blockStatus]) => {
          setFullUserData(userData);
          setIsBlocked(blockStatus);
        })
        .catch(error => {
          console.error("Lỗi khi lấy thông tin user:", error);
          setFullUserData(friend);
        })
        .finally(() => setIsLoading(false));
    }
  }, [friend, open]);

  const displayUser = fullUserData || friend;

  const handleAddConversation = async (friendId: string) => {
    if (isBlocked) {
      toast.error("Bạn không thể nhắn tin với người dùng này vì đã bị chặn");
      return;
    }
    await createConversation("direct", "", [friendId]);
    onOpenChange(false);
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa bạn này?")) {
      await removeFriend(friendId);
      onOpenChange(false);
    }
  };

  const handleToggleBlock = async (friendId: string) => {
    try {
      setIsLoading(true);
      if (isBlocked) {
        await friendService.unblockFriend(friendId);
        toast.success("Đã bỏ chặn bạn này");
      } else {
        await friendService.blockFriend(friendId);
        toast.success("Bạn đã chặn người này. Không thể gửi tin nhắn.");
      }
      const newStatus = await friendService.checkBlockStatus(friendId);
      setIsBlocked(newStatus);
    } catch (error) {
      console.error("Lỗi khi thay đổi trạng thái chặn:", error);
      toast.error("Không thể thay đổi trạng thái chặn");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>

        {friend && (
          <div className="space-y-6">
            {/* cover image placeholder */}
            <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-lg" />

            {/* user info section */}
            <div className="px-4 -mt-12 relative z-10">
              {/* avatar and name */}
              <div className="flex items-end gap-4 mb-6">
                <UserAvatar
                  type="profile"
                  name={displayUser?.displayName || ''}
                  avatarUrl={displayUser?.avatarUrl}
                  className="ring-4 ring-background shadow-lg"
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{displayUser?.displayName}</h2>
                  <p className="text-muted-foreground">@{displayUser?.username}</p>
                </div>
              </div>

              {/* personal info section */}
              <div className="space-y-3 bg-muted/30 rounded-lg p-4">
                {/* bio */}
                {displayUser?.bio && (
                  <div className="flex gap-3 items-start">
                    <User className="size-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Tiểu sử</p>
                      <p className="text-sm">{displayUser.bio}</p>
                    </div>
                  </div>
                )}

                {/* email */}
                {displayUser?.email && (
                  <div className="flex gap-3 items-center">
                    <Mail className="size-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                      <p className="text-sm break-all">{displayUser.email}</p>
                    </div>
                  </div>
                )}

                {/* phone */}
                {displayUser?.phone && (
                  <div className="flex gap-3 items-center">
                    <Phone className="size-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Điện thoại</p>
                      <p className="text-sm">{displayUser.phone}</p>
                    </div>
                  </div>
                )}

                {/* member since */}
                {displayUser?.createdAt && (
                  <div className="flex gap-3 items-center">
                    <Calendar className="size-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Tham gia</p>
                      <p className="text-sm">
                        {new Date(displayUser.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <Button
                onClick={() => handleToggleBlock(friend._id)}
                variant="destructive"
                className="flex-1"
                disabled={isLoading}
              >
                {isBlocked ? "Bỏ chặn" : "Chặn"}
              </Button>
                </div>
                
              </div>
            </div>

            {/* action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => handleAddConversation(friend._id)}
                disabled={isBlocked}
                className={`flex-1 ${isBlocked ? "opacity-50 cursor-not-allowed" : "bg-gradient-primary hover:opacity-90"}`}
              >
                {isBlocked ? "Đã chặn" : "Nhắn tin"}
              </Button>
              
              <Button
                onClick={() => handleRemoveFriend(friend._id)}
                variant="destructive"
                className="flex-1"
              >
                Xóa bạn
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
