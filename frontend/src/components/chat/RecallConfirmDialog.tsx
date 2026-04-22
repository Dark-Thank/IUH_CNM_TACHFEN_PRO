import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { useChatStore } from "@/stores/useChatStore";

interface RecallConfirmDialogProps {
  messageId: string;
  children: ReactNode;
}

export default function RecallConfirmDialog({ messageId, children }: RecallConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const recallMessage = useChatStore((state) => state.recallMessage);

  const handleConfirm = async () => {
    try {
      await recallMessage(messageId);
      setOpen(false);
    } catch (error) {
      console.error("Lỗi thu hồi:", error);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <div onClick={(e) => {
        e.stopPropagation(); // Chặn sự kiện lan truyền
        setOpen(true);
      }}>
        {children}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Giữ nguyên phần DialogContent của bạn */}
        <DialogContent
          className="sm:max-w-md p-0 max-h-[90vh] overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" />
                Thu hồi tin nhắn
              </DialogTitle>
              <DialogDescription className="text-sm mt-2">
                Tin nhắn này sẽ bị xóa khỏi tất cả thiết bị tham gia.
                <br />
                <span className="font-semibold text-destructive mt-1 block">
                  Không thể khôi phục sau khi xác nhận!
                </span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 pt-4 border-t border-border gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Hủy
              </Button>
              <Button
                type="button"
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium shadow-lg"
                onClick={handleConfirm}
              >
                Xác nhận thu hồi
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
