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
      toast.error("Nhap tieu de lich hen");
      return;
    }

    if (!scheduledAt) {
      toast.error("Chon thoi gian hen");
      return;
    }

    const parsedScheduledAt = new Date(scheduledAt);

    if (Number.isNaN(parsedScheduledAt.getTime()) || parsedScheduledAt.getTime() <= Date.now()) {
      toast.error("Thoi gian lich hen phai lon hon thoi diem hien tai");
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
      toast.error(error?.response?.data?.message || "Khong the tao lich hen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled}>
          <CalendarPlus className="size-4" />
          <span className="sr-only">Tao lich hen</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tao lich hen cho nhom</DialogTitle>
          <DialogDescription>
            Gui thong tin hen gap de moi nguoi xac nhan tham gia ngay trong chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="appointment-title" className="text-sm font-medium">
              Tieu de
            </label>
            <Input
              id="appointment-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Vi du: Hop nhom sprint 12"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="appointment-scheduled-at" className="text-sm font-medium">
              Thoi gian
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
              Dia diem
            </label>
            <Input
              id="appointment-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Phong hop A / Google Meet"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="appointment-description" className="text-sm font-medium">
              Ghi chu
            </label>
            <Textarea
              id="appointment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Noi dung can chuan bi..."
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Huy
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Dang tao..." : "Gui lich hen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupAppointmentDialog;
