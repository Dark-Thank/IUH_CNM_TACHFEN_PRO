import type { CallType } from "@/types/call";
import { PermissionsAndroid, Platform } from "react-native";
import {
	mediaDevices,
	registerGlobals,
	RTCPeerConnection,
	type MediaStream,
	type RTCIceCandidate,
} from "react-native-webrtc";

registerGlobals();

const rtcConfig: RTCConfiguration = {
	iceServers: [
		{
			urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
		},
	],
};

const requestAndroidPermissions = async (callType: CallType) => {
	if (Platform.OS !== "android") {
		return;
	}

	const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];

	if (callType === "video") {
		permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
	}

	const results = await PermissionsAndroid.requestMultiple(permissions);
	const deniedPermission = permissions.find(
		(permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED
	);

	if (deniedPermission) {
		throw new Error(
			callType === "video"
				? "Can cap quyen camera va microphone de bat dau cuoc goi video."
				: "Can cap quyen microphone de bat dau cuoc goi thoai."
		);
	}
};

export const createCallId = () =>
	globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getMobileUserMedia = async (callType: CallType) => {
	await requestAndroidPermissions(callType);

	return mediaDevices.getUserMedia({
		audio: true,
		video:
			callType === "video"
				? {
						facingMode: "user",
					}
				: false,
	});
};

export const serializeIceCandidate = (candidate: RTCIceCandidate) => {
	if (typeof candidate.toJSON === "function") {
		return candidate.toJSON();
	}

	return {
		candidate: candidate.candidate,
		sdpMid: candidate.sdpMid,
		sdpMLineIndex: candidate.sdpMLineIndex,
	};
};

export const createMobilePeerConnection = ({
	onIceCandidate,
	onRemoteStream,
	onConnectionStateChange,
}: {
	onIceCandidate: (candidate: RTCIceCandidate) => void;
	onRemoteStream: (stream: MediaStream) => void;
	onConnectionStateChange?: (connectionState: RTCPeerConnectionState) => void;
}) => {
	const peerConnection = new RTCPeerConnection(rtcConfig);
	const rtcPeerConnection = peerConnection as any;

	rtcPeerConnection.onicecandidate = (event: any) => {
		if (event.candidate) {
			onIceCandidate(event.candidate as RTCIceCandidate);
		}
	};

	rtcPeerConnection.ontrack = (event: any) => {
		const [stream] = event.streams ?? [];

		if (stream) {
			onRemoteStream(stream as MediaStream);
		}
	};

	rtcPeerConnection.onconnectionstatechange = () => {
		onConnectionStateChange?.(peerConnection.connectionState);
	};

	return peerConnection;
};
