import { toast } from "@/lib/toast";
import { useThemeStore } from "@/stores/useThemeStore";
import type { AppointmentResponseStatus, Message } from "@/types/chat";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

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

export default function AppointmentMessageCard({
  message,
  viewerId,
  onRespond,
  onDelete,
}: AppointmentMessageCardProps) {
  const { isDark } = useThemeStore();
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

  const handleDelete = () => {
    if (!onDelete) {
      return;
    }

    Alert.alert(
      "Xoa lich hen",
      "Lich hen nay se bi xoa khoi cuoc tro chuyen. Tiep tuc?",
      [
        { text: "Huy", style: "cancel" },
        {
          text: "Xoa",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeleting(true);
                await onDelete();
              } catch (error: any) {
                toast.error(error?.response?.data?.message || "Khong the xoa lich hen");
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.titleLabel, { color: isDark ? "#bfdbfe" : "#2563eb" }]}>
          Lịch hẹn
        </Text>
        <Text style={[styles.title, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
          {appointmentMeta.title}
        </Text>
        <Text style={[styles.dateText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
          {formatAppointmentDate(appointmentMeta.scheduledAt)}
        </Text>
        {appointmentMeta.location ? (
          <Text style={[styles.metaText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
            Địa điểm: {appointmentMeta.location}
          </Text>
        ) : null}
      </View>

      {appointmentMeta.description ? (
        <View style={[styles.descriptionBox, { backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
          <Text style={[styles.descriptionText, { color: isDark ? "#e2e8f0" : "#334155" }]}>
            {appointmentMeta.description}
          </Text>
        </View>
      ) : null}

      {isCreator && onDelete ? (
        <View style={styles.deleteWrap}>
          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={[
              styles.deleteButton,
              {
                backgroundColor: isDark ? "#2b1216" : "#fef2f2",
                borderColor: isDark ? "#7f1d1d" : "#fecaca",
                opacity: deleting ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.deleteButtonText}>
              {deleting ? "Dang xoa..." : "Xoa lich hen"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? "#052e16" : "#dcfce7" }]}>
          <Text style={[styles.summaryCount, { color: isDark ? "#86efac" : "#166534" }]}>{summary.going}</Text>
          <Text style={[styles.summaryLabel, { color: isDark ? "#86efac" : "#166534" }]}>Tham gia</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? "#451a03" : "#fef3c7" }]}>
          <Text style={[styles.summaryCount, { color: isDark ? "#fcd34d" : "#92400e" }]}>{summary.maybe}</Text>
          <Text style={[styles.summaryLabel, { color: isDark ? "#fcd34d" : "#92400e" }]}>Có thể</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? "#450a0a" : "#fee2e2" }]}>
          <Text style={[styles.summaryCount, { color: isDark ? "#fca5a5" : "#b91c1c" }]}>{summary.declined}</Text>
          <Text style={[styles.summaryLabel, { color: isDark ? "#fca5a5" : "#b91c1c" }]}>Từ chối</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        {appointmentActionStatuses.map((status) => {
          const isSelected = currentResponse === status;

          return (
            <Pressable
              key={status}
              onPress={() => void handleRespond(status)}
              disabled={Boolean(submittingStatus) || deleting}
              style={[
                styles.responseButton,
                {
                  backgroundColor: isSelected
                    ? "#8b5cf6"
                    : isDark ? "#0f172a" : "#f8fafc",
                  borderColor: isSelected
                    ? "#8b5cf6"
                    : isDark ? "#334155" : "#e2e8f0",
                  opacity: Boolean(submittingStatus) ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.responseButtonText,
                  { color: isSelected ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" },
                ]}
              >
                {submittingStatus === status ? "Đang gửi..." : responseLabels[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 220,
    gap: 10,
  },
  header: {
    gap: 4,
  },
  titleLabel: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 13,
    fontWeight: "700",
  },
  metaText: {
    fontSize: 12,
    lineHeight: 18,
  },
  descriptionBox: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteWrap: {
    alignItems: "flex-end",
  },
  deleteButton: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  responseButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  responseButtonText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
