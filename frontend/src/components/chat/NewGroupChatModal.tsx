import { cn } from "@/lib/utils";
import { chatService } from "@/services/chatServiec";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import { Check, ImagePlus, UserPlus, Users, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
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
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { toast } from "sonner";
import UserAvatar from "./UserAvatar";

interface NewGroupChatModalProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type CompositeSlot =
  | { type: "friend"; friend: Friend }
  | { type: "count"; count: number };

const getCompositeSlots = (friends: Friend[]): CompositeSlot[] => {
  if (friends.length <= 4) {
    return friends
      .slice(0, 4)
      .map((friend) => ({ type: "friend" as const, friend }));
  }

  return [
    ...friends
      .slice(0, 3)
      .map((friend) => ({ type: "friend" as const, friend })),
    { type: "count" as const, count: friends.length - 3 },
  ];
};

const getCompositeLayout = (slotCount: number, index: number) => {
  if (slotCount === 1) {
    return "col-span-2 row-span-2";
  }

  if (slotCount === 2) {
    return "row-span-2";
  }

  if (slotCount === 3 && index === 0) {
    return "row-span-2";
  }

  return "";
};

const GroupAvatarPreview = ({
  groupName,
  members,
  previewUrl,
}: {
  groupName: string;
  members: Friend[];
  previewUrl: string | null;
}) => {
  const slots = getCompositeSlots(members);
  const fallbackLabel = groupName.trim().charAt(0) || "G";

  if (previewUrl) {
    return (
      <div className="size-20 overflow-hidden rounded-full border border-border/60 bg-background shadow-sm">
        <img
          src={previewUrl}
          alt="Ảnh nhóm mới"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex size-20 items-center justify-center rounded-full bg-gradient-chat text-2xl font-semibold text-white shadow-sm">
        {fallbackLabel.toUpperCase()}
      </div>
    );
  }

  return (
    <div className="size-20 overflow-hidden rounded-full border border-border/60 bg-background p-1 shadow-sm">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden rounded-full bg-background">
        {slots.map((slot, index) => (
          <div
            key={slot.type === "count" ? `count-${slot.count}` : slot.friend._id}
            className={cn(
              "relative overflow-hidden rounded-full bg-muted",
              getCompositeLayout(slots.length, index)
            )}
          >
            {slot.type === "count" ? (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
                +{slot.count}
              </div>
            ) : slot.friend.avatarUrl ? (
              <img
                src={slot.friend.avatarUrl}
                alt={slot.friend.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-xs font-semibold text-white">
                {slot.friend.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const NewGroupChatModal = ({ trigger, open: controlledOpen, onOpenChange }: NewGroupChatModalProps) => {
  const submitLockRef = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const { friends, getFriends } = useFriendStore();
  const [invitedUsers, setInvitedUsers] = useState<Friend[]>([]);
  const [groupAvatarFile, setGroupAvatarFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loading, createConversation, updateConversation } = useChatStore();
  const open = controlledOpen ?? uncontrolledOpen;
  useEffect(() => {
    void getFriends();
  }, []);
  const avatarPreviewUrl = useMemo(
    () => (groupAvatarFile ? URL.createObjectURL(groupAvatarFile) : null),
    [groupAvatarFile]
  );

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const setOpen = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);

    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
  };

  const resetForm = () => {
    setGroupName("");
    setSearch("");
    setInvitedUsers([]);
    setGroupAvatarFile(null);
  };

  const handleToggleFriend = (friend: Friend) => {
    setInvitedUsers((currentUsers) => {
      const exists = currentUsers.some((user) => user._id === friend._id);

      if (exists) {
        return currentUsers.filter((user) => user._id !== friend._id);
      }

      return [...currentUsers, friend];
    });
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.warning("Chỉ có thể dùng ảnh làm avatar nhóm.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Ảnh nhóm không được lớn hơn 5MB.");
      event.target.value = "";
      return;
    }

    setGroupAvatarFile(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    try {
      e.preventDefault();

      if (submitLockRef.current || isSubmitting || loading) {
        return;
      }

      if (!groupName.trim()) {
        toast.warning("Bạn cần nhập tên nhóm trước khi tạo.");
        return;
      }

      if (invitedUsers.length === 0) {
        toast.warning("Bạn phải mời ít nhất 1 thành viên vào nhóm");
        return;
      }

      submitLockRef.current = true;
      setIsSubmitting(true);

      const createdConversation = await createConversation(
        "group",
        groupName.trim(),
        invitedUsers.map((u) => u._id)
      );

      if (!createdConversation) {
        toast.error("Không thể tạo nhóm lúc này.");
        return;
      }

      if (groupAvatarFile) {
        try {
          const updated = await chatService.updateGroupAvatar(
            createdConversation._id,
            groupAvatarFile
          );

          updateConversation({
            _id: createdConversation._id,
            group: {
              ...createdConversation.group,
              avatar: updated.conversation.group.avatar,
            },
          });
        } catch (error) {
          console.error("Lỗi upload avatar nhóm:", error);
          toast.warning("Nhóm đã được tạo nhưng chưa cập nhật được avatar.");
        }
      }

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Lỗi xảy ra khi handleSubmit trong NewGroupChatModal:", error);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredFriends = friends.filter((friend) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      friend.displayName.toLowerCase().includes(normalizedSearch) ||
      friend.username.toLowerCase().includes(normalizedSearch)
    );
  });

  const renderFriendRow = (friend: Friend, isSelected: boolean) => (
    <button
      key={friend._id}
      type="button"
      onClick={() => handleToggleFriend(friend)}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-smooth",
        isSelected
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-background hover:border-primary/30 hover:bg-muted/40"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar
          type="sidebar"
          name={friend.displayName}
          avatarUrl={friend.avatarUrl}
          className="size-10 text-sm"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{friend.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
        </div>
      </div>

      <span
        className={cn(
          "flex items-center gap-1 text-xs font-semibold",
          isSelected ? "text-primary" : "text-muted-foreground"
        )}
      >
        {isSelected ? (
          <>
            <Check className="size-3.5" />
            Bỏ chọn
          </>
        ) : (
          "Thêm"
        )}
      </span>
    </button>
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
      {controlledOpen === undefined ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Card
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
          )}
        </DialogTrigger>
      ) : null}

      <DialogContent className="border-none sm:max-w-[34rem]">
        <DialogHeader>
          <DialogTitle className="capitalize">tạo nhóm chat mới</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={handleSubmit}
        >
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

          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <GroupAvatarPreview
              groupName={groupName}
              members={invitedUsers}
              previewUrl={avatarPreviewUrl}
            />

            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold">Avatar nhóm</p>
                <p className="text-xs text-muted-foreground">
                  Chọn ảnh riêng hoặc để hệ thống ghép avatar từ các thành viên đã chọn.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 size-4" />
                  {groupAvatarFile ? "Đổi ảnh" : "Chọn ảnh"}
                </Button>

                {groupAvatarFile ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setGroupAvatarFile(null)}
                  >
                    <X className="mr-2 size-4" />
                    Xóa ảnh
                  </Button>
                ) : null}
              </div>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="invite"
                className="text-sm font-semibold"
              >
                Danh sách bạn bè
              </Label>
              <span className="text-xs text-muted-foreground">
                {friends.length} bạn
              </span>
            </div>

            <Input
              id="invite"
              placeholder="Tìm theo tên hiển thị hoặc username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />

            <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Đã chọn</p>
                <span className="text-xs text-muted-foreground">
                  {invitedUsers.length} thành viên
                </span>
              </div>

              {invitedUsers.length > 0 ? (
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {invitedUsers.map((friend) => renderFriendRow(friend, true))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
                  Chưa chọn thành viên nào.
                </div>
              )}
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredFriends.length > 0 ? (
                filteredFriends.map((friend) =>
                  renderFriendRow(
                    friend,
                    invitedUsers.some((user) => user._id === friend._id)
                  )
                )
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
                  {friends.length === 0
                    ? "Bạn chưa có bạn bè nào để tạo nhóm."
                    : "Không tìm thấy bạn bè phù hợp."}
                </div>
              )}
            </div>
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
    </Dialog>
  );
};

export default NewGroupChatModal;