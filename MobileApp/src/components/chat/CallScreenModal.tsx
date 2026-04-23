import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { CallSession } from "@/types/call";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";
import UserAvatar from "./UserAvatar";

const statusLabelMap = {
	incoming: "Cuoc goi den",
	"acquiring-media": "Dang mo thiet bi...",
	"outgoing-ringing": "Dang do chuong...",
	negotiating: "Dang ket noi...",
	connected: "Da ket noi",
	reconnecting: "Dang khoi phuc ket noi...",
	idle: "San sang",
} as const;

const hasActiveVideoTrack = (stream: MediaStream | null) =>
	Boolean(stream?.getVideoTracks().some((track) => track.enabled));

const getHangupReason = (call: CallSession) => {
	if (call.status === "incoming") {
		return "declined";
	}

	if (
		call.direction === "outgoing" &&
		(call.status === "acquiring-media" || call.status === "outgoing-ringing")
	) {
		return "cancelled";
	}

	return "ended";
};

const getStreamURL = (stream: MediaStream | null) => {
	const rtcStream = stream as MediaStream & { toURL?: () => string };
	return rtcStream?.toURL?.() ?? null;
};

function ControlButton({
	label,
	icon,
	onPress,
	backgroundColor,
}: {
	label: string;
	icon: React.ReactNode;
	onPress: () => void;
	backgroundColor: string;
}) {
	return (
		<Pressable onPress={onPress} style={[styles.controlButton, { backgroundColor }]}> 
			{icon}
			<Text style={styles.controlLabel}>{label}</Text>
		</Pressable>
	);
}

function RemoteParticipantTile({
	displayName,
	avatarUrl,
	stream,
	isDark,
}: {
	displayName: string;
	avatarUrl?: string | null;
	stream: MediaStream | null;
	isDark: boolean;
}) {
	const streamURL = getStreamURL(stream);
	const hasVideo = Boolean(streamURL && hasActiveVideoTrack(stream));

	return (
		<View style={styles.groupTile}>
			{hasVideo ? (
				<RTCView streamURL={streamURL} style={styles.groupTileVideo} objectFit="cover" zOrder={0} />
			) : (
				<View
					style={[
						styles.groupTilePlaceholder,
						{ backgroundColor: isDark ? "#111827" : "#ffffff" },
					]}
				>
					<UserAvatar name={displayName} avatarUrl={avatarUrl} size={68} />
					<Text style={styles.groupTileName}>{displayName}</Text>
					<Text style={styles.groupTileStatus}>Dang cho video...</Text>
				</View>
			)}

			<View style={styles.groupTileOverlay}>
				<Text style={styles.groupTileOverlayText}>{displayName}</Text>
			</View>
		</View>
	);
}

export default function CallScreenModal() {
	const { isDark } = useThemeStore();
	const currentUserId = useAuthStore((state) => state.user?._id);
	const conversations = useChatStore((state) => state.conversations);
	const currentCall = useCallStore((state) => state.currentCall);
	const localStream = useCallStore((state) => state.localStream);
	const remoteStream = useCallStore((state) => state.remoteStream);
	const remoteStreams = useCallStore((state) => state.remoteStreams);
	const isMicrophoneEnabled = useCallStore((state) => state.isMicrophoneEnabled);
	const isCameraEnabled = useCallStore((state) => state.isCameraEnabled);
	const toggleMicrophone = useCallStore((state) => state.toggleMicrophone);
	const toggleCamera = useCallStore((state) => state.toggleCamera);
	const endCall = useCallStore((state) => state.endCall);

	if (!currentCall || currentCall.status === "incoming") {
		return null;
	}

	const conversation = conversations.find((item) => item._id === currentCall.conversationId);
	const remoteStreamURL = getStreamURL(remoteStream);
	const localStreamURL = getStreamURL(localStream);
	const showRemoteVideo = currentCall.callType === "video" && remoteStreamURL && hasActiveVideoTrack(remoteStream);
	const showLocalVideo = currentCall.callType === "video" && localStreamURL && hasActiveVideoTrack(localStream);
	const localPreviewKey = `${currentCall.callId}:${localStreamURL ?? "no-stream"}:${currentCall.status}:${isCameraEnabled ? "camera-on" : "camera-off"}`;
	const remoteVideoEntries = currentCall.isGroup
		? currentCall.participantIds
				.filter((participantId) => participantId !== currentUserId)
				.map((participantId) => {
					const participant = conversation?.participants.find((item) => item._id === participantId);

					return {
						participantId,
						displayName: participant?.displayName || `User ${participantId.slice(Math.max(0, participantId.length - 4))}`,
						avatarUrl: participant?.avatarUrl,
						stream: remoteStreams[participantId] ?? null,
					};
				})
		: [
				{
					participantId: currentCall.peer._id,
					displayName: currentCall.peer.displayName,
					avatarUrl: currentCall.peer.avatarUrl,
					stream: remoteStream,
				},
			];

	return (
		<Modal
			visible
			animationType="slide"
			presentationStyle="fullScreen"
			onRequestClose={() => endCall(getHangupReason(currentCall))}
		>
			<View style={[styles.root, { backgroundColor: isDark ? "#020617" : "#e2e8f0" }]}>
				{currentCall.isGroup ? (
					<View style={styles.groupGrid}>
						{remoteVideoEntries.map((entry) => (
							<RemoteParticipantTile
								key={entry.participantId}
								displayName={entry.displayName}
								avatarUrl={entry.avatarUrl}
								stream={entry.stream}
								isDark={isDark}
							/>
						))}
					</View>
				) : showRemoteVideo ? (
					<RTCView streamURL={remoteStreamURL} style={styles.remoteVideo} objectFit="cover" zOrder={0} />
				) : (
					<View
						style={[
							styles.remotePlaceholder,
							{ backgroundColor: isDark ? "#111827" : "#ffffff" },
						]}
					>
						<UserAvatar
							name={currentCall.peer.displayName}
							avatarUrl={currentCall.peer.avatarUrl}
							size={108}
						/>
						<Text style={[styles.peerName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
							{currentCall.peer.displayName}
						</Text>
						<Text style={[styles.statusText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
							{statusLabelMap[currentCall.status]}
						</Text>
					</View>
				)}

				<View style={styles.topOverlay}>
					<Text style={styles.callTypeLabel}>
						{currentCall.callType === "video" ? "Cuoc goi video" : "Cuoc goi thoai"}
					</Text>
					<Text style={styles.statusBadge}>{statusLabelMap[currentCall.status]}</Text>
					{currentCall.isGroup ? (
						<Text style={styles.participantCountLabel}>
							{Object.keys(remoteStreams).length} participant dang ket noi
						</Text>
					) : null}
				</View>

				{currentCall.callType === "video" ? (
					<View style={styles.localPreviewShell}>
						{showLocalVideo ? (
							<RTCView
								key={localPreviewKey}
								streamURL={localStreamURL}
								style={styles.localPreview}
								objectFit="cover"
								mirror
								zOrder={2}
							/>
						) : (
							<View style={styles.localPreviewPlaceholder}>
								<UserAvatar name="Ban" size={42} />
								<Text style={styles.localPreviewLabel}>
									{isCameraEnabled ? "Dang khoi dong camera..." : "Camera dang tat"}
								</Text>
							</View>
						)}

						<View style={styles.localPreviewFooter}>
							<Text style={styles.localPreviewFooterText}>Ban</Text>
						</View>
					</View>
				) : null}

				<View style={styles.controlsBar}>
					<ControlButton
						label={isMicrophoneEnabled ? "Tat mic" : "Mo mic"}
						icon={isMicrophoneEnabled ? <Mic size={20} color="#ffffff" /> : <MicOff size={20} color="#ffffff" />}
						onPress={toggleMicrophone}
						backgroundColor={isMicrophoneEnabled ? "#334155" : "#b91c1c"}
					/>

					{currentCall.callType === "video" ? (
						<ControlButton
							label={isCameraEnabled ? "Tat video" : "Mo video"}
							icon={isCameraEnabled ? <Video size={20} color="#ffffff" /> : <VideoOff size={20} color="#ffffff" />}
							onPress={toggleCamera}
							backgroundColor={isCameraEnabled ? "#334155" : "#b91c1c"}
						/>
					) : null}

					<ControlButton
						label="Ket thuc"
						icon={<PhoneOff size={20} color="#ffffff" />}
						onPress={() => endCall(getHangupReason(currentCall))}
						backgroundColor="#ef4444"
					/>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	remoteVideo: {
		...StyleSheet.absoluteFillObject,
	},
	remotePlaceholder: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 24,
	},
	peerName: {
		fontSize: 28,
		fontWeight: "800",
		marginTop: 20,
		textAlign: "center",
	},
	statusText: {
		fontSize: 15,
		fontWeight: "600",
		marginTop: 8,
		textAlign: "center",
	},
	topOverlay: {
		position: "absolute",
		top: 64,
		left: 20,
		right: 20,
		alignItems: "center",
		gap: 8,
	},
	callTypeLabel: {
		color: "#e2e8f0",
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0.4,
	},
	statusBadge: {
		color: "#ffffff",
		fontSize: 13,
		fontWeight: "700",
		backgroundColor: "rgba(15, 23, 42, 0.48)",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		overflow: "hidden",
	},
	participantCountLabel: {
		color: "#cbd5e1",
		fontSize: 12,
		fontWeight: "600",
	},
	localPreviewShell: {
		position: "absolute",
		top: 110,
		right: 20,
		width: 118,
		height: 168,
		borderRadius: 20,
		overflow: "hidden",
		backgroundColor: "#0f172a",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.15)",
	},
	localPreview: {
		width: "100%",
		height: "100%",
	},
	localPreviewPlaceholder: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		paddingHorizontal: 10,
		backgroundColor: "#0f172a",
	},
	localPreviewLabel: {
		color: "#e2e8f0",
		fontSize: 11,
		fontWeight: "700",
		textAlign: "center",
	},
	localPreviewFooter: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: 10,
		paddingVertical: 8,
		backgroundColor: "rgba(2, 6, 23, 0.55)",
	},
	localPreviewFooterText: {
		color: "#ffffff",
		fontSize: 12,
		fontWeight: "700",
	},
	groupGrid: {
		...StyleSheet.absoluteFillObject,
		flexDirection: "row",
		flexWrap: "wrap",
		padding: 12,
		gap: 12,
	},
	groupTile: {
		width: "47%",
		height: "31%",
		minHeight: 180,
		borderRadius: 20,
		overflow: "hidden",
		backgroundColor: "#0f172a",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.12)",
	},
	groupTileVideo: {
		width: "100%",
		height: "100%",
	},
	groupTilePlaceholder: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		paddingHorizontal: 16,
	},
	groupTileName: {
		color: "#f8fafc",
		fontSize: 18,
		fontWeight: "800",
		textAlign: "center",
	},
	groupTileStatus: {
		color: "#cbd5e1",
		fontSize: 12,
		fontWeight: "600",
		textAlign: "center",
	},
	groupTileOverlay: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: 12,
		paddingVertical: 10,
		backgroundColor: "rgba(2, 6, 23, 0.45)",
	},
	groupTileOverlayText: {
		color: "#ffffff",
		fontSize: 13,
		fontWeight: "700",
	},
	controlsBar: {
		position: "absolute",
		left: 16,
		right: 16,
		bottom: 34,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
	},
	controlButton: {
		minWidth: 90,
		borderRadius: 22,
		paddingHorizontal: 16,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	controlLabel: {
		color: "#ffffff",
		fontSize: 12,
		fontWeight: "700",
	},
});
