import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Message, Participant } from "@/types/chat";
import UserAvatar from "./UserAvatar";

type PollMessageCardProps = {
  message: Message;
  viewerId?: string;
  participants: Participant[];
  onVote: (optionId: string) => Promise<void>;
  onAddOption?: (text: string) => Promise<void>;
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

const PollMessageCard = ({
  message,
  viewerId,
  participants,
  onVote,
  onAddOption,
  onClose,
}: PollMessageCardProps) => {
  const [submittingOptionId, setSubmittingOptionId] = useState<string | null>(null);
  const [newOptionText, setNewOptionText] = useState("");
  const [addingOption, setAddingOption] = useState(false);
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
  const allowMultipleChoices = pollMeta.allowMultipleChoices === true;
  const allowUserAddedOptions = pollMeta.allowUserAddedOptions !== false;
  const hideResultsUntilVote = pollMeta.hideResultsUntilVote === true;
  const selectedOptionIds = new Set(
    pollMeta.options
      .filter((option) => option.voterIds.includes(viewerId || ""))
      .map((option) => option._id)
  );
  const hasVoted = selectedOptionIds.size > 0;
  const canRevealResults = !hideResultsUntilVote || hasVoted || isClosed;
  const canShowVoters = pollMeta.hideVoters !== true && canRevealResults;
  const canAddOptions = Boolean(onAddOption) && allowUserAddedOptions && !isClosed && pollMeta.options.length < 10;
  const participantMap = useMemo(
    () => new Map(participants.map((participant) => [participant._id, participant])),
    [participants]
  );
  const pollSettings = [
    pollMeta.hideVoters ? "Ẩn người bình chọn" : null,
    hideResultsUntilVote ? "Ẩn kết quả trước khi bình chọn" : null,
    allowMultipleChoices ? "Chọn nhiều phương án" : null,
    allowUserAddedOptions ? "Có thể thêm phương án" : null,
  ].filter((item): item is string => Boolean(item));
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

  const handleAddOption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!onAddOption) {
      return;
    }

    const normalizedText = newOptionText.trim();

    if (!normalizedText) {
      toast.error("Nhập lựa chọn mới");
      return;
    }

    try {
      setAddingOption(true);
      await onAddOption(normalizedText);
      setNewOptionText("");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể thêm lựa chọn");
    } finally {
      setAddingOption(false);
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
          {canRevealResults ? `${totalVotes} ${allowMultipleChoices ? "lượt chọn" : "phiếu"}` : "Kết quả ẩn"}
        </div>
      </div>

      {statusLabel && (
        <p className="text-xs text-muted-foreground">
          {statusLabel}
        </p>
      )}

      {pollSettings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pollSettings.map((item) => (
            <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      )}

      {!canRevealResults && (
        <p className="text-xs text-muted-foreground">
          Kết quả sẽ hiển thị sau khi bạn bình chọn hoặc khi poll đã đóng.
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
          const isSelected = selectedOptionIds.has(option._id);
          const optionVoters = option.voterIds.map((voterId) => {
            const participant = participantMap.get(voterId);

            return {
              _id: voterId,
              displayName: voterId === viewerId ? "Bạn" : participant?.displayName || "Thành viên",
              avatarUrl: participant?.avatarUrl ?? undefined,
            };
          });
          const visibleVoters = optionVoters.slice(0, 5);
          const remainingVoterCount = optionVoters.length - visibleVoters.length;
          const voterNames = optionVoters.map((voter) => voter.displayName).join(", ");

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
                {canRevealResults && (
                  <span className="text-xs text-muted-foreground">{voteCount}</span>
                )}
              </div>

              {canRevealResults && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${isSelected ? "bg-primary" : "bg-primary/50"}`}
                    style={{ width: `${votePercent}%` }}
                  />
                </div>
              )}

              {canShowVoters && optionVoters.length > 0 && (
                <div className="mt-2 flex items-center gap-2" title={voterNames}>
                  <div className="flex items-center">
                    {visibleVoters.map((voter, index) => (
                      <div key={`${option._id}-${voter._id}`} className={index === 0 ? "" : "-ml-2"}>
                        <UserAvatar
                          type="chat"
                          name={voter.displayName}
                          avatarUrl={voter.avatarUrl}
                          className="!size-6 border-2 border-background"
                        />
                      </div>
                    ))}

                    {remainingVoterCount > 0 && (
                      <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
                        +{remainingVoterCount}
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {optionVoters.length === 1 ? "1 người đã chọn" : `${optionVoters.length} người đã chọn`}
                  </span>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{canRevealResults ? `${votePercent}%` : "Kết quả đang ẩn"}</span>
                <span>
                  {isSelected
                    ? "Bạn đã chọn"
                    : allowMultipleChoices
                      ? "Nhấn để bật hoặc tắt phương án này"
                      : "Chọn lựa chọn này"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {canAddOptions && (
        <form onSubmit={(event) => void handleAddOption(event)} className="space-y-2 rounded-xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            Mọi thành viên trong nhóm đều có thể thêm lựa chọn mới.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newOptionText}
              onChange={(event) => setNewOptionText(event.target.value)}
              placeholder="Nhập lựa chọn mới"
              disabled={addingOption || Boolean(submittingOptionId) || closing}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
            />

            <button
              type="submit"
              disabled={addingOption || Boolean(submittingOptionId) || closing}
              className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70"
            >
              {addingOption ? "Đang thêm..." : "Thêm"}
            </button>
          </div>
        </form>
      )}

      {!isClosed && pollMeta.options.length >= 10 && (
        <p className="text-xs text-muted-foreground">
          Đã đạt tối đa 10 lựa chọn.
        </p>
      )}
    </div>
  );
};

export default PollMessageCard;
