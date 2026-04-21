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
            console.warn("Khong the parse WEBRTC_ICE_SERVERS:", error);
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
        warnings.push("PUBLIC_API_URL chua duoc cau hinh. Client dev o mang khac se de bi tro ve backend cuc bo.");
    }

    if (!socketUrl) {
        warnings.push("PUBLIC_SOCKET_URL chua duoc cau hinh. Socket client can mot dia chi cong khai chung de goi xuyen mang.");
    }

    if (apiBaseUrl && isPrivateHost(getHostname(apiBaseUrl))) {
        warnings.push("PUBLIC_API_URL dang tro toi dia chi private/local. Goi khac mang se khong hoat dong on dinh.");
    }

    if (socketUrl && isPrivateHost(getHostname(socketUrl))) {
        warnings.push("PUBLIC_SOCKET_URL dang tro toi dia chi private/local. Socket giua cac mang khac nhau se khong gap nhau.");
    }

    const iceServers = buildIceServers();

    if (!iceServers.some((server) => String(server.urls).includes("turn:"))) {
        warnings.push("Chua co TURN server rieng. WebRTC chi STUN thuong chi hoat dong tot khi cung mang hoac NAT de.");
    }

    return {
        apiBaseUrl,
        socketUrl,
        iceServers,
        warnings,
    };
};