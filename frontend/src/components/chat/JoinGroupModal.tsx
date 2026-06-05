import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { chatService } from "@/services/chatServiec";
import { useChatStore } from "@/stores/useChatStore";
import { Scan, Copy } from "lucide-react";

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToken?: string;
}

export const JoinGroupModal = ({
  isOpen,
  onClose,
  initialToken,
}: JoinGroupModalProps) => {
  const [tab, setTab] = useState<"link" | "camera">("link");
  const [token, setToken] = useState(initialToken || "");
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { setActiveConversation, fetchConversations } = useChatStore();

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (error) {
      toast.error("Không thể truy cập camera");
      console.error("Camera error:", error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleJoinGroup = async () => {
    if (!token.trim()) {
      toast.error("Vui lòng nhập mã mời");
      return;
    }

    try {
      setLoading(true);
      const data = await chatService.joinGroupByToken(token);

      toast.success("Tham gia nhóm thành công!");
      if (data.pendingApproval) {
        toast.success(data.message || "Đã gửi yêu cầu chờ duyệt");
        onClose();
        setToken("");
        setTab("link");
        return;
      }

      await fetchConversations();
      setActiveConversation(data.conversation._id);

      onClose();
      setToken("");
      setTab("link");
    } catch (error: any) {
      const message = error.response?.data?.message || "Không thể tham gia nhóm";
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setToken("");
    setTab("link");
    onClose();
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/\/join-group\/([a-f0-9]+)/) || [null, text];
      if (match[1]) {
        setToken(match[1]);
      } else {
        setToken(text);
      }
      toast.success("Đã dán token");
    } catch (error) {
      toast.error("Không thể dán từ clipboard");
      console.error(error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tham gia nhóm chat</DialogTitle>
          <DialogDescription>
            Nhập mã mời hoặc quét mã QR để tham gia nhóm chat
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => {
              setTab("link");
              stopCamera();
            }}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              tab === "link"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Link/Mã
          </button>
          <button
            onClick={() => setTab("camera")}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              tab === "camera"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Camera
          </button>
        </div>

        {/* Link/Token Tab */}
        {tab === "link" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium">
                Mã mời
              </label>
              <div className="flex gap-2">
                <Input
                  id="token"
                  placeholder="Dán token hoặc link mời..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={loading}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePasteFromClipboard}
                  disabled={loading}
                  title="Dán từ clipboard"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dán token từ link: /join-group/{"{token}"}
              </p>
            </div>

            <Button
              onClick={handleJoinGroup}
              disabled={loading || !token.trim()}
              className="w-full"
            >
              {loading ? "Đang tham gia..." : "Tham gia nhóm"}
            </Button>
          </div>
        )}

        {/* Camera Tab */}
        {tab === "camera" && (
          <div className="space-y-4">
            {!cameraActive ? (
              <Button onClick={startCamera} variant="outline" className="w-full">
                <Scan className="w-4 h-4 mr-2" />
                Mở Camera
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none flex items-center justify-center">
                    <div className="absolute inset-8 border-2 border-primary/50 rounded-lg" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={stopCamera}
                    variant="outline"
                    className="w-full"
                  >
                    Đóng Camera
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  💡 Để quét QR đầy đủ, vui lòng dùng tab "Link/Mã" nhập token
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default JoinGroupModal;
