import { useFriendStore } from "@/stores/useFriendStore";
import { useRef, useState } from "react";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { UserPlus, Users } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import type { Friend } from "@/types/user";
import IniviteSuggestionList from "../newGroupChat/IniviteSuggestionList";
import SelectedUsersList from "../newGroupChat/SelectedUsersList";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";


const NewGroupChatModal = () => {
  const submitLockRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const { friends, getFriends } = useFriendStore();
  const [invitedUsers, setInvitedUsers] = useState<Friend[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loading, createConversation } = useChatStore();

  const resetForm = () => {
    setGroupName("");
    setSearch("");
    setInvitedUsers([]);
  };

  const handleGetFriends = async () => {
    await getFriends();
  };

  const handleSelectFriend = (friend: Friend) => {
    setInvitedUsers([...invitedUsers, friend]);
    setSearch("");
  };
  const handleRemoveFriend = (friend: Friend) => {
    setInvitedUsers(invitedUsers.filter((u) => u._id !== friend._id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();

      if (submitLockRef.current || isSubmitting || loading) {
        return;
      }

      if (invitedUsers.length === 0) {
        toast.warning("Bạn phải mời ít nhất 1 thành viên vào nhóm");
        return;
      }

      submitLockRef.current = true;
      setIsSubmitting(true);

      await createConversation(
        "group",
        groupName,
        invitedUsers.map((u) => u._id)
      );

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Lỗi xảy ra khi handleSubmit trong NewGroupChatModal:", error);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };



  const filteredFriends = friends.filter(
    (friend) =>
      friend.displayName.toLowerCase().includes(search.toLowerCase()) &&
      !invitedUsers.some((u) => u._id === friend._id)
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Card
          onClick={handleGetFriends}
          className="glass cursor-pointer p-3 transition-smooth hover:shadow-soft group/card"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-8 items-center justify-center rounded-full bg-gradient-chat transition-bounce group-hover/card:scale-110">
              <Users className="size-4 text-white" />
            </div>
            <span className="truncate text-sm font-medium capitalize">
              Tạo nhóm mới
            </span>
          </div>
        </Card>
      </DialogTrigger>

      <DialogContent className="sm:max-w-106.25 border-none">
        <DialogHeader>
          <DialogTitle className="capitalize">tạo nhóm chat mới</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={handleSubmit}
        >
          {/* tên nhóm */}
          <div className="space-y-2">
            <Label
              htmlFor="groupName"
              className="text-sm font-semibold"
            >
              Tên nhóm
            </Label>
            <Input
              id="groupName"
              placeholder="Gõ tên nhóm vào đây..."
              className="glass border-border/50 focus:border-primary/50 transition-smooth"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          {/* mời thành viên */}
          <div className="space-y-2">
            <Label
              htmlFor="invite"
              className="text-sm font-semibold"
            >
              Mời thành viên
            </Label>

            <Input
              id="invite"
              placeholder="Tìm theo tên hiển thị..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />

            {/* danh sách gợi ý */}
            {search && filteredFriends.length > 0 && (
              <IniviteSuggestionList
                filteredFriends={filteredFriends}
                onSelect={handleSelectFriend}
              />
            )}

            {/* danh sách user đã chọn */}
            <SelectedUsersList
              invitedUsers={invitedUsers}
              onRemove={handleRemoveFriend}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || isSubmitting}
              className="flex-1 bg-gradient-chat text-white hover:opacity-90 transition-smooth"
            >
              {loading || isSubmitting ? (
                <span>Đang tạo...</span>
              ) : (
                <>
                  <UserPlus className="size-4 mr-2" />
                  Tạo nhóm
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>)
}

export default NewGroupChatModal