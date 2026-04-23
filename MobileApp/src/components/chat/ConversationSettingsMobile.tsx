import { useState } from "react";
import {
    View,
    Text,
    Image,
    Pressable,
    Modal,
    TextInput,
    ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { chatService } from "@/services/chatServiec";
import { useChatStore } from "@/stores/useChatStore";
import { getApiBaseUrl } from "@/lib/backendUrl";
import type { Conversation } from "@/types/chat";

type Props = {
    conversation: Conversation;
};

export default function ConversationSettingsMobile({ conversation }: Props) {
    const [uploading, setUploading] = useState(false);
    const [openRename, setOpenRename] = useState(false);
    const [newName, setNewName] = useState(conversation.group?.name || "");
    const [loadingRename, setLoadingRename] = useState(false);
    const [openMembers, setOpenMembers] = useState(false);

    if (!conversation) return null;

    // =====================
    // 🎯 ĐỔI AVATAR
    // =====================
    const handleChangeAvatar = async () => {
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
        if (!newName.trim()) return;

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
            <Text style={{ fontWeight: "700", fontSize: 15 }}>
                Cài đặt nhóm
            </Text>

            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                {/* ================= AVATAR ================= */}
                <Pressable onPress={handleChangeAvatar}>
                    <View>
                        <Image
                            source={{
                                uri: conversation.group?.avatar
                                    ? conversation.group.avatar.startsWith("http")
                                        ? conversation.group.avatar
                                        : `${getApiBaseUrl()}${conversation.group.avatar}`
                                    : "https://cdn-icons-png.flaticon.com/512/847/847969.png",
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

                {/* ================= INFO ================= */}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600" }}>
                        {conversation.group?.name || "Nhóm"}
                    </Text>

                    <Text style={{ fontSize: 12, color: "#94a3b8" }}>
                        {conversation.participants.length} thành viên
                    </Text>

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                        <Pressable onPress={() => setOpenMembers(true)}>
                            <Text style={{ color: "#3b82f6", fontSize: 12 }}>
                                Thành viên
                            </Text>
                        </Pressable>

                        <Pressable onPress={() => setOpenRename(true)}>
                            <Text style={{ color: "#3b82f6", fontSize: 12 }}>
                                Đổi tên
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>

            {/* ================= MODAL ĐỔI TÊN ================= */}
            <Modal visible={openRename} transparent animationType="fade">
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
                            backgroundColor: "#fff",
                            padding: 16,
                            borderRadius: 12,
                            width: "80%",
                        }}
                    >
                        <Text style={{ fontWeight: "700", marginBottom: 10 }}>
                            Đổi tên nhóm
                        </Text>

                        <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="Tên nhóm mới"
                            style={{
                                borderWidth: 1,
                                borderColor: "#ccc",
                                borderRadius: 8,
                                padding: 8,
                                marginBottom: 12,
                            }}
                        />

                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                gap: 10,
                            }}
                        >
                            <Pressable onPress={() => setOpenRename(false)}>
                                <Text>Huỷ</Text>
                            </Pressable>

                            <Pressable onPress={handleRenameGroup}>
                                <Text style={{ color: "#3b82f6" }}>
                                    {loadingRename ? "Đang lưu..." : "Lưu"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ================= MEMBERS ================= */}
            <Modal visible={openMembers} transparent>
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
                            backgroundColor: "#fff",
                            borderRadius: 12,
                            padding: 16,
                            width: "80%",
                            maxHeight: "70%",
                        }}
                    >
                        <Text style={{ fontWeight: "700", marginBottom: 10 }}>
                            Thành viên
                        </Text>

                        {conversation.participants.map((m: any) => (
                            <View key={m._id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                                <Image
                                    source={{
                                        uri:
                                            m.avatarUrl ||
                                            "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                                    }}
                                    style={{ width: 30, height: 30, borderRadius: 15, marginRight: 8 }}
                                />
                                <Text>{m.displayName}</Text>
                            </View>
                        ))}

                        <Pressable onPress={() => setOpenMembers(false)}>
                            <Text style={{ color: "#3b82f6", marginTop: 10 }}>
                                Đóng
                            </Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}