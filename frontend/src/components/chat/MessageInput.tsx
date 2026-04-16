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
    const [images, setImages] = useState<File[]>([]);

    if (!user) return null;

    const sendMessage = async () => {
        if (!value.trim() && images.length === 0) return;

        const formData = new FormData();
        formData.append("content", value);

        //  gửi nhiều ảnh đúng key "images"
        images.forEach((img) => {
            formData.append("images", img);
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
            setImages([]);

        } catch (error: any) {
            console.error(error);
            toast.error("Lỗi gửi tin nhắn!");
            // Check if error is due to being blocked
            if (error.response?.status === 403 && error.response?.data?.message?.includes("chặn")) {
                setIsBlocked(true);
                toast.error("Bạn đã bị chặn và không thể gửi tin nhắn");
            } else {
                toast.error("Lỗi xảy ra khi gửi tin nhắn. Bạn hãy thử lại!");
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

            {/* PREVIEW NHIỀU ẢNH */}
            {images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {images.map((img, idx) => (
                        <div key={idx} className="relative">
                            <img
                                src={URL.createObjectURL(img)}
                                className="w-20 h-20 object-cover rounded"
                            />
                            <button
                                onClick={() =>
                                    setImages(images.filter((_, i) => i !== idx))
                                }
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-1"
                            >
                                x
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* INPUT AREA */}
            <div className="flex items-center gap-2">

                {/* CHỌN ẢNH */}
                <label>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setImages((prev) => [...prev, ...files]);
                        }}
                    />

                    <Button variant="ghost" size="icon" asChild>
                        <span>
                            <ImagePlus className="size-4" />
                        </span>
                    </Button>
                </label>

                {/* TEXT INPUT */}
                <div className="flex-1 relative">
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder={isBlocked ? "Bạn không thể nhắn tin..." : "Soạn tin nhắn..."}
                        disabled={isBlocked}
                        className="pr-20 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <EmmojiPicker
                            onChange={(emoji: string) =>
                                setValue((prev) => prev + emoji)
                            }
                        />
                    </div>
                </div>

                {/* SEND BUTTON */}
                <Button
                    onClick={sendMessage}
                    disabled={!value.trim() && images.length === 0 || isBlocked}
                >
                    <Send className="size-4 text-white" />
                </Button>
            </div>
        
        </div>
    );
};

export default MessageInput;