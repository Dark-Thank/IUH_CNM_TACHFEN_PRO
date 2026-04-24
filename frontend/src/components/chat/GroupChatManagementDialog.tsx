import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Conversation, Participant } from "@/types/chat";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import UserAvatar from "./UserAvatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

type Props = {
    conversation: Conversation;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const ROLE_LABELS: Record<Participant["role"], string> = {
    owner: "Chủ nhóm",
    deputy: "Phó nhóm",
    member: "Thành viên",
};

const ROLE_BADGE_VARIANTS: Record<Participant["role"], "default" | "secondary" | "outline"> = {
    owner: "default",
    deputy: "secondary",
    member: "outline",
};

const matchesQuery = (value: string, query: string) =>
    value.toLowerCase().includes(query.trim().toLowerCase());

const GroupChatManagementDialog = ({ conversation, open, onOpenChange }: Props) => {
    const { user } = useAuthStore();
    const {
        loading: chatLoading,
        addGroupMembers,
        removeGroupMember,
        updateGroupMemberRole,
        transferGroupOwnership,
        leaveGroup,
        disbandGroup,
    } = useChatStore();
    const {
        friends,
        sentList,
        loading: friendLoading,
        getFriends,
        getAllFriendRequests,
        addFriend,
    } = useFriendStore();
    const [search, setSearch] = useState("");
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

    const friendIds = useMemo(() => new Set(friends.map((friend) => friend._id)), [friends]);
    const pendingInviteIds = useMemo(
        () => new Set(sentList.map((request) => request.to?._id).filter(Boolean)),
        [sentList]
    );

    const me = useMemo(
        () => conversation.participants.find((participant) => participant._id === user?._id) ?? null,
        [conversation.participants, user?._id]
    );

    const memberIds = useMemo(
        () => new Set(conversation.participants.map((participant) => participant._id)),
        [conversation.participants]
    );

    const availableFriends = useMemo(
        () =>
            friends.filter((friend) => {
                if (memberIds.has(friend._id)) {
                    return false;
                }

                if (!search.trim()) {
                    return true;
                }

                return matchesQuery(friend.displayName, search) || matchesQuery(friend.username, search);
            }),
        [friends, memberIds, search]
    );

    useEffect(() => {
        if (!open) {
            setSearch("");
            setSelectedFriendIds([]);
            return;
        }

        void getFriends();
        void getAllFriendRequests();
    }, [getAllFriendRequests, getFriends, open]);

    const canAddMembers = Boolean(me);
    const isOwner = me?.role === "owner";
    const isDeputy = me?.role === "deputy";

    const canRemoveParticipant = (participant: Participant) => {
        if (!me || participant._id === me._id) {
            return false;
        }

        if (isOwner) {
            return true;
        }

        if (isDeputy) {
            return participant.role !== "owner";
        }

        return false;
    };

    const toggleSelection = (friendId: string) => {
        setSelectedFriendIds((current) =>
            current.includes(friendId)
                ? current.filter((id) => id !== friendId)
                : [...current, friendId]
        );
    };

    const runAction = async (action: () => Promise<void>, successMessage: string) => {
        try {
            await action();
            toast.success(successMessage);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Thao tác thất bại");
        }
    };

    const handleAddMembers = async () => {
        if (selectedFriendIds.length === 0) {
            toast.warning("Hãy chọn ít nhất một người bạn để thêm vào nhóm");
            return;
        }

        await runAction(async () => {
            await addGroupMembers(conversation._id, selectedFriendIds);
            setSelectedFriendIds([]);
            setSearch("");
        }, "Đã thêm thành viên vào nhóm");
    };

    const handleSendFriendRequest = async (participant: Participant) => {
        const resultMessage = await addFriend(participant._id);

        if (!resultMessage) {
            toast.error("Không thể gửi lời mời kết bạn");
            return;
        }

        if (/lỗi|that bai|thất bại/i.test(resultMessage)) {
            toast.error(resultMessage);
            return;
        }

        toast.success(resultMessage);
        await getAllFriendRequests();
    };

    const handleRemoveMember = async (participant: Participant) => {
        if (!window.confirm(`Xóa ${participant.displayName} khỏi nhóm?`)) {
            return;
        }

        await runAction(
            () => removeGroupMember(conversation._id, participant._id),
            "Đã xóa thành viên khỏi nhóm"
        );
    };

    const handleToggleDeputy = async (participant: Participant) => {
        const nextRole = participant.role === "deputy" ? "member" : "deputy";
        const successMessage = nextRole === "deputy" ? "Đã bổ nhiệm phó nhóm" : "Đã thu hồi quyền phó nhóm";

        await runAction(
            () => updateGroupMemberRole(conversation._id, participant._id, nextRole),
            successMessage
        );
    };

    const handleTransferOwnership = async (participant: Participant) => {
        if (!window.confirm(`Chuyển quyền chủ nhóm cho ${participant.displayName}?`)) {
            return;
        }

        await runAction(
            () => transferGroupOwnership(conversation._id, participant._id),
            "Đã chuyển quyền chủ nhóm"
        );
    };

    const handleLeaveGroup = async () => {
        if (!window.confirm("Rời khỏi nhóm chat này?")) {
            return;
        }

        try {
            await leaveGroup(conversation._id);
            toast.success("Đã rời nhóm");
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Không thể rời nhóm");
        }
    };

    const handleDisbandGroup = async () => {
        if (!window.confirm("Giải tán nhóm chat này? Hành động này không thể hoàn tác.")) {
            return;
        }

        try {
            await disbandGroup(conversation._id);
            toast.success("Đã giải tán nhóm chat");
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Không thể giải tán nhóm");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="top-4 bottom-4 left-1/2 grid h-auto w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 translate-y-0 overflow-hidden p-0 sm:max-w-[min(1040px,calc(100vw-2rem))] sm:w-[min(1040px,calc(100vw-2rem))]">
                <div className="flex min-h-0 h-full flex-col">
                    <DialogHeader className="border-b px-6 py-5">
                        <DialogTitle>{conversation.group?.name || "Quản lý nhóm chat"}</DialogTitle>
                        <DialogDescription>
                            Quản lý thành viên, phân quyền phó nhóm và quyền chủ nhóm theo vai trò hiện tại của bạn.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
                        <section className="min-h-0 lg:overflow-y-auto lg:pr-2">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">Thành viên nhóm</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {conversation.participants.length} người trong nhóm
                                        </p>
                                    </div>
                                    {me ? (
                                        <Badge variant={ROLE_BADGE_VARIANTS[me.role]}>{ROLE_LABELS[me.role]}</Badge>
                                    ) : null}
                                </div>

                                <div className="space-y-3 pb-1">
                                    {conversation.participants.map((participant) => (
                                        <div
                                            key={participant._id}
                                            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <UserAvatar
                                                        type="chat"
                                                        name={participant.displayName}
                                                        avatarUrl={participant.avatarUrl ?? undefined}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-foreground">
                                                            {participant.displayName}
                                                            {participant._id === user?._id ? " (Bạn)" : ""}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Tham gia {new Date(participant.joinedAt).toLocaleDateString("vi-VN")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant={ROLE_BADGE_VARIANTS[participant.role]}>
                                                    {ROLE_LABELS[participant.role]}
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {participant._id === user?._id ? (
                                                    <Badge variant="secondary">Bạn</Badge>
                                                ) : friendIds.has(participant._id) ? (
                                                    <Badge variant="secondary">Bạn bè</Badge>
                                                ) : pendingInviteIds.has(participant._id) ? (
                                                    <Badge variant="outline">Đã gửi lời mời</Badge>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={friendLoading}
                                                        onClick={() => void handleSendFriendRequest(participant)}
                                                    >
                                                        Gửi lời mời kết bạn
                                                    </Button>
                                                )}

                                                {isOwner && participant._id !== user?._id && participant.role !== "owner" ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={chatLoading}
                                                        onClick={() => void handleToggleDeputy(participant)}
                                                    >
                                                        {participant.role === "deputy" ? "Thu hồi phó nhóm" : "Bổ nhiệm phó nhóm"}
                                                    </Button>
                                                ) : null}

                                                {isOwner && participant._id !== user?._id ? (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        disabled={chatLoading}
                                                        onClick={() => void handleTransferOwnership(participant)}
                                                    >
                                                        Chuyển chủ nhóm
                                                    </Button>
                                                ) : null}

                                                {canRemoveParticipant(participant) ? (
                                                    <Button
                                                        type="button"
                                                        variant="destructiveOutline"
                                                        size="sm"
                                                        disabled={chatLoading}
                                                        onClick={() => void handleRemoveMember(participant)}
                                                    >
                                                        Xóa khỏi nhóm
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="min-h-0 lg:overflow-y-auto lg:pl-1 lg:pr-1">
                            <div className="space-y-5 pb-1">
                                <div className="rounded-2xl border border-border/70 p-4">
                                    <h3 className="text-sm font-semibold text-foreground">Thêm thành viên</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {canAddMembers
                                            ? "Mọi thành viên trong nhóm đều có thể thêm bạn bè vào nhóm."
                                            : "Bạn không còn là thành viên của nhóm này."}
                                    </p>

                                    <div className="mt-4 space-y-3">
                                        <Input
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Tìm bạn bè theo tên hoặc username"
                                            disabled={!canAddMembers || chatLoading}
                                        />

                                        <div className="max-h-64 space-y-2 overflow-y-auto">
                                            {availableFriends.length === 0 ? (
                                                <div className="rounded-xl border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
                                                    Không còn bạn bè phù hợp để thêm vào nhóm.
                                                </div>
                                            ) : (
                                                availableFriends.map((friend) => {
                                                    const selected = selectedFriendIds.includes(friend._id);

                                                    return (
                                                        <button
                                                            key={friend._id}
                                                            type="button"
                                                            disabled={!canAddMembers || chatLoading}
                                                            onClick={() => toggleSelection(friend._id)}
                                                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${selected
                                                                ? "border-primary bg-primary/10"
                                                                : "border-border/70 hover:bg-accent/50"
                                                                }`}
                                                        >
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <UserAvatar
                                                                    type="chat"
                                                                    name={friend.displayName}
                                                                    avatarUrl={friend.avatarUrl}
                                                                />
                                                                <div className="min-w-0">
                                                                    <p className="truncate font-medium text-foreground">{friend.displayName}</p>
                                                                    <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
                                                                </div>
                                                            </div>
                                                            {selected ? <Badge>Đã chọn</Badge> : null}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>

                                        <Button
                                            type="button"
                                            className="w-full"
                                            disabled={!canAddMembers || chatLoading || selectedFriendIds.length === 0}
                                            onClick={() => void handleAddMembers()}
                                        >
                                            Thêm vào nhóm
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-border/70 p-4">
                                    <h3 className="text-sm font-semibold text-foreground">Hành động nhóm</h3>
                                    <div className="mt-4 flex flex-col gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={chatLoading}
                                            onClick={() => void handleLeaveGroup()}
                                        >
                                            Rời nhóm
                                        </Button>

                                        {isOwner ? (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                disabled={chatLoading}
                                                onClick={() => void handleDisbandGroup()}
                                            >
                                                Giải tán nhóm
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GroupChatManagementDialog;
