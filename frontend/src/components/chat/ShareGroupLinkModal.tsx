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
import { Copy, Share2, Download, Loader } from "lucide-react";
import { toast } from "sonner";
import { chatService } from "@/services/chatServiec";
import type { Conversation } from "@/types/chat";

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
  const [invitationUrl, setInvitationUrl] = useState<string>("");
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && conversation && conversation.type === "group") {
      generateInvitationLink();
    }
  }, [isOpen, conversation]);

  const generateInvitationLink = async () => {
    if (!conversation) return;

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

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Tham gia nhóm "${conversation?.group?.name}"`,
          text: `Mời bạn tham gia nhóm chat: ${conversation?.group?.name}`,
          url: invitationUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      await handleCopyLink();
      toast.info("Link đã được sao chép");
    }
  };

  const handleDownloadQR = () => {
    if (qrRef.current) {
      const canvas = qrRef.current.querySelector("canvas");
      if (canvas) {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${conversation?.group?.name || "group"}-qr.png`;
        link.click();
        toast.success("Đã tải xuống mã QR");
      }
    }
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
          {/* Group Name */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">{conversation.group?.name}</h3>
          </div>

          {/* QR Code */}
          <div className="flex justify-center" ref={qrRef}>
            {loading ? (
              <div className="flex items-center justify-center w-40 h-40 bg-muted rounded">
                <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : invitationUrl ? (
              <QRCode
                value={invitationUrl}
                size={200}
                level="H"
                includeMargin={true}
              />
            ) : null}
          </div>

          {/* Link */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">Link mời:</p>
            <div className="p-3 bg-muted rounded-lg break-all">
              <code className="text-sm font-mono text-foreground">
                {invitationUrl}
              </code>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={loading || !invitationUrl}
              className="flex flex-col items-center gap-1 h-auto py-2"
            >
              <Copy className="w-4 h-4" />
              <span className="text-xs">Sao chép link</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShareLink}
              disabled={loading || !invitationUrl}
              className="flex flex-col items-center gap-1 h-auto py-2"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs">Chia sẻ link</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadQR}
              disabled={loading || !invitationUrl}
              className="flex flex-col items-center gap-1 h-auto py-2"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs">Lưu mã QR</span>
            </Button>
          </div>

          {/* Expiry Info */}
          <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded">
            Link này có hiệu lực trong 30 ngày. Bạn có thể tạo link mới bất kỳ lúc nào.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareGroupLinkModal;
