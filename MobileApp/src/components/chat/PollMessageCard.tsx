import { toast } from "@/lib/toast";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Message } from "@/types/chat";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

export default function PollMessageCard({
  message,
  viewerId,
  onVote,
  onClose,
}: PollMessageCardProps) {
  const { isDark } = useThemeStore();
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

  const selectedOptionId = pollMeta.options.find((option) => option.voterIds.includes(viewerId || ""))?._id;
  const expiresAt = pollMeta.expiresAt ? new Date(pollMeta.expiresAt) : null;
  const closedAt = pollMeta.closedAt ? new Date(pollMeta.closedAt) : null;
  const isExpired = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now());
  const isManuallyClosed = Boolean(closedAt && !Number.isNaN(closedAt.getTime()));
  const isClosed = isExpired || isManuallyClosed;
  const isCreator = pollMeta.createdBy === viewerId;
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
            {totalVotes} votes
          </Text>
        </View>
      </View>

      {statusLabel ? (
        <Text style={[styles.deadline, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          {statusLabel}
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
          const isSelected = selectedOptionId === option._id;

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
                <Text style={[styles.optionCount, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  {voteCount}
                </Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: isDark ? "#1f2937" : "#e2e8f0" }]}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${votePercent}%`, backgroundColor: isSelected ? "#8b5cf6" : "#a78bfa" },
                  ]}
                />
              </View>

              <View style={styles.optionMetaRow}>
                <Text style={[styles.optionMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  {votePercent}%
                </Text>
                <Text style={[styles.optionMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  {isSelected ? "Bạn đã chọn" : "Nhấn để chọn lựa chọn này"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
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
  optionList: {
    gap: 8,
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
  optionMeta: {
    fontSize: 11,
    fontWeight: "600",
  },
});
