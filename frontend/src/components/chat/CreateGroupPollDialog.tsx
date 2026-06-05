import { useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
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

type CreateGroupPollDialogProps = {
  conversationId: string;
  disabled?: boolean;
};

const defaultOptions = ["", ""];

const getDateTimeLocalMinValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const CreateGroupPollDialog = ({ conversationId, disabled = false }: CreateGroupPollDialogProps) => {
  const createGroupPoll = useChatStore((state) => state.createGroupPoll);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(defaultOptions);
  const [expiresAt, setExpiresAt] = useState("");
  const [hideVoters, setHideVoters] = useState(false);
  const [hideResultsUntilVote, setHideResultsUntilVote] = useState(false);
  const [allowMultipleChoices, setAllowMultipleChoices] = useState(false);
  const [allowUserAddedOptions, setAllowUserAddedOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setQuestion("");
    setOptions(defaultOptions);
    setExpiresAt("");
    setHideVoters(false);
    setHideResultsUntilVote(false);
    setAllowMultipleChoices(false);
    setAllowUserAddedOptions(true);
    setSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetState();
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions((current) => current.map((item, itemIndex) => (
      itemIndex === index ? value : item
    )));
  };

  const handleAddOption = () => {
    setOptions((current) => current.length >= 10 ? current : [...current, ""]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions((current) => {
      if (current.length <= 2) {
        return current;
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const handleSubmit = async () => {
    const normalizedQuestion = question.trim();
    const normalizedOptions = options.map((option) => option.trim()).filter(Boolean);

    if (!normalizedQuestion) {
      toast.error("Nhập câu hỏi bình chọn");
      return;
    }

    if (normalizedOptions.length < 2) {
      toast.error("Cần ít nhất 2 lựa chọn");
      return;
    }

    if (expiresAt) {
      const parsedExpiresAt = new Date(expiresAt);

      if (Number.isNaN(parsedExpiresAt.getTime()) || parsedExpiresAt.getTime() <= Date.now()) {
        toast.error("Hạn bỏ phiếu phải lớn hơn thời điểm hiện tại");
        return;
      }
    }

    try {
      setSubmitting(true);
      await createGroupPoll(conversationId, {
        question: normalizedQuestion,
        options: normalizedOptions,
        hideVoters,
        hideResultsUntilVote,
        allowMultipleChoices,
        allowUserAddedOptions,
        expiresAt: expiresAt || null,
      });
      setOpen(false);
      resetState();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Không thể tạo bình chọn");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled}>
          <ListChecks className="size-4" />
          <span className="sr-only">Tạo bình chọn</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo bình chọn cho nhóm</DialogTitle>
          <DialogDescription>
            Gửi một bình chọn để cả nhóm bỏ phiếu ngay trong khung chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="poll-question" className="text-sm font-medium">
              Câu hỏi
            </label>
            <Input
              id="poll-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ví dụ: Chọn khung giờ họp?"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">Lựa chọn</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleAddOption}
                disabled={submitting || options.length >= 10}
              >
                <Plus className="size-4" />
                Thêm lựa chọn
              </Button>
            </div>

            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={`poll-option-${index}`} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(event) => handleOptionChange(index, event.target.value)}
                    placeholder={`Lựa chọn ${index + 1}`}
                    disabled={submitting}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                    disabled={submitting || options.length <= 2}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="poll-expires-at" className="text-sm font-medium">
              Hạn bỏ phiếu
            </label>
            <Input
              id="poll-expires-at"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              min={getDateTimeLocalMinValue()}
              disabled={submitting}
            />
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Tùy chọn nâng cao</p>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={hideVoters}
                onChange={(event) => setHideVoters(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">Ẩn người bình chọn</span>
                <span className="block text-xs text-muted-foreground">
                  Không hiển thị danh tính người đã bỏ phiếu.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={hideResultsUntilVote}
                onChange={(event) => setHideResultsUntilVote(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">Ẩn kết quả khi chưa bình chọn</span>
                <span className="block text-xs text-muted-foreground">
                  Thành viên phải bình chọn mới thấy kết quả khi poll còn mở.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={allowMultipleChoices}
                onChange={(event) => setAllowMultipleChoices(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">Chọn nhiều phương án</span>
                <span className="block text-xs text-muted-foreground">
                  Cho phép mỗi thành viên chọn nhiều lựa chọn trong cùng poll.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={allowUserAddedOptions}
                onChange={(event) => setAllowUserAddedOptions(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">Có thể thêm phương án</span>
                <span className="block text-xs text-muted-foreground">
                  Thành viên trong nhóm có thể thêm lựa chọn mới khi poll còn mở.
                </span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Đang tạo..." : "Gửi bình chọn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupPollDialog;
