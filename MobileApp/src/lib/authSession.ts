type AccessTokenChangeHandler = (accessToken: string | null) => void;
type UnauthorizedHandler = () => void;

let accessToken: string | null = null;
let currentUserId: string | null = null;
let onAccessTokenChange: AccessTokenChangeHandler | null = null;
let onUnauthorized: UnauthorizedHandler | null = null;

export const authSession = {
  getAccessToken: () => accessToken,

  setAccessToken: (nextAccessToken: string | null) => {
    accessToken = nextAccessToken;
    onAccessTokenChange?.(nextAccessToken);
  },

  getCurrentUserId: () => currentUserId,

  setCurrentUserId: (nextUserId: string | null) => {
    currentUserId = nextUserId;
  },

  clear: () => {
    accessToken = null;
    currentUserId = null;
    onAccessTokenChange?.(null);
  },

  setAccessTokenChangeHandler: (handler: AccessTokenChangeHandler) => {
    onAccessTokenChange = handler;
  },

  setUnauthorizedHandler: (handler: UnauthorizedHandler) => {
    onUnauthorized = handler;
  },

  handleUnauthorized: () => {
    onUnauthorized?.();
  },
};
