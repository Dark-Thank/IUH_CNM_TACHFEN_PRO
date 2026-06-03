import { useEffect, useRef, useState } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Loader, Share2 } from "lucide-react";
import { toast } from "sonner";
import { chatService } from "@/services/chatServiec";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Conversation } from "@/types/chat";
import UserAvatar from "./UserAvatar";

interface ShareGroupLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export const ShareGroupLinkModal = ({
  isOpen,
  onClose,
  conversation,
}: ShareGroupLinkModalProps) => {
  const [loading, setLoading] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [showFriendList, setShowFriendList] = useState(false);
  const [sharingFriendId, setSharingFriendId] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const { friends, loading: friendsLoading, getFriends } = useFriendStore();

  const memberIds = new Set(
    conversation?.participants.map((participant) => participant._id) ?? []
  );
  const inviteableFriends = friends.filter((friend) => !memberIds.has(friend._id));

  useEffect(() => {
    if (isOpen && conversation?.type === "group") {
      void generateInvitationLink();
      void getFriends();
      setShowFriendList(false);
    }
  }, [isOpen, conversation?._id]);

  const generateInvitationLink = async () => {
    if (!conversation) {
      return;
    }

    try {
      setLoading(true);
      const data = await chatService.generateInvitationLink(conversation._id);
      setInvitationUrl(data.invitationUrl);
    } catch (error) {
      console.error("Error generating invitation link:", error);
      toast.error("Không thể tạo link mời");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      toast.success("Đã sao chép link");
    } catch (error) {
      toast.error("Không thể sao chép link");
      console.error(error);
    }
  };

  const handleSendInvite = async (friendId: string) => {
    if (!conversation) {
      return;
    }

    try {
      setSharingFriendId(friendId);
      await chatService.shareGroupInvitation(conversation._id, friendId);
      toast.success("Đã gửi lời mời tham gia nhóm");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể gửi lời mời");
      console.error("Error sending group invitation:", error);
    } finally {
      setSharingFriendId(null);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");

    if (!svg) {
      toast.error("Không tìm thấy mã QR để lưu");
      return;
    }

    const svgText = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.max(image.width, image.height, 240);
      const context = canvas.getContext("2d");

      canvas.width = size;
      canvas.height = size;

      if (!context) {
        URL.revokeObjectURL(svgUrl);
        toast.error("Không thể lưu mã QR");
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${conversation?.group?.name || "group"}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(svgUrl);
      toast.success("Đã tải xuống mã QR");
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      toast.error("Không thể lưu mã QR");
    };

    image.src = svgUrl;
  };

  if (!conversation || conversation.type !== "group") {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link nhóm</DialogTitle>
          <DialogDescription>
            Mời mọi người tham gia nhóm bằng mã QR hoặc link dưới đây:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold">{conversation.group?.name}</h3>
          </div>

          <div className="flex justify-center" ref={qrRef}>
            {loading ? (
              <div className="flex h-40 w-40 items-center justify-center rounded bg-muted">
                <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : invitationUrl ? (
              <QRCode
                value={invitationUrl}
                size={200}
                level="H"
                includeMargin
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">Link mời:</p>
            <div className="break-all rounded-lg bg-muted p-3">
              <code className="font-mono text-sm text-foreground">
                {invitationUrl}
              </code>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={loading || !invitationUrl}
              className="flex h-auto flex-col items-center gap-1 py-2"
            >
              <Copy className="h-4 w-4" />
              <span className="text-xs">Sao chép link</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFriendList((current) => !current)}
              disabled={loading || !invitationUrl}
              className="flex h-auto flex-col items-center gap-1 py-2"
            >
              <Share2 className="h-4 w-4" />
              <span className="text-xs">Chia sẻ link</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadQR}
              disabled={loading || !invitationUrl}
              className="flex h-auto flex-col items-center gap-1 py-2"
            >
              <Download className="h-4 w-4" />
              <span className="text-xs">Lưu mã QR</span>
            </Button>
          </div>

          {showFriendList && (
            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Chọn bạn bè để gửi lời mời</p>
                {friendsLoading && (
                  <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {inviteableFriends.length === 0 ? (
                  <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Không có bạn bè nào bên ngoài nhóm để mời.
                  </p>
                ) : (
                  inviteableFriends.map((friend) => (
                    <button
                      key={friend._id}
                      type="button"
                      onClick={() => void handleSendInvite(friend._id)}
                      disabled={sharingFriendId === friend._id}
                      className="flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          type="chat"
                          name={friend.displayName}
                          avatarUrl={friend.avatarUrl}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {friend.displayName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            @{friend.username}
                          </span>
                        </span>
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {sharingFriendId === friend._id ? "Đang gửi..." : "Gửi"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="rounded bg-muted p-2 text-center text-xs text-muted-foreground">
            Link này có hiệu lực trong 30 ngày. Bạn có thể tạo link mới bất kỳ lúc nào.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareGroupLinkModal;
