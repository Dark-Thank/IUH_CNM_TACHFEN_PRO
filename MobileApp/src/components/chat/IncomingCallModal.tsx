import { useCallStore } from "@/stores/useCallStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { Phone, PhoneOff, Video } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

export default function IncomingCallModal() {
	const { isDark } = useThemeStore();
	const currentCall = useCallStore((state) => state.currentCall);
	const acceptIncomingCall = useCallStore((state) => state.acceptIncomingCall);
	const declineIncomingCall = useCallStore((state) => state.declineIncomingCall);

	if (!currentCall || currentCall.status !== "incoming") {
		return null;
	}

	return (
		<Modal visible transparent animationType="fade" onRequestClose={() => declineIncomingCall("declined")}>
			<View style={styles.root}>
				<View style={styles.backdrop} />
				<View
					style={[
						styles.card,
						{
							backgroundColor: isDark ? "#111827" : "#ffffff",
							borderColor: isDark ? "#1f2937" : "#e2e8f0",
						},
					]}
				>
					<Text style={[styles.eyebrow, { color: isDark ? "#c4b5fd" : "#6d28d9" }]}>Cuộc gọi đến</Text>

					<UserAvatar
						name={currentCall.peer.displayName}
						avatarUrl={currentCall.peer.avatarUrl}
						size={88}
					/>

					<Text style={[styles.name, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
						{currentCall.peer.displayName}
					</Text>

					<View style={styles.typeRow}>
						{currentCall.callType === "video" ? (
							<Video size={16} color={isDark ? "#cbd5e1" : "#475569"} />
						) : (
							<Phone size={16} color={isDark ? "#cbd5e1" : "#475569"} />
						)}
						<Text style={[styles.typeText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
							{currentCall.callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại"}
						</Text>
					</View>

					<View style={styles.actions}>
						<Pressable
							onPress={() => declineIncomingCall("declined")}
							style={[styles.actionButton, styles.declineButton]}
						>
							<PhoneOff size={22} color="#ffffff" />
							<Text style={styles.actionLabel}>Từ chối</Text>
						</Pressable>

						<Pressable
							onPress={() => void acceptIncomingCall()}
							style={[styles.actionButton, styles.acceptButton]}
						>
							<Phone size={22} color="#ffffff" />
							<Text style={styles.actionLabel}>Nhận</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(2, 6, 23, 0.72)",
	},
	card: {
		width: "100%",
		maxWidth: 360,
		alignItems: "center",
		borderRadius: 28,
		borderWidth: 1,
		paddingHorizontal: 24,
		paddingVertical: 28,
	},
	eyebrow: {
		fontSize: 13,
		fontWeight: "700",
		marginBottom: 14,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	name: {
		fontSize: 24,
		fontWeight: "800",
		marginTop: 16,
		textAlign: "center",
	},
	typeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 10,
	},
	typeText: {
		fontSize: 14,
		fontWeight: "600",
	},
	actions: {
		flexDirection: "row",
		gap: 18,
		marginTop: 28,
	},
	actionButton: {
		alignItems: "center",
		justifyContent: "center",
		minWidth: 112,
		borderRadius: 22,
		paddingHorizontal: 20,
		paddingVertical: 16,
		gap: 8,
	},
	acceptButton: {
		backgroundColor: "#16a34a",
	},
	declineButton: {
		backgroundColor: "#ef4444",
	},
	actionLabel: {
		color: "#ffffff",
		fontSize: 14,
		fontWeight: "700",
	},
});
