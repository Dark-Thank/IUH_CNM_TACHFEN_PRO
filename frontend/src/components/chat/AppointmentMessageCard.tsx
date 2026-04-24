import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { AppointmentResponseStatus, Message } from "@/types/chat";

type AppointmentMessageCardProps = {
  message: Message;
  viewerId?: string;
  onRespond: (status: AppointmentResponseStatus) => Promise<void>;
  onDelete?: () => Promise<void>;
};

const responseLabels: Record<AppointmentResponseStatus, string> = {
  going: "Tham gia",
  maybe: "Có thể",
  declined: "Từ chối",
};

const appointmentActionStatuses: AppointmentResponseStatus[] = ["going", "declined"];

const formatAppointmentDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
};

const AppointmentMessageCard = ({ message, viewerId, onRespond, onDelete }: AppointmentMessageCardProps) => {
  const [submittingStatus, setSubmittingStatus] = useState<AppointmentResponseStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const appointmentMeta = message.appointmentMeta;

  const summary = useMemo(() => {
    const counts: Record<AppointmentResponseStatus, number> = {
      going: 0,
      maybe: 0,
      declined: 0,
    };

    for (const response of appointmentMeta?.responses || []) {
      counts[response.status] += 1;
    }

    return counts;
  }, [appointmentMeta?.responses]);

  if (!appointmentMeta) {
    return null;
  }

  const scheduledAt = new Date(appointmentMeta.scheduledAt);
  const hasStarted = !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() <= Date.now();
  const currentResponse = appointmentMeta.responses.find((response) => response.userId === viewerId)?.status;
  const isCreator = appointmentMeta.createdBy === viewerId;

  const handleRespond = async (status: AppointmentResponseStatus) => {
    try {
      setSubmittingStatus(status);
      await onRespond(status);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể cập nhật lịch hẹn");
    } finally {
      setSubmittingStatus(null);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) {
      return;
    }

    if (!window.confirm("Xóa lịch hẹn này khỏi cuộc trò chuyện?")) {
      return;
    }

    try {
      setDeleting(true);
      await onDelete();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể xóa lịch hẹn");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Lịch hẹn</p>
        <p className="mt-1 text-sm font-medium text-foreground">{appointmentMeta.title}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {formatAppointmentDate(appointmentMeta.scheduledAt)}
        </p>
        {appointmentMeta.location && (
          <p className="mt-1 text-xs text-muted-foreground">Địa điểm: {appointmentMeta.location}</p>
        )}
      </div>

      {appointmentMeta.description && (
        <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm text-foreground">
          {appointmentMeta.description}
        </div>
      )}

      {hasStarted && (
        <p className="text-xs font-medium text-muted-foreground">
          Lịch hẹn đã tới giờ, không thể cập nhật phản hồi nữa.
        </p>
      )}

      {isCreator && onDelete && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="inline-flex items-center rounded-md border border-destructive/25 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {deleting ? "Đang xóa..." : "Xóa lịch hẹn"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-emerald-500/10 px-2 py-2 text-emerald-700">
          <div className="text-base font-semibold">{summary.going}</div>
          <div>Tham gia</div>
        </div>
        <div className="rounded-xl bg-rose-500/10 px-2 py-2 text-rose-700">
          <div className="text-base font-semibold">{summary.declined}</div>
          <div>Từ chối</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {appointmentActionStatuses.map((status) => {
          const isSelected = currentResponse === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => void handleRespond(status)}
              disabled={Boolean(submittingStatus) || deleting || hasStarted}
              className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/40 hover:bg-accent/40"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {submittingStatus === status ? "Đang gửi..." : responseLabels[status]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AppointmentMessageCard;
