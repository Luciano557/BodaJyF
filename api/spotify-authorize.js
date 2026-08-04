const crypto = require("node:crypto");
const { readBody } = require("../lib/http");
const { getCredentials, getRedirectUri, requireEnv, safeEqual } = require("../lib/spotify");

function renderSetupForm(res, message = "") {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  );
  return res.status(message ? 401 : 200).send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar Spotify</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#15233c;color:#fffdf8;font:15px/1.6 Arial,sans-serif}.card{width:min(440px,100%);padding:36px;border:1px solid #dfba7c;background:#203252;box-sizing:border-box}h1{margin:0 0 8px;font:38px Georgia,serif;color:#efd5a4}p{opacity:.78}label{display:block;margin:24px 0 7px;font-size:12px;letter-spacing:.12em;text-transform:uppercase}input{width:100%;box-sizing:border-box;padding:13px;border:1px solid rgba(239,213,164,.55);background:#15233c;color:white}button{width:100%;margin-top:14px;padding:14px;border:0;background:#dfba7c;color:#15233c;font-weight:bold;cursor:pointer}.error{color:#efd5a4}
</style></head><body><main class="card"><h1>Conectar Spotify</h1><p>Acceso exclusivo para los novios. Esto autoriza a la invitación a sumar canciones a la playlist.</p>${message ? `<p class="error">${message}</p>` : ""}<form method="post" action="/api/spotify-authorize"><label for="key">Clave de configuración</label><input id="key" name="key" type="password" required autocomplete="current-password"><button type="submit">Continuar con Spotify</button></form></main></body></html>`);
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") return renderSetupForm(res);
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  try {
    const submittedKey = readBody(req).key;
    if (!safeEqual(submittedKey, requireEnv("SPOTIFY_SETUP_KEY"))) {
      return renderSetupForm(res, "La clave ingresada no es correcta.");
    }

    const state = crypto.randomBytes(24).toString("base64url");
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "playlist-modify-private playlist-modify-public playlist-read-private",
      redirect_uri: getRedirectUri(),
      state,
      show_dialog: "true"
    });

    res.setHeader(
      "Set-Cookie",
      `spotify_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600`
    );
    return res.redirect(303, `https://accounts.spotify.com/authorize?${params}`);
  } catch (error) {
    console.error(error);
    return res.status(503).send("Falta completar la configuración de Spotify en Vercel.");
  }
};
