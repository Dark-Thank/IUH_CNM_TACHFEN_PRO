import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
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
    <div className="flex gap-2">
      <Card
        className="flex-1 p-3 glass hover:shadow-soft transition-smooth cursor-pointer group/card"
        onClick={() => {
          handleGetFriends();
          setShowFriendList(true);
        }}
      >
        <div className="flex items-center gap-4">
          <div className="size-8 bg-gradient-chat rounded-full flex items-center justify-center group-hover/card:scale-110 transition-bounce">
            <MessageCircle className="size-4 text-white" />
          </div>
          <span className="text-sm font-medium capitalize">
            Danh sách bạn bè
          </span>
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