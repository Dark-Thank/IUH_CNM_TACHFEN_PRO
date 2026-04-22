import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeStore } from "@/stores/useThemeStore";

type DateTimePickerFieldProps = {
  label: string;
  placeholder: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  clearable?: boolean;
  minimumDate?: Date;
};

const DATE_WINDOW_DAYS = 30;
const MINUTE_STEP = 15;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((item) => Number.parseInt(item, 10));
  return new Date(year, month - 1, day);
};

const buildDateOptions = (minimumDate: Date) => {
  const base = startOfDay(minimumDate);

  return Array.from({ length: DATE_WINDOW_DAYS }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return date;
  });
};

const buildTimeOptions = () =>
  Array.from({ length: (24 * 60) / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);

const formatMinuteValue = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
};

const formatFieldValue = (value?: string | null) => {
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

const formatDateLabel = (date: Date, minimumDate: Date) => {
  const today = startOfDay(minimumDate);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) {
    return `Hom nay, ${new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    }).format(date)}`;
  }

  if (isSameDay(date, tomorrow)) {
    return `Ngay mai, ${new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    }).format(date)}`;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

const roundUpToNextStep = (date: Date) => {
  const next = new Date(date);
  const totalMinutes = next.getHours() * 60 + next.getMinutes();
  const addMinutes = MINUTE_STEP - (totalMinutes % MINUTE_STEP || MINUTE_STEP);
  const roundedMinutes = totalMinutes + addMinutes;

  next.setHours(0, 0, 0, 0);
  next.setMinutes(roundedMinutes);

  return next;
};

const buildCandidateDate = (dateKey: string, minuteValue: number) => {
  const date = parseDateKey(dateKey);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minuteValue);
  return date;
};

const getAvailableMinuteOptions = (dateKey: string, minimumDate: Date) =>
  buildTimeOptions().filter((minuteValue) =>
    buildCandidateDate(dateKey, minuteValue).getTime() > minimumDate.getTime()
  );

export default function DateTimePickerField({
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  clearable = false,
  minimumDate,
}: DateTimePickerFieldProps) {
  const { isDark } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [draftDateKey, setDraftDateKey] = useState("");
  const [draftMinuteValue, setDraftMinuteValue] = useState<number | null>(null);

  const resolvedMinimumDate = useMemo(
    () => minimumDate ?? new Date(),
    [minimumDate]
  );
  const displayValue = formatFieldValue(value);
  const dateOptions = useMemo(() => buildDateOptions(resolvedMinimumDate), [resolvedMinimumDate]);
  const availableMinuteOptions = useMemo(
    () => (draftDateKey ? getAvailableMinuteOptions(draftDateKey, resolvedMinimumDate) : []),
    [draftDateKey, resolvedMinimumDate]
  );

  const openPicker = () => {
    const parsedValue = value ? new Date(value) : null;
    const baseValue = parsedValue && !Number.isNaN(parsedValue.getTime()) && parsedValue.getTime() > resolvedMinimumDate.getTime()
      ? parsedValue
      : roundUpToNextStep(resolvedMinimumDate);

    const nextDateKey = toDateKey(baseValue);
    const nextMinuteValue = baseValue.getHours() * 60 + baseValue.getMinutes();
    const nextAvailableMinuteOptions = getAvailableMinuteOptions(nextDateKey, resolvedMinimumDate);

    setDraftDateKey(nextDateKey);
    setDraftMinuteValue(
      nextAvailableMinuteOptions.includes(nextMinuteValue)
        ? nextMinuteValue
        : (nextAvailableMinuteOptions[0] ?? null)
    );
    setOpen(true);
  };

  const handleSelectDate = (dateKey: string) => {
    const nextAvailableMinuteOptions = getAvailableMinuteOptions(dateKey, resolvedMinimumDate);

    setDraftDateKey(dateKey);
    setDraftMinuteValue((current) => (
      current !== null && nextAvailableMinuteOptions.includes(current)
        ? current
        : (nextAvailableMinuteOptions[0] ?? null)
    ));
  };

  const handleConfirm = () => {
    if (!draftDateKey || draftMinuteValue === null) {
      return;
    }

    const selectedDate = buildCandidateDate(draftDateKey, draftMinuteValue);

    if (selectedDate.getTime() <= resolvedMinimumDate.getTime()) {
      return;
    }

    onChange(selectedDate.toISOString());
    setOpen(false);
  };

  return (
    <>
      <View style={styles.fieldWrap}>
        <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>
          {label}
        </Text>

        <View style={styles.fieldRow}>
          <Pressable
            disabled={disabled}
            onPress={openPicker}
            style={[
              styles.fieldButton,
              {
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.fieldButtonText,
                { color: displayValue ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#64748b" : "#94a3b8") },
              ]}
            >
              {displayValue || placeholder}
            </Text>
          </Pressable>

          {clearable && value ? (
            <Pressable
              disabled={disabled}
              onPress={() => onChange(null)}
              style={[
                styles.clearButton,
                {
                  backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.clearButtonText, { color: isDark ? "#e2e8f0" : "#334155" }]}>
                Xoa
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)} />

          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              {label}
            </Text>

            <Text style={[styles.sectionTitle, { color: isDark ? "#cbd5e1" : "#475569" }]}>
              Chon ngay
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
              {dateOptions.map((date) => {
                const dateKey = toDateKey(date);
                const selected = draftDateKey === dateKey;

                return (
                  <Pressable
                    key={dateKey}
                    onPress={() => handleSelectDate(dateKey)}
                    style={[
                      styles.dateChip,
                      {
                        backgroundColor: selected
                          ? "#8b5cf6"
                          : isDark ? "#0f172a" : "#f8fafc",
                        borderColor: selected
                          ? "#8b5cf6"
                          : isDark ? "#334155" : "#e2e8f0",
                      },
                    ]}
                  >
                    <Text style={[styles.dateChipText, { color: selected ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" }]}>
                      {formatDateLabel(date, resolvedMinimumDate)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: isDark ? "#cbd5e1" : "#475569" }]}>
              Chon gio
            </Text>
            <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.timeGrid}>
                {availableMinuteOptions.map((minuteValue) => {
                  const selected = draftMinuteValue === minuteValue;

                  return (
                    <Pressable
                      key={`${draftDateKey}-${minuteValue}`}
                      onPress={() => setDraftMinuteValue(minuteValue)}
                      style={[
                        styles.timeChip,
                        {
                          backgroundColor: selected
                            ? "#8b5cf6"
                            : isDark ? "#0f172a" : "#f8fafc",
                          borderColor: selected
                            ? "#8b5cf6"
                            : isDark ? "#334155" : "#e2e8f0",
                        },
                      ]}
                    >
                      <Text style={[styles.timeChipText, { color: selected ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" }]}>
                        {formatMinuteValue(minuteValue)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => setOpen(false)}
                style={[
                  styles.footerButton,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                  },
                ]}
              >
                <Text style={[styles.footerButtonText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  Huy
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                disabled={draftMinuteValue === null}
                style={[
                  styles.footerButton,
                  styles.confirmButton,
                  { opacity: draftMinuteValue === null ? 0.5 : 1 },
                ]}
              >
                <Text style={[styles.footerButtonText, styles.confirmButtonText]}>
                  Xac nhan
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 10,
  },
  fieldButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  fieldButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  clearButton: {
    minWidth: 68,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  modalCard: {
    borderRadius: 28,
    borderWidth: 1,
    maxHeight: "84%",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  dateList: {
    gap: 10,
    paddingRight: 8,
  },
  dateChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  timeScroll: {
    maxHeight: 260,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 4,
  },
  timeChip: {
    width: "22%",
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  footerButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  confirmButton: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  confirmButtonText: {
    color: "#ffffff",
  },
});
