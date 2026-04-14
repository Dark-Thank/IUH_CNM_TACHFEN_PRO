import { useChatStore } from '@/stores/useChatStore';
import { useState } from 'react';
import type { Conversation } from "@/types/chat";
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '../ui/button';
import { ImagePlus, Send } from 'lucide-react';
import { Input } from "../ui/input";
import EmmojiPicker from './EmmojiPicker';
import { toast } from 'sonner';

const MessageInput = ({ selectedConvo }: { selectedConvo: Conversation }) => {
    const { user } = useAuthStore();
    const { sendDirectMessage, sendGroupMessage } = useChatStore();

    const [value, setValue] = useState("");
    const [image, setImage] = useState<File | null>(null);

    if (!user) return null;

    const sendMessage = async () => {
        if (!value.trim() && !image) return;

        const formData = new FormData();
        formData.append("content", value);

        if (image) {
            formData.append("image", image); //  QUAN TRỌNG
        }

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
            setImage(null);

        } catch (error) {
            console.error(error);
            toast.error("Lỗi gửi tin nhắn!");
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

            {/* PREVIEW ẢNH */}
            {image && (
                <div className="relative w-fit">
                    <img
                        src={URL.createObjectURL(image)}
                        className="w-20 h-20 object-cover rounded"
                    />
                    <button
                        onClick={() => setImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-1"
                    >
                        x
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2">

                {/* CHỌN ẢNH */}
                <label>
                    <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setImage(file);
                        }}
                    />
                    <Button variant="ghost" size="icon" asChild>
                        <span>
                            <ImagePlus className="size-4" />
                        </span>
                    </Button>
                </label>

                <div className="flex-1 relative">
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Soạn tin nhắn..."
                        className="pr-16"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <EmmojiPicker
                            onChange={(emoji: string) =>
                                setValue((prev) => prev + emoji)
                            }
                        />
                    </div>
                </div>

                <Button
                    onClick={sendMessage}
                    disabled={!value.trim() && !image}
                >
                    <Send className="size-4 text-white" />
                </Button>
            </div>
        </div>
    );
};

export default MessageInput;