const { getCredentials, getRedirectUri, safeEqual } = require("../lib/spotify");

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const match = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderResult(res, title, copy, refreshToken = "") {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Set-Cookie", "spotify_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  );
  return res.status(refreshToken ? 200 : 400).send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#15233c;color:#fffdf8;font:15px/1.6 Arial,sans-serif}.card{width:min(620px,100%);padding:36px;border:1px solid #dfba7c;background:#203252;box-sizing:border-box}h1{margin:0 0 8px;font:38px Georgia,serif;color:#efd5a4}p{opacity:.82}.token{width:100%;min-height:110px;box-sizing:border-box;margin:16px 0;padding:12px;background:#101b30;color:#fff;border:1px solid rgba(239,213,164,.45);word-break:break-all}button{padding:13px 20px;border:0;background:#dfba7c;color:#15233c;font-weight:bold;cursor:pointer}.note{font-size:12px;opacity:.62}
</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p>${refreshToken ? `<textarea class="token" id="token" readonly aria-label="Refresh token">${escapeHtml(refreshToken)}</textarea><button id="copy" type="button">Copiar refresh token</button><p class="note">Guardalo como SPOTIFY_REFRESH_TOKEN en Vercel. No lo compartas ni lo incluyas en el HTML.</p><script>document.getElementById("copy").addEventListener("click",async()=>{const field=document.getElementById("token");await navigator.clipboard.writeText(field.value);document.getElementById("copy").textContent="Copiado"})</script>` : ""}</main></body></html>`);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Método no permitido");

  const expectedState = getCookie(req, "spotify_oauth_state");
  const receivedState = req.query?.state;
  if (!expectedState || !safeEqual(expectedState, receivedState)) {
    return renderResult(res, "No pudimos conectar Spotify", "La sesión de autorización no es válida o venció.");
  }
  if (req.query?.error) {
    return renderResult(res, "Autorización cancelada", "Spotify no otorgó los permisos necesarios.");
  }
  if (!req.query?.code) {
    return renderResult(res, "No pudimos conectar Spotify", "Spotify no devolvió un código de autorización.");
  }

  try {
    const { clientId, clientSecret } = getCredentials();
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: getRedirectUri()
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.refresh_token) {
      throw new Error(payload.error_description || "Spotify no devolvió un refresh token.");
    }

    return renderResult(
      res,
      "Spotify quedó autorizado",
      "Último paso: copiá este valor y cargalo como variable protegida en Vercel.",
      payload.refresh_token
    );
  } catch (error) {
    console.error(error);
    return renderResult(res, "No pudimos conectar Spotify", "Revisá las credenciales y la Redirect URI configuradas.");
  }
};
