import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Message } from "@/types/chat";

type PollMessageCardProps = {
  message: Message;
  viewerId?: string;
  onVote: (optionId: string) => Promise<void>;
  onClose?: () => Promise<void>;
};

const formatPollDeadline = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
};

const PollMessageCard = ({ message, viewerId, onVote, onClose }: PollMessageCardProps) => {
  const [submittingOptionId, setSubmittingOptionId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const pollMeta = message.pollMeta;

  const totalVotes = useMemo(
    () => (pollMeta?.options || []).reduce((sum, option) => sum + option.voterIds.length, 0),
    [pollMeta?.options]
  );

  if (!pollMeta) {
    return null;
  }

  const expiresAt = pollMeta.expiresAt ? new Date(pollMeta.expiresAt) : null;
  const closedAt = pollMeta.closedAt ? new Date(pollMeta.closedAt) : null;
  const isExpired = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now());
  const isManuallyClosed = Boolean(closedAt && !Number.isNaN(closedAt.getTime()));
  const isClosed = isExpired || isManuallyClosed;
  const isCreator = pollMeta.createdBy === viewerId;
  const selectedOptionId = pollMeta.options.find((option) => option.voterIds.includes(viewerId || ""))?._id;
  const statusLabel = isManuallyClosed
    ? `Người tạo đã đóng bình chọn lúc ${formatPollDeadline(pollMeta.closedAt)}`
    : pollMeta.expiresAt
      ? (isExpired ? "Đã đóng bình chọn" : `Đóng lúc ${formatPollDeadline(pollMeta.expiresAt)}`)
      : "";

  const handleVote = async (optionId: string) => {
    try {
      setSubmittingOptionId(optionId);
      await onVote(optionId);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể gửi phiếu bầu");
    } finally {
      setSubmittingOptionId(null);
    }
  };

  const handleClose = async () => {
    if (!onClose) {
      return;
    }

    try {
      setClosing(true);
      await onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể đóng bình chọn");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Bình chọn</p>
          <p className="mt-1 text-sm text-foreground">{pollMeta.question}</p>
        </div>

        <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {totalVotes} vote
        </div>
      </div>

      {statusLabel && (
        <p className="text-xs text-muted-foreground">
          {statusLabel}
        </p>
      )}

      {isCreator && !isClosed && onClose && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={closing}
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70"
          >
            {closing ? "Đang đóng..." : "Đóng bình chọn"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {pollMeta.options.map((option) => {
          const voteCount = option.voterIds.length;
          const votePercent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = selectedOptionId === option._id;

          return (
            <button
              key={option._id}
              type="button"
              onClick={() => void handleVote(option._id)}
              disabled={Boolean(submittingOptionId) || closing || isClosed}
              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-accent/40"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{option.text}</span>
                <span className="text-xs text-muted-foreground">{voteCount}</span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${isSelected ? "bg-primary" : "bg-primary/50"}`}
                  style={{ width: `${votePercent}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{votePercent}%</span>
                <span>{isSelected ? "Bạn đã chọn" : "Chọn lựa chọn này"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PollMessageCard;
