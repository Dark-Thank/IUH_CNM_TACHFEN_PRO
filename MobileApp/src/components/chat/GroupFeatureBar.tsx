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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePickerField from "./DateTimePickerField";

type GroupFeatureBarProps = {
  conversationId: string;
  disabled?: boolean;
  mode?: "default" | "inline";
  extraMenuActions?: Array<{
    key: string;
    title: string;
    description: string;
    icon: ReactNode;
    onPress: () => void;
  }>;
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

const InlineFeatureMenu = ({
  visible,
  onClose,
  onSelectAppointment,
  extraActions = [],
}: {
  visible: boolean;
  onClose: () => void;
  onSelectAppointment: () => void;
  extraActions?: GroupFeatureBarProps["extraMenuActions"];
}) => {
  const { isDark } = useThemeStore();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.menuRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: isDark ? "#111827" : "#ffffff",
              borderColor: isDark ? "#1f2937" : "#e2e8f0",
            },
          ]}
        >
          <Text style={[styles.menuTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Tính năng nhóm</Text>

          <Pressable
            onPress={onSelectAppointment}
            style={[
              styles.menuAction,
              { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
            ]}
          >
            <View style={[styles.menuActionIcon, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.18)" : "#dbeafe" }]}>
              <CalendarPlus size={18} color={isDark ? "#93c5fd" : "#2563eb"} />
            </View>
            <View style={styles.menuActionContent}>
              <Text style={[styles.menuActionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Đặt lịch hẹn</Text>
              <Text style={[styles.menuActionDescription, { color: isDark ? "#94a3b8" : "#64748b" }]}>Tạo lịch hẹn và gửi vào cuộc trò chuyện.</Text>
            </View>
          </Pressable>

          {extraActions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={[
                styles.menuAction,
                { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
              ]}
            >
              <View style={[styles.menuActionIcon, { backgroundColor: isDark ? "rgba(148, 163, 184, 0.18)" : "#e2e8f0" }]}>
                {action.icon}
              </View>
              <View style={styles.menuActionContent}>
                <Text style={[styles.menuActionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>{action.title}</Text>
                <Text style={[styles.menuActionDescription, { color: isDark ? "#94a3b8" : "#64748b" }]}>{action.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
};

export default function GroupFeatureBar({
  conversationId,
  disabled = false,
  mode = "default",
  extraMenuActions,
}: GroupFeatureBarProps) {
  const { isDark } = useThemeStore();
  const { createGroupPoll, createGroupAppointment } = useChatStore();

  const [showFeatureMenu, setShowFeatureMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(defaultPollOptions);
  const [pollExpiresAt, setPollExpiresAt] = useState<string | null>(null);
  const [pollHideVoters, setPollHideVoters] = useState(false);
  const [pollHideResultsUntilVote, setPollHideResultsUntilVote] = useState(false);
  const [pollAllowMultipleChoices, setPollAllowMultipleChoices] = useState(false);
  const [pollAllowUserAddedOptions, setPollAllowUserAddedOptions] = useState(true);

  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [appointmentDescription, setAppointmentDescription] = useState("");
  const [appointmentLocation, setAppointmentLocation] = useState("");
  const [appointmentScheduledAt, setAppointmentScheduledAt] = useState<string | null>(null);

  const openPollModal = () => {
    setShowFeatureMenu(false);
    setShowPollModal(true);
  };

  const openAppointmentModal = () => {
    setShowFeatureMenu(false);
    setShowAppointmentModal(true);
  };

  const resetPollState = () => {
    setPollQuestion("");
    setPollOptions(defaultPollOptions);
    setPollExpiresAt(null);
    setPollHideVoters(false);
    setPollHideResultsUntilVote(false);
    setPollAllowMultipleChoices(false);
    setPollAllowUserAddedOptions(true);
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
        hideVoters: pollHideVoters,
        hideResultsUntilVote: pollHideResultsUntilVote,
        allowMultipleChoices: pollAllowMultipleChoices,
        allowUserAddedOptions: pollAllowUserAddedOptions,
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
            accessibilityLabel="Tạo vote nhóm"
            disabled={disabled}
            onPress={openPollModal}
            style={[
              styles.inlineActionButton,
              {
                backgroundColor: isDark ? "#2e1065" : "#ede9fe",
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <ListChecks size={18} color={isDark ? "#e9d5ff" : "#6d28d9"} />
          </Pressable>

          <Pressable
            accessibilityLabel="Mở menu tính năng chat nhóm"
            disabled={disabled}
            onPress={() => setShowFeatureMenu(true)}
            style={[
              styles.inlineActionButton,
              {
                backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <Plus size={18} color={isDark ? "#f8fafc" : "#0f172a"} />
          </Pressable>

          <InlineFeatureMenu
            visible={showFeatureMenu}
            onClose={() => setShowFeatureMenu(false)}
            onSelectAppointment={openAppointmentModal}
            extraActions={extraMenuActions}
          />
        </>
      ) : (
        <View style={styles.row}>
          <Pressable
            disabled={disabled}
            onPress={openPollModal}
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
            onPress={openAppointmentModal}
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

          <View
            style={[
              styles.settingsCard,
              {
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <Text style={[styles.settingsTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Tuy chon nang cao
            </Text>

            {[
              {
                key: "hide-voters",
                label: "An nguoi binh chon",
                description: "Khong hien thi danh tinh nguoi da bo phieu.",
                value: pollHideVoters,
                onChange: setPollHideVoters,
              },
              {
                key: "hide-results",
                label: "An ket qua khi chua binh chon",
                description: "Ket qua chi hien sau khi thanh vien da bo phieu hoac poll da dong.",
                value: pollHideResultsUntilVote,
                onChange: setPollHideResultsUntilVote,
              },
              {
                key: "multi-choice",
                label: "Chon nhieu phuong an",
                description: "Moi thanh vien co the chon nhieu lua chon trong cung poll.",
                value: pollAllowMultipleChoices,
                onChange: setPollAllowMultipleChoices,
              },
              {
                key: "user-added-options",
                label: "Co the them phuong an",
                description: "Thanh vien trong nhom co the tu them lua chon moi.",
                value: pollAllowUserAddedOptions,
                onChange: setPollAllowUserAddedOptions,
              },
            ].map((setting) => (
              <View key={setting.key} style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={[styles.settingLabel, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                    {setting.label}
                  </Text>
                  <Text style={[styles.settingDescription, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                    {setting.description}
                  </Text>
                </View>

                <Switch
                  value={setting.value}
                  onValueChange={setting.onChange}
                  disabled={submitting}
                  trackColor={{ false: isDark ? "#334155" : "#cbd5e1", true: isDark ? "#6d28d9" : "#8b5cf6" }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>

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
  menuRoot: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  menuCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 6,
  },
  menuAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  menuActionContent: {
    flex: 1,
    gap: 2,
  },
  menuActionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  menuActionDescription: {
    fontSize: 12,
    lineHeight: 18,
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
  settingsCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingTextWrap: {
    flex: 1,
    gap: 3,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  settingDescription: {
    fontSize: 12,
    lineHeight: 17,
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
