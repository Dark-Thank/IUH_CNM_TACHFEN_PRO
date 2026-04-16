import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import type { Conversation } from "@/types/chat";
import { ImagePlus, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from "../ui/input";
import EmmojiPicker from './EmmojiPicker';

const MessageInput = ({ selectedConvo, isBlocked: propIsBlocked }: { selectedConvo: Conversation, isBlocked: boolean }) => {
    const { user } = useAuthStore();
    const { sendDirectMessage, sendGroupMessage } = useChatStore();

    const [isBlocked, setIsBlocked] = useState(false);

    // Sync the prop value to local state
    useEffect(() => {
        setIsBlocked(propIsBlocked);
    }, [propIsBlocked]);

    const [value, setValue] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    if (!user) return null;

    const sendMessage = async () => {
        if (!value.trim() && files.length === 0) return;

        const formData = new FormData();
        formData.append("content", value);

        //  gửi đúng key backend
        files.forEach((file) => {
            formData.append("files", file);
        });

        try {
            if (selectedConvo.type === "direct") {
                const otherUser = selectedConvo.participants.find(
                    (p) => p._id !== user._id
                );

                await sendDirectMessage(otherUser!._id, formData);
            } else {
                await sendGroupMessage(selectedConvo._id, formData);
            }

            setValue("");
            setFiles([]);

        } catch (error: any) {
            console.error(error);

            // if (error.response?.status === 403) {
            //     setIsBlocked(true);
            //     toast.error("Bạn đã bị chặn");

            // toast.error("Lỗi gửi tin nhắn!");
            // Check if error is due to being blocked
            if (error.response?.status === 403 && error.response?.data?.message?.includes("chặn")) {
                setIsBlocked(true);
                // toast.error("Bạn đã bị chặn và không thể gửi tin nhắn");
            } else {
                toast.error("Gửi tin nhắn thất bại!");
            }
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col gap-2 p-3 bg-background">

            {/*  PREVIEW FILE */}
            {files.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {files.map((file, idx) => {
                        const isImage = file.type.startsWith("image/");

                        return (
                            <div key={idx} className="relative">

                                {isImage ? (
                                    <img
                                        src={URL.createObjectURL(file)}
                                        className="w-20 h-20 object-cover rounded"
                                    />
                                ) : (
                                    <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded text-xs text-center p-1">
                                        📄 {file.name}
                                    </div>
                                )}

                                <button
                                    onClick={() =>
                                        setFiles(files.filter((_, i) => i !== idx))
                                    }
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-1"
                                >
                                    x
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* INPUT */}
            <div className="flex items-center gap-2">

                {/*  CHỌN FILE */}
                {/* IMAGE */}
                <label>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => {
                            const selected = Array.from(e.target.files || []);
                            setFiles((prev) => [...prev, ...selected]);
                        }}
                    />
                    <Button variant="ghost" size="icon" asChild>
                        <span><ImagePlus className="size-4" /></span>
                    </Button>
                </label>

                {/* FILE */}
                <label>
                    <input
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => {
                            const selected = Array.from(e.target.files || []);
                            setFiles((prev) => [...prev, ...selected]);
                        }}
                    />
                    <Button variant="ghost" size="icon" asChild>
                        <span>📎</span>
                    </Button>
                </label>

                {/* TEXT */}
                <div className="flex-1 relative">
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder={isBlocked ? "Bạn không thể nhắn tin..." : "Soạn tin nhắn..."}
                        disabled={isBlocked}
                        className="pr-20 h-9 bg-white"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <EmmojiPicker
                            onChange={(emoji: string) =>
                                setValue((prev) => prev + emoji)
                            }
                        />
                    </div>
                </div>

                {/* SEND */}
                <Button
                    onClick={sendMessage}
                    disabled={(!value.trim() && files.length === 0) || isBlocked}
                >
                    <Send className="size-4 text-white" />
                </Button>
            </div>

        </div>
    );
};

export default MessageInput;