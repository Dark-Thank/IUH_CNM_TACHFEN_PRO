const DEFAULT_STUN_URLS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:openrelay.metered.ca:80",
];

const OPENRELAY_FALLBACK = {
    urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
};

const normalizeUrl = (value) => value?.trim().replace(/\/$/, "") || "";

const normalizeUrlList = (rawValue) =>
    String(rawValue || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const isPrivateHost = (hostname = "") => {
    const normalizedHost = hostname.trim().toLowerCase();

    if (!normalizedHost) {
        return false;
    }

    return normalizedHost === "localhost"
        || normalizedHost === "127.0.0.1"
        || normalizedHost === "::1"
        || /^10\./.test(normalizedHost)
        || /^192\.168\./.test(normalizedHost)
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHost);
};

const getHostname = (origin) => {
    try {
        return new URL(origin).hostname;
    } catch {
        return "";
    }
};

const buildIceServers = () => {
    const rawJson = process.env.WEBRTC_ICE_SERVERS?.trim();

    if (rawJson) {
        try {
            const parsed = JSON.parse(rawJson);

            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (error) {
            console.warn("Không thể parse WEBRTC_ICE_SERVERS:", error);
        }
    }

    const stunUrls = normalizeUrlList(process.env.WEBRTC_STUN_URLS);
    const turnUrls = normalizeUrlList(process.env.WEBRTC_TURN_URLS);
    const turnUsername = process.env.WEBRTC_TURN_USERNAME?.trim() || "";
    const turnCredential = process.env.WEBRTC_TURN_CREDENTIAL?.trim() || "";
    const iceServers = [];

    iceServers.push({
        urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS,
    });

    if (turnUrls.length > 0 && turnUsername && turnCredential) {
        iceServers.push({
            urls: turnUrls,
            username: turnUsername,
            credential: turnCredential,
        });
        return iceServers;
    }

    if (process.env.WEBRTC_ENABLE_OPENRELAY_FALLBACK !== "false") {
        iceServers.push(OPENRELAY_FALLBACK);
    }

    return iceServers;
};

export const getRealtimeConfig = () => {
    const apiBaseUrl = normalizeUrl(process.env.PUBLIC_API_URL);
    const socketUrl = normalizeUrl(process.env.PUBLIC_SOCKET_URL || process.env.PUBLIC_ORIGIN);
    const warnings = [];

    if (!apiBaseUrl) {
        warnings.push("PUBLIC_API_URL chưa được cấu hình. Client dev ở mạng khác sẽ dễ bị trỏ về backend cục bộ.");
    }

    if (!socketUrl) {
        warnings.push("PUBLIC_SOCKET_URL chưa được cấu hình. Socket client cần một địa chỉ công khai chung để gọi xuyên mạng.");
    }

    if (apiBaseUrl && isPrivateHost(getHostname(apiBaseUrl))) {
        warnings.push("PUBLIC_API_URL đang trỏ tới địa chỉ private/local. Gọi khác mạng sẽ không hoạt động ổn định.");
    }

    if (socketUrl && isPrivateHost(getHostname(socketUrl))) {
        warnings.push("PUBLIC_SOCKET_URL đang trỏ tới địa chỉ private/local. Socket giữa các mạng khác nhau sẽ không gặp nhau.");
    }

    const iceServers = buildIceServers();

    if (!iceServers.some((server) => String(server.urls).includes("turn:"))) {
        warnings.push("Chưa có TURN server riêng. WebRTC chỉ dùng STUN thường chỉ hoạt động tốt khi cùng mạng hoặc NAT dễ.");
    }

    return {
        apiBaseUrl,
        socketUrl,
        iceServers,
        warnings,
    };
};
