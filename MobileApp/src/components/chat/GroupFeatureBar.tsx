import { toast } from "@/lib/toast";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { CalendarPlus, ListChecks, Plus, Trash2, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePickerField from "./DateTimePickerField";

type GroupFeatureBarProps = {
  conversationId: string;
  disabled?: boolean;
  mode?: "default" | "inline";
};

const defaultPollOptions = ["", ""];

const ActionModal = ({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const { isDark } = useThemeStore();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboard}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                {title}
              </Text>

              <Pressable
                onPress={onClose}
                style={[
                  styles.modalCloseButton,
                  { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" },
                ]}
              >
                <X size={18} color={isDark ? "#f8fafc" : "#0f172a"} />
              </Pressable>
            </View>

            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default function GroupFeatureBar({
  conversationId,
  disabled = false,
  mode = "default",
}: GroupFeatureBarProps) {
  const { isDark } = useThemeStore();
  const { createGroupPoll, createGroupAppointment } = useChatStore();

  const [showPollModal, setShowPollModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(defaultPollOptions);
  const [pollExpiresAt, setPollExpiresAt] = useState<string | null>(null);

  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [appointmentDescription, setAppointmentDescription] = useState("");
  const [appointmentLocation, setAppointmentLocation] = useState("");
  const [appointmentScheduledAt, setAppointmentScheduledAt] = useState<string | null>(null);

  const resetPollState = () => {
    setPollQuestion("");
    setPollOptions(defaultPollOptions);
    setPollExpiresAt(null);
    setSubmitting(false);
  };

  const resetAppointmentState = () => {
    setAppointmentTitle("");
    setAppointmentDescription("");
    setAppointmentLocation("");
    setAppointmentScheduledAt(null);
    setSubmitting(false);
  };

  const handlePollOptionChange = (index: number, value: string) => {
    setPollOptions((current) =>
      current.map((option, optionIndex) => (
        optionIndex === index ? value : option
      ))
    );
  };

  const handleAddPollOption = () => {
    setPollOptions((current) => (
      current.length >= 10 ? current : [...current, ""]
    ));
  };

  const handleRemovePollOption = (index: number) => {
    setPollOptions((current) => (
      current.length <= 2 ? current : current.filter((_, optionIndex) => optionIndex !== index)
    ));
  };

  const handleSubmitPoll = async () => {
    const normalizedQuestion = pollQuestion.trim();
    const normalizedOptions = pollOptions.map((option) => option.trim()).filter(Boolean);

    if (!normalizedQuestion) {
      toast.error("Nhap cau hoi binh chon");
      return;
    }

    if (normalizedOptions.length < 2) {
      toast.error("Can it nhat 2 lua chon");
      return;
    }

    if (pollExpiresAt && new Date(pollExpiresAt).getTime() <= Date.now()) {
      toast.error("Han vote phai lon hon thoi diem hien tai");
      return;
    }

    try {
      setSubmitting(true);
      await createGroupPoll(conversationId, {
        question: normalizedQuestion,
        options: normalizedOptions,
        expiresAt: pollExpiresAt,
      });
      setShowPollModal(false);
      resetPollState();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Khong the tao vote");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAppointment = async () => {
    const normalizedTitle = appointmentTitle.trim();

    if (!normalizedTitle) {
      toast.error("Nhap tieu de lich hen");
      return;
    }

    if (!appointmentScheduledAt) {
      toast.error("Ngay gio lich hen khong hop le");
      return;
    }

    if (new Date(appointmentScheduledAt).getTime() <= Date.now()) {
      toast.error("Thoi gian lich hen phai lon hon thoi diem hien tai");
      return;
    }

    try {
      setSubmitting(true);
      await createGroupAppointment(conversationId, {
        title: normalizedTitle,
        description: appointmentDescription.trim(),
        location: appointmentLocation.trim(),
        scheduledAt: appointmentScheduledAt,
      });
      setShowAppointmentModal(false);
      resetAppointmentState();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Khong the tao lich hen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {mode === "inline" ? (
        <>
          <Pressable
            accessibilityLabel="Tạo vote"
            disabled={disabled}
            onPress={() => setShowPollModal(true)}
            style={[
              styles.inlineActionButton,
              {
                backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <ListChecks size={18} color={isDark ? "#e9d5ff" : "#7c3aed"} />
          </Pressable>

          <Pressable
            accessibilityLabel="Tạo lịch hẹn"
            disabled={disabled}
            onPress={() => setShowAppointmentModal(true)}
            style={[
              styles.inlineActionButton,
              {
                backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <CalendarPlus size={18} color={isDark ? "#bfdbfe" : "#2563eb"} />
          </Pressable>
        </>
      ) : (
        <View style={styles.row}>
          <Pressable
            disabled={disabled}
            onPress={() => setShowPollModal(true)}
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                borderColor: isDark ? "#334155" : "#e2e8f0",
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <ListChecks size={16} color={isDark ? "#e9d5ff" : "#7c3aed"} />
            <Text style={[styles.actionText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Tao vote
            </Text>
          </Pressable>

          <Pressable
            disabled={disabled}
            onPress={() => setShowAppointmentModal(true)}
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                borderColor: isDark ? "#334155" : "#e2e8f0",
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <CalendarPlus size={16} color={isDark ? "#bfdbfe" : "#2563eb"} />
            <Text style={[styles.actionText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Tao lich hen
            </Text>
          </Pressable>
        </View>
      )}

      <ActionModal
        visible={showPollModal}
        title="Tao vote cho nhom"
        onClose={() => {
          setShowPollModal(false);
          resetPollState();
        }}
      >
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <TextInput
            value={pollQuestion}
            onChangeText={setPollQuestion}
            placeholder="Cau hoi binh chon"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textInput,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          {pollOptions.map((option, index) => (
            <View key={`poll-option-${index}`} style={styles.optionRow}>
              <TextInput
                value={option}
                onChangeText={(value) => handlePollOptionChange(index, value)}
                placeholder={`Lua chon ${index + 1}`}
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                style={[
                  styles.textInput,
                  styles.optionInput,
                  {
                    color: isDark ? "#f8fafc" : "#0f172a",
                    backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                    borderColor: isDark ? "#1f2937" : "#e2e8f0",
                  },
                ]}
              />

              <Pressable
                onPress={() => handleRemovePollOption(index)}
                disabled={pollOptions.length <= 2}
                style={[
                  styles.iconOnlyButton,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                    opacity: pollOptions.length <= 2 ? 0.45 : 1,
                  },
                ]}
              >
                <Trash2 size={16} color={isDark ? "#fca5a5" : "#dc2626"} />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={handleAddPollOption}
            disabled={pollOptions.length >= 10}
            style={[styles.secondaryButton, { opacity: pollOptions.length >= 10 ? 0.5 : 1 }]}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.secondaryButtonText}>Them lua chon</Text>
          </Pressable>

          <DateTimePickerField
            label="Han vote"
            placeholder="Chon han vote"
            value={pollExpiresAt}
            onChange={setPollExpiresAt}
            clearable
            minimumDate={new Date()}
            disabled={submitting}
          />

          <Pressable
            onPress={() => void handleSubmitPoll()}
            disabled={submitting}
            style={[styles.primaryButton, { opacity: submitting ? 0.7 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Dang tao..." : "Gui vote"}</Text>
          </Pressable>
        </ScrollView>
      </ActionModal>

      <ActionModal
        visible={showAppointmentModal}
        title="Tao lich hen cho nhom"
        onClose={() => {
          setShowAppointmentModal(false);
          resetAppointmentState();
        }}
      >
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <TextInput
            value={appointmentTitle}
            onChangeText={setAppointmentTitle}
            placeholder="Tieu de lich hen"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textInput,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          <DateTimePickerField
            label="Thoi gian"
            placeholder="Chon ngay gio"
            value={appointmentScheduledAt}
            onChange={setAppointmentScheduledAt}
            minimumDate={new Date()}
            disabled={submitting}
          />

          <TextInput
            value={appointmentLocation}
            onChangeText={setAppointmentLocation}
            placeholder="Dia diem"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textInput,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          <TextInput
            value={appointmentDescription}
            onChangeText={setAppointmentDescription}
            multiline
            placeholder="Mo ta / ghi chu"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.textArea,
              {
                color: isDark ? "#f8fafc" : "#0f172a",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          />

          <Pressable
            onPress={() => void handleSubmitAppointment()}
            disabled={submitting}
            style={[styles.primaryButton, { opacity: submitting ? 0.7 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Dang tao..." : "Gui lich hen"}</Text>
          </Pressable>
        </ScrollView>
      </ActionModal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  inlineActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  actionText: {
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
  modalKeyboard: {
    flex: 1,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 28,
    borderWidth: 1,
    maxHeight: "82%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 12,
  },
  textInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  textArea: {
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  optionInput: {
    flex: 1,
  },
  iconOnlyButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
