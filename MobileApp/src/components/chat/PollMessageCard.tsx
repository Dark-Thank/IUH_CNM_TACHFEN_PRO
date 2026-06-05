import { toast } from "@/lib/toast";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Message, Participant } from "@/types/chat";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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

export default function PollMessageCard({
  message,
  viewerId,
  participants,
  onVote,
  onAddOption,
  onClose,
}: PollMessageCardProps) {
  const { isDark } = useThemeStore();
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
      toast.error(error?.response?.data?.message || "Không thể cập nhật bình chọn");
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

  const handleAddOption = async () => {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
            Bình chọn
          </Text>
          <Text style={[styles.question, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
            {pollMeta.question}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: isDark ? "#312e81" : "#ede9fe" }]}>
          <Text style={[styles.badgeText, { color: isDark ? "#c4b5fd" : "#6d28d9" }]}>
            {canRevealResults ? `${totalVotes} ${allowMultipleChoices ? "lượt chọn" : "phiếu"}` : "Kết quả ẩn"}
          </Text>
        </View>
      </View>

      {statusLabel ? (
        <Text style={[styles.deadline, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          {statusLabel}
        </Text>
      ) : null}

      {pollSettings.length > 0 ? (
        <View style={styles.settingChipList}>
          {pollSettings.map((item) => (
            <View
              key={item}
              style={[
                styles.settingChip,
                { backgroundColor: isDark ? "#1f2937" : "#e2e8f0" },
              ]}
            >
              <Text style={[styles.settingChipText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {!canRevealResults ? (
        <Text style={[styles.deadline, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          Kết quả sẽ hiển thị sau khi bạn bình chọn hoặc khi poll đã đóng.
        </Text>
      ) : null}

      {isCreator && !isClosed && onClose ? (
        <View style={styles.closeWrap}>
          <Pressable
            onPress={() => void handleClose()}
            disabled={closing}
            style={[
              styles.closeButton,
              {
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#334155" : "#e2e8f0",
                opacity: closing ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.closeButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              {closing ? "Đang đóng..." : "Đóng bình chọn"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.optionList}>
        {pollMeta.options.map((option) => {
          const voteCount = option.voterIds.length;
          const votePercent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = selectedOptionIds.has(option._id);
          const optionVoters = option.voterIds.map((voterId) => {
            const participant = participantMap.get(voterId);

            return {
              _id: voterId,
              displayName: voterId === viewerId ? "Bạn" : participant?.displayName || "Thành viên",
              avatarUrl: participant?.avatarUrl ?? null,
            };
          });
          const visibleVoters = optionVoters.slice(0, 5);
          const remainingVoterCount = optionVoters.length - visibleVoters.length;

          return (
            <Pressable
              key={option._id}
              onPress={() => void handleVote(option._id)}
              disabled={Boolean(submittingOptionId) || closing || isClosed}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected
                    ? isDark ? "#312e81" : "#ede9fe"
                    : isDark ? "#0f172a" : "#f8fafc",
                  borderColor: isSelected
                    ? isDark ? "#8b5cf6" : "#7c3aed"
                    : isDark ? "#334155" : "#e2e8f0",
                  opacity: Boolean(submittingOptionId) || isExpired ? 0.75 : 1,
                },
              ]}
            >
              <View style={styles.optionTopRow}>
                <Text style={[styles.optionText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  {option.text}
                </Text>
                {canRevealResults ? (
                  <Text style={[styles.optionCount, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                    {voteCount}
                  </Text>
                ) : null}
              </View>

              {canRevealResults ? (
                <View style={[styles.progressTrack, { backgroundColor: isDark ? "#1f2937" : "#e2e8f0" }]}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${votePercent}%`, backgroundColor: isSelected ? "#8b5cf6" : "#a78bfa" },
                    ]}
                  />
                </View>
              ) : null}

              {canShowVoters && optionVoters.length > 0 ? (
                <View style={styles.voterRow}>
                  <View style={styles.voterAvatarStack}>
                    {visibleVoters.map((voter, index) => (
                      <View
                        key={`${option._id}-${voter._id}`}
                        style={[
                          styles.voterAvatarWrap,
                          {
                            marginLeft: index === 0 ? 0 : -8,
                            borderColor: isDark ? "#0f172a" : "#ffffff",
                          },
                        ]}
                      >
                        <UserAvatar
                          name={voter.displayName}
                          avatarUrl={voter.avatarUrl}
                          size={22}
                        />
                      </View>
                    ))}

                    {remainingVoterCount > 0 ? (
                      <View
                        style={[
                          styles.voterOverflowBadge,
                          {
                            marginLeft: visibleVoters.length > 0 ? -8 : 0,
                            backgroundColor: isDark ? "#1f2937" : "#e2e8f0",
                            borderColor: isDark ? "#0f172a" : "#ffffff",
                          },
                        ]}
                      >
                        <Text style={[styles.voterOverflowText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                          +{remainingVoterCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.voterCountText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                    {optionVoters.length === 1 ? "1 người đã chọn" : `${optionVoters.length} người đã chọn`}
                  </Text>
                </View>
              ) : null}

              <View style={styles.optionMetaRow}>
                <Text style={[styles.optionMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  {canRevealResults ? `${votePercent}%` : "Kết quả đang ẩn"}
                </Text>
                <Text style={[styles.optionMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  {isSelected
                    ? "Bạn đã chọn"
                    : allowMultipleChoices
                      ? "Nhấn để bật hoặc tắt phương án này"
                      : "Nhấn để chọn lựa chọn này"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {canAddOptions ? (
        <View
          style={[
            styles.addOptionCard,
            {
              backgroundColor: isDark ? "#111827" : "#f8fafc",
              borderColor: isDark ? "#1f2937" : "#e2e8f0",
            },
          ]}
        >
          <Text style={[styles.addOptionHint, { color: isDark ? "#94a3b8" : "#64748b" }]}>
            Mọi thành viên trong nhóm đều có thể thêm lựa chọn mới.
          </Text>

          <View style={styles.addOptionRow}>
            <TextInput
              value={newOptionText}
              onChangeText={setNewOptionText}
              placeholder="Nhập lựa chọn mới"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              editable={!addingOption && !submittingOptionId && !closing}
              style={[
                styles.addOptionInput,
                {
                  backgroundColor: isDark ? "#0f172a" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#cbd5e1",
                  color: isDark ? "#f8fafc" : "#0f172a",
                },
              ]}
            />

            <Pressable
              onPress={() => void handleAddOption()}
              disabled={addingOption || Boolean(submittingOptionId) || closing}
              style={[
                styles.addOptionButton,
                {
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#cbd5e1",
                  opacity: addingOption || submittingOptionId || closing ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.addOptionButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                {addingOption ? "Đang thêm..." : "Thêm"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!isClosed && pollMeta.options.length >= 10 ? (
        <Text style={[styles.maxOptionText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          Đã đạt tối đa 10 lựa chọn.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    minWidth: 220,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  question: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  deadline: {
    fontSize: 12,
    fontWeight: "600",
  },
  closeWrap: {
    alignItems: "flex-end",
  },
  closeButton: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  settingChipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  settingChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  settingChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  optionList: {
    gap: 8,
  },
  addOptionCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  addOptionHint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  addOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addOptionInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addOptionButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  addOptionButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  maxOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  optionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  optionCount: {
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
  },
  optionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voterAvatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  voterAvatarWrap: {
    borderWidth: 2,
    borderRadius: 999,
  },
  voterOverflowBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  voterOverflowText: {
    fontSize: 9,
    fontWeight: "800",
  },
  voterCountText: {
    fontSize: 11,
    fontWeight: "600",
  },
  optionMeta: {
    fontSize: 11,
    fontWeight: "600",
  },
});
