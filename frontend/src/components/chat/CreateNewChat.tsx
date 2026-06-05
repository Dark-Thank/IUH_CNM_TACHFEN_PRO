import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import { MessageCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import AddFriendModal from "./AddFriendModal";
import FriendListModal from "../createNewChat/FriendListModal";
import { ProfileModal } from "../createNewChat/ProfileModal";
import { Card } from "../ui/card";
import { Dialog } from "../ui/dialog";

function CreateNewChat() {
  const { getFriends } = useFriendStore();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriendList, setShowFriendList] = useState(false);

  const handleGetFriends = async () => {
    await getFriends();
  };

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend);
    setShowProfile(true);
    setShowFriendList(false);
  };

  return (
    <div>
      <Card
        className="glass cursor-pointer p-3 transition-smooth hover:shadow-soft group/card"
        onClick={() => {
          handleGetFriends();
          setShowFriendList(true);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-8 items-center justify-center rounded-full bg-gradient-chat transition-bounce group-hover/card:scale-110">
              <MessageCircle className="size-4 text-white" />
            </div>
            <span className="truncate text-sm font-medium capitalize">
              Danh sách bạn bè
            </span>
          </div>

          <AddFriendModal
            trigger={
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground transition hover:border-primary/30 hover:text-primary"
              >
                <UserPlus className="size-4" />
                <span className="sr-only">Kết bạn</span>
              </button>
            }
          />
        </div>
      </Card>

      <Dialog open={showFriendList} onOpenChange={setShowFriendList}>
        <FriendListModal onSelectFriend={handleSelectFriend} onClose={() => setShowFriendList(false)} />
      </Dialog>

      <ProfileModal
        friend={selectedFriend}
        open={showProfile}
        onOpenChange={setShowProfile}
      />
    </div>
  )
}

export default CreateNewChat