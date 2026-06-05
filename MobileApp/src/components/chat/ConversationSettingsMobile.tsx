import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

import { getApiBaseUrl } from "@/lib/backendUrl";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation } from "@/types/chat";
import UserAvatar from "./UserAvatar";

type Props = {
    conversation: Conversation;
};

export default function ConversationSettingsMobile({ conversation }: Props) {
    const [uploading, setUploading] = useState(false);
    const [openRename, setOpenRename] = useState(false);
    const [newName, setNewName] = useState(conversation.group?.name || "");
    const [loadingRename, setLoadingRename] = useState(false);
    const [openMembers, setOpenMembers] = useState(false);
    const user = useAuthStore((state) => state.user);
    const { isDark } = useThemeStore();

    if (!conversation) return null;

    const isGroupConversation = conversation.type === "group";
    const directParticipant = isGroupConversation
        ? null
        : conversation.participants.find((participant) => participant._id !== user?._id) ?? conversation.participants[0] ?? null;
    const groupAvatarUri = conversation.group?.avatar
        ? conversation.group.avatar.startsWith("http")
            ? conversation.group.avatar
            : `${getApiBaseUrl()}${conversation.group.avatar}`
        : null;

    // =====================
    // 🎯 ĐỔI AVATAR
    // =====================

    const cardBackground = isDark ? "#111827" : "#ffffff";
    const cardBorder = isDark ? "#312e81" : "#ddd6fe";
    const inputBackground = isDark ? "#1f2937" : "#f8fafc";
    const inputBorder = isDark ? "#4338ca" : "#c4b5fd";
    const primaryText = isDark ? "#f8fafc" : "#0f172a";
    const secondaryText = isDark ? "#cbd5e1" : "#64748b";
    const accentColor = isDark ? "#c4b5fd" : "#7c3aed";
    const accentSurface = isDark ? "#312e81" : "#ede9fe";

    const handleChangeAvatar = async () => {
        if (!isGroupConversation) {
            return;
        }

        try {
            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.7,
            });

            if (res.canceled) return;

            const asset = res.assets[0];

            // validate giống web
            if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) {
                console.log("File quá lớn");
                return;
            }

            const file = {
                uri: asset.uri,
                name: asset.fileName || "avatar.jpg",
                type: asset.mimeType || "image/jpeg",
            };

            console.log("UPLOAD FILE:", file);

            setUploading(true);

            const updated = await chatService.updateGroupAvatar(
                conversation._id,
                file
            );

            console.log("UPLOAD SUCCESS:", updated);

            //  update UI ngay (giống web)
            useChatStore.getState().updateConversation({
                _id: conversation._id,
                group: {
                    ...conversation.group,
                    avatar: updated.conversation.group.avatar,
                },
            });
        } catch (err) {
            console.log("UPLOAD ERROR:", err);
        } finally {
            setUploading(false);
        }
    };

    // =====================
    // 🎯 ĐỔI TÊN
    // =====================
    const handleRenameGroup = async () => {
        if (!isGroupConversation || !newName.trim()) return;

        try {
            setLoadingRename(true);

            await chatService.updateGroupName(conversation._id, newName);

            //  update UI ngay
            useChatStore.getState().updateConversation({
                _id: conversation._id,
                group: {
                    ...conversation.group,
                    name: newName,
                },
            });

            setOpenRename(false);
        } catch (err) {
            console.log("Rename error:", err);
        } finally {
            setLoadingRename(false);
        }
    };
    console.log("CONVERSATION:", conversation);
    console.log("PARTICIPANTS:", conversation.participants);
    return (
        <View style={{ gap: 12 }}>
            <Text style={{ fontWeight: "700", fontSize: 15, color: primaryText }}>
                {isGroupConversation ? "Cài đặt nhóm" : "Cài đặt chung"}
            </Text>

            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                {isGroupConversation ? (
                    <Pressable onPress={handleChangeAvatar}>
                        <View>
                            <Image
                                source={{
                                    uri: groupAvatarUri || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                                }}
                                style={{ width: 50, height: 50, borderRadius: 25 }}
                                onError={(e) => console.log("IMAGE ERROR:", e.nativeEvent)}
                            />

                            {uploading && (
                                <View
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        backgroundColor: "rgba(0,0,0,0.5)",
                                        borderRadius: 25,
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <Text style={{ color: "#fff", fontSize: 10 }}>
                                        Đang tải...
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Pressable>
                ) : (
                    <UserAvatar
                        name={directParticipant?.displayName || "Người dùng"}
                        avatarUrl={directParticipant?.avatarUrl}
                        size={50}
                    />
                )}

                {/* ================= INFO ================= */}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", color: primaryText }}>
                        {isGroupConversation
                            ? conversation.group?.name || "Nhóm"
                            : directParticipant?.displayName || "Người dùng"}
                    </Text>

                    <Text style={{ fontSize: 12, color: secondaryText }}>
                        {isGroupConversation
                            ? `${conversation.participants.length} thành viên`
                            : "Cuộc trò chuyện cá nhân"}
                    </Text>

                    {isGroupConversation ? (
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                            <Pressable onPress={() => setOpenMembers(true)}>
                                <Text style={{ color: accentColor, fontSize: 12, fontWeight: "600" }}>
                                    Thành viên
                                </Text>
                            </Pressable>

                            <Pressable onPress={() => setOpenRename(true)}>
                                <Text style={{ color: accentColor, fontSize: 12, fontWeight: "600" }}>
                                    Đổi tên
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}
                </View>
            </View>

            {/* ================= MODAL ĐỔI TÊN ================= */}
            <Modal visible={isGroupConversation && openRename} transparent animationType="fade" onRequestClose={() => setOpenRename(false)}>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <View
                        style={{
                            backgroundColor: cardBackground,
                            borderColor: cardBorder,
                            borderWidth: 1,
                            padding: 18,
                            borderRadius: 20,
                            width: "80%",
                            gap: 14,
                        }}
                    >
                        <View style={{ gap: 4 }}>
                            <Text style={{ fontWeight: "700", fontSize: 17, color: primaryText }}>
                                Đổi tên nhóm
                            </Text>
                            <Text style={{ color: secondaryText, fontSize: 13, lineHeight: 18 }}>
                                Tên mới sẽ hiển thị cho toàn bộ thành viên trong nhóm.
                            </Text>
                        </View>

                        <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="Tên nhóm mới"
                            placeholderTextColor={secondaryText}
                            style={{
                                borderWidth: 1,
                                borderColor: inputBorder,
                                backgroundColor: inputBackground,
                                color: primaryText,
                                borderRadius: 14,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                fontSize: 15,
                            }}
                        />

                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                gap: 10,
                            }}
                        >
                            <Pressable
                                onPress={() => setOpenRename(false)}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 999,
                                    backgroundColor: inputBackground,
                                    borderWidth: 1,
                                    borderColor: inputBorder,
                                }}
                            >
                                <Text style={{ color: primaryText, fontWeight: "600" }}>Huỷ</Text>
                            </Pressable>

                            <Pressable
                                onPress={handleRenameGroup}
                                style={{
                                    minWidth: 90,
                                    alignItems: "center",
                                    paddingHorizontal: 18,
                                    paddingVertical: 10,
                                    borderRadius: 999,
                                    backgroundColor: accentColor,
                                }}
                            >
                                <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                                    {loadingRename ? "Đang lưu..." : "Lưu"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ================= MEMBERS ================= */}
            <Modal visible={isGroupConversation && openMembers} transparent onRequestClose={() => setOpenMembers(false)}>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <ScrollView
                        style={{
                            backgroundColor: cardBackground,
                            borderColor: cardBorder,
                            borderWidth: 1,
                            borderRadius: 18,
                            padding: 16,
                            width: "80%",
                            maxHeight: "70%",
                        }}
                    >
                        <Text style={{ fontWeight: "700", marginBottom: 12, color: primaryText }}>
                            Thành viên
                        </Text>

                        {conversation.participants.map((m: any) => (
                            <View
                                key={m._id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    marginBottom: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    borderRadius: 16,
                                    backgroundColor: accentSurface,
                                }}
                            >
                                <UserAvatar
                                    name={m.displayName || "TACHFEN"}
                                    avatarUrl={m.avatarUrl}
                                    size={34}
                                />
                                <Text style={{ color: primaryText, marginLeft: 10, fontWeight: "500" }}>
                                    {m.displayName}
                                </Text>
                            </View>
                        ))}

                        <Pressable
                            onPress={() => setOpenMembers(false)}
                            style={{
                                marginTop: 10,
                                alignSelf: "flex-end",
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 999,
                                backgroundColor: inputBackground,
                                borderWidth: 1,
                                borderColor: inputBorder,
                            }}
                        >
                            <Text style={{ color: accentColor, fontWeight: "700" }}>
                                Đóng
                            </Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}