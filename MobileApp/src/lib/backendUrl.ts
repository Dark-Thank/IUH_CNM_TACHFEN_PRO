import { NativeModules, Platform } from "react-native";

const DEFAULT_BACKEND_PORT = "5001";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const getWindowHostname = () => {
    if (typeof window === "undefined") {
        return null;
    }

    return window.location.hostname || null;
};

const getBundleUrl = () => {
    const sourceCode = NativeModules.SourceCode as
        | { scriptURL?: string; bundleURL?: string }
        | undefined;

    return sourceCode?.scriptURL || sourceCode?.bundleURL || null;
};

const getExpoConstants = () => {
    try {
        const constantsModule = require("expo-constants");
        return (constantsModule?.default ?? constantsModule) as {
            expoConfig?: { hostUri?: string } | null;
            linkingUri?: string | null;
            manifest?: { debuggerHost?: string } | null;
            manifest2?: {
                extra?: {
                    expoClient?: { hostUri?: string };
                };
            } | null;
        };
    } catch {
        return null;
    }
};

const getExpoHostCandidates = () => {
    const constants = getExpoConstants();

    return [
        constants?.expoConfig?.hostUri,
        constants?.linkingUri,
        constants?.manifest?.debuggerHost,
        constants?.manifest2?.extra?.expoClient?.hostUri,
    ];
};

const extractHostname = (value?: string | null) => {
    if (!value) {
        return null;
    }

    try {
        return new URL(value).hostname || null;
    } catch {
        const normalized = value.includes("://") ? value : `http://${value}`;

        try {
            return new URL(normalized).hostname || null;
        } catch {
            const match = normalized.match(/^[a-z]+:\/\/([^/:?#]+)/i);
            return match?.[1] ?? null;
        }
    }
};

const resolveRuntimeHost = () => {
    const candidates = [
        process.env.EXPO_PUBLIC_BACKEND_HOST,
        Platform.OS === "web" ? getWindowHostname() : null,
        ...getExpoHostCandidates().map((candidate) => extractHostname(candidate)),
        extractHostname(getBundleUrl()),
    ];

    const host = candidates.find(
        (candidate): candidate is string =>
            Boolean(candidate) && !LOCAL_HOSTS.has(candidate)
    );

    return host ?? "localhost";
};

export const getBackendOrigin = () => {
    const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

    if (configuredUrl) {
        return configuredUrl.replace(/\/api\/?$/, "");
    }

    const host = resolveRuntimeHost();
    const port = process.env.EXPO_PUBLIC_BACKEND_PORT?.trim() || DEFAULT_BACKEND_PORT;
    const origin = `http://${host}:${port}`;

    try {
        console.log("[MobileApp] BACKEND_ORIGIN=", origin);
    } catch {
        // Ignore logging failures on non-standard runtimes.
    }

    return origin;
};

export const getApiBaseUrl = () => `${getBackendOrigin()}/api`;