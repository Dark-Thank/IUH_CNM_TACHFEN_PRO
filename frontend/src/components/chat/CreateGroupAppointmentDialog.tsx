import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

type CreateGroupAppointmentDialogProps = {
  conversationId: string;
  disabled?: boolean;
};

const getDateTimeLocalMinValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const CreateGroupAppointmentDialog = ({
  conversationId,
  disabled = false,
}: CreateGroupAppointmentDialogProps) => {
  const createGroupAppointment = useChatStore((state) => state.createGroupAppointment);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setScheduledAt("");
    setSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetState();
    }
  };

  const handleSubmit = async () => {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      toast.error("Nhập tiêu đề lịch hẹn");
      return;
    }

    if (!scheduledAt) {
      toast.error("Chọn thời gian hẹn");
      return;
    }

    const parsedScheduledAt = new Date(scheduledAt);

    if (Number.isNaN(parsedScheduledAt.getTime()) || parsedScheduledAt.getTime() <= Date.now()) {
      toast.error("Thời gian lịch hẹn phải lớn hơn thời điểm hiện tại");
      return;
    }

    try {
      setSubmitting(true);
      await createGroupAppointment(conversationId, {
        title: normalizedTitle,
        description: description.trim(),
        location: location.trim(),
        scheduledAt,
      });
      setOpen(false);
      resetState();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể tạo lịch hẹn");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled}>
          <CalendarPlus className="size-4" />
          <span className="sr-only">Tạo lịch hẹn</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo lịch hẹn cho nhóm</DialogTitle>
          <DialogDescription>
            Gửi thông tin hẹn gặp để mọi người xác nhận tham gia ngay trong chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="appointment-title" className="text-sm font-medium">
              Tiêu đề
            </label>
            <Input
              id="appointment-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Họp nhóm sprint 12"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="appointment-scheduled-at" className="text-sm font-medium">
              Thời gian
            </label>
            <Input
              id="appointment-scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              min={getDateTimeLocalMinValue()}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="appointment-location" className="text-sm font-medium">
              Địa điểm
            </label>
            <Input
              id="appointment-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Phòng họp A / Google Meet"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="appointment-description" className="text-sm font-medium">
              Ghi chú
            </label>
            <Textarea
              id="appointment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Nội dung cần chuẩn bị..."
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Đang tạo..." : "Gửi lịch hẹn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupAppointmentDialog;
