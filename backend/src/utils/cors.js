const normalizeOrigin = (origin) => origin?.trim().replace(/\/$/, "") || "";

export const getAllowedOrigins = () => {
    const rawOrigins = process.env.CLIENT_URL || "";

    return rawOrigins
        .split(",")
        .map(normalizeOrigin)
        .filter(Boolean);
};

export const isAllowedOrigin = (origin) => {
    if (!origin) {
        return true;
    }

    const allowedOrigins = getAllowedOrigins();

    if (allowedOrigins.length === 0) {
        return true;
    }

    return allowedOrigins.includes(normalizeOrigin(origin));
};

export const buildCorsOptions = () => ({
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
});