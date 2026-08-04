const crypto = require("node:crypto");

const ACCOUNTS_BASE_URL = "https://accounts.spotify.com";
const API_BASE_URL = "https://api.spotify.com/v1";
const DEFAULT_PLAYLIST_ID = "4RN43fmkIW50QtNEKMRZOY";
const DEFAULT_REDIRECT_URI = "https://julianyfiorella.vercel.app/api/spotify-callback";

let appTokenCache = null;
let userTokenCache = null;
const addAttempts = new Map();

class SpotifyError extends Error {
  constructor(message, status = 500, code = "spotify_error") {
    super(message);
    this.name = "SpotifyError";
    this.status = status;
    this.code = code;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SpotifyError(
      "La integración con Spotify todavía no está configurada.",
      503,
      "spotify_not_configured"
    );
  }
  return value;
}

function getCredentials() {
  return {
    clientId: requireEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET")
  };
}

function getPlaylistId() {
  return process.env.SPOTIFY_PLAYLIST_ID?.trim() || DEFAULT_PLAYLIST_ID;
}

function getRedirectUri() {
  return process.env.SPOTIFY_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
}

function basicAuthorization() {
  const { clientId, clientSecret } = getCredentials();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function readSpotifyResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  return text ? { error: text } : {};
}

async function requestToken(parameters) {
  const response = await fetch(`${ACCOUNTS_BASE_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(parameters)
  });
  const payload = await readSpotifyResponse(response);

  if (!response.ok) {
    const authorizationExpired = payload.error === "invalid_grant";
    throw new SpotifyError(
      authorizationExpired
        ? "La autorización de Spotify venció. Los novios deben volver a conectarla."
        : "Spotify no pudo autorizar esta solicitud.",
      authorizationExpired ? 503 : 502,
      authorizationExpired ? "spotify_authorization_required" : "spotify_token_error"
    );
  }

  return payload;
}

async function getAppAccessToken() {
  if (appTokenCache && Date.now() < appTokenCache.expiresAt) {
    return appTokenCache.accessToken;
  }

  const payload = await requestToken({ grant_type: "client_credentials" });
  appTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in - 90) * 1000
  };
  return appTokenCache.accessToken;
}

async function getUserAccessToken() {
  if (userTokenCache && Date.now() < userTokenCache.expiresAt) {
    return userTokenCache.accessToken;
  }

  const payload = await requestToken({
    grant_type: "refresh_token",
    refresh_token: requireEnv("SPOTIFY_REFRESH_TOKEN")
  });
  userTokenCache = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || process.env.SPOTIFY_REFRESH_TOKEN,
    expiresAt: Date.now() + Math.max(60, payload.expires_in - 90) * 1000
  };
  return userTokenCache.accessToken;
}

async function spotifyApi(path, options = {}) {
  const token = options.user ? await getUserAccessToken() : await getAppAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await readSpotifyResponse(response);

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    if (response.status === 429) {
      throw new SpotifyError(
        "Spotify recibió muchas solicitudes. Probá nuevamente en unos segundos.",
        429,
        "spotify_rate_limited"
      );
    }

    const spotifyMessage = payload?.error?.message;
    throw new SpotifyError(
      spotifyMessage || "Spotify no pudo completar la solicitud.",
      response.status >= 500 ? 502 : response.status,
      "spotify_api_error"
    );
  }

  return { payload };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function checkAddRateLimit(req) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const key = getClientIp(req);
  const current = addAttempts.get(key);

  if (!current || now - current.startedAt > windowMs) {
    addAttempts.set(key, { count: 1, startedAt: now });
  } else if (current.count >= 8) {
    throw new SpotifyError(
      "Ya recomendaste varias canciones. Esperá unos minutos antes de agregar otra.",
      429,
      "guest_rate_limited"
    );
  } else {
    current.count += 1;
  }

  if (addAttempts.size > 500) {
    for (const [ip, attempt] of addAttempts) {
      if (now - attempt.startedAt > windowMs) addAttempts.delete(ip);
    }
  }
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const expectedOrigin = host
    ? `${req.headers["x-forwarded-proto"] || "https"}://${host}`
    : null;
  const configuredOrigin = process.env.SITE_ORIGIN?.replace(/\/$/, "");

  if (origin !== expectedOrigin && origin !== configuredOrigin) {
    throw new SpotifyError("Solicitud no permitida.", 403, "invalid_origin");
  }
}

module.exports = {
  SpotifyError,
  assertSameOrigin,
  checkAddRateLimit,
  getCredentials,
  getPlaylistId,
  getRedirectUri,
  requireEnv,
  safeEqual,
  spotifyApi
};
