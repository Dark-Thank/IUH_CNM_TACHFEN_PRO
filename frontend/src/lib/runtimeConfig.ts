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

let hasWarnedAboutLocalOnlyConfig = false;

const normalizeUrl = (value?: string) => value?.trim().replace(/\/$/, "") || "";

const normalizeUrlList = (value?: string) =>
    String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const getWindowOrigin = () => (typeof window !== "undefined" ? normalizeUrl(window.location.origin) : "");

const getHostname = (value: string) => {
    try {
        return new URL(value).hostname;
    } catch {
        return "";
    }
};

const isPrivateHost = (hostname: string) => {
    const normalized = hostname.trim().toLowerCase();

    if (!normalized) {
        return false;
    }

    return normalized === "localhost"
        || normalized === "127.0.0.1"
        || normalized === "::1"
        || /^10\./.test(normalized)
        || /^192\.168\./.test(normalized)
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
};

const stripApiSuffix = (value: string) => value.replace(/\/api\/?$/i, "");

export const getApiBaseUrl = () => {
    const configuredApiUrl = normalizeUrl(import.meta.env.VITE_API_URL);
    const configuredOrigin = normalizeUrl(import.meta.env.VITE_PUBLIC_ORIGIN);

    if (configuredApiUrl) {
        return configuredApiUrl;
    }

    if (configuredOrigin) {
        return `${configuredOrigin}/api`;
    }

    const browserOrigin = getWindowOrigin();
    return browserOrigin ? `${browserOrigin}/api` : "";
};

export const getSocketBaseUrl = () => {
    const configuredSocketUrl = normalizeUrl(import.meta.env.VITE_SOCKET_URL);

    if (configuredSocketUrl) {
        return configuredSocketUrl;
    }

    const configuredOrigin = normalizeUrl(import.meta.env.VITE_PUBLIC_ORIGIN);

    if (configuredOrigin) {
        return configuredOrigin;
    }

    const apiBaseUrl = getApiBaseUrl();
    return apiBaseUrl ? stripApiSuffix(apiBaseUrl) : getWindowOrigin();
};

export const warnIfLocalOnlyRealtimeConfig = () => {
    if (hasWarnedAboutLocalOnlyConfig) {
        return;
    }

    const apiBaseUrl = getApiBaseUrl();
    const socketBaseUrl = getSocketBaseUrl();
    const apiHost = getHostname(apiBaseUrl);
    const socketHost = getHostname(socketBaseUrl);

    if (isPrivateHost(apiHost) || isPrivateHost(socketHost)) {
        hasWarnedAboutLocalOnlyConfig = true;
        console.warn(
            "[Realtime] API/Socket dang tro toi host local/private. Goi giua cac mang khac nhau can VITE_API_URL, VITE_SOCKET_URL hoac VITE_PUBLIC_ORIGIN tro toi backend cong khai."
        );
    }
};

export const getRtcConfiguration = (): RTCConfiguration => {
    const rawJson = import.meta.env.VITE_WEBRTC_ICE_SERVERS?.trim();

    if (rawJson) {
        try {
            const parsed = JSON.parse(rawJson);

            if (Array.isArray(parsed) && parsed.length > 0) {
                return { iceServers: parsed };
            }
        } catch (error) {
            console.warn("[WebRTC] Khong the parse VITE_WEBRTC_ICE_SERVERS:", error);
        }
    }

    const stunUrls = normalizeUrlList(import.meta.env.VITE_WEBRTC_STUN_URLS);
    const turnUrls = normalizeUrlList(import.meta.env.VITE_WEBRTC_TURN_URLS);
    const turnUsername = import.meta.env.VITE_WEBRTC_TURN_USERNAME?.trim() || "";
    const turnCredential = import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL?.trim() || "";
    const iceServers: RTCIceServer[] = [
        {
            urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS,
        },
    ];

    if (turnUrls.length > 0 && turnUsername && turnCredential) {
        iceServers.push({
            urls: turnUrls,
            username: turnUsername,
            credential: turnCredential,
        });
    } else if (import.meta.env.VITE_WEBRTC_ENABLE_OPENRELAY_FALLBACK !== "false") {
        iceServers.push(OPENRELAY_FALLBACK);
    }

    return { iceServers };
};