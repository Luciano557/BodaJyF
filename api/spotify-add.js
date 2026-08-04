const { handleApiError, readBody, sendJson } = require("../lib/http");
const {
  SpotifyError,
  assertSameOrigin,
  checkAddRateLimit,
  getPlaylistId,
  spotifyApi
} = require("../lib/spotify");

async function playlistContains(playlistId, uri) {
  let path = `/playlists/${encodeURIComponent(playlistId)}/items?limit=50`;
  let pagesChecked = 0;

  while (path && pagesChecked < 10) {
    const { payload } = await spotifyApi(path, { user: true });
    const found = (payload.items || []).some((entry) => {
      const item = entry.item || entry.track;
      return item?.uri === uri;
    });
    if (found) return true;

    path = payload.next ? payload.next.replace("https://api.spotify.com/v1", "") : null;
    pagesChecked += 1;
  }

  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método no permitido." });
  }

  try {
    assertSameOrigin(req);
    checkAddRateLimit(req);

    const { uri } = readBody(req);
    if (!/^spotify:track:[A-Za-z0-9]{22}$/.test(String(uri || ""))) {
      throw new SpotifyError("La canción seleccionada no es válida.", 400, "invalid_track");
    }

    const playlistId = getPlaylistId();
    if (await playlistContains(playlistId, uri)) {
      return sendJson(res, 200, { status: "duplicate" });
    }

    await spotifyApi(`/playlists/${encodeURIComponent(playlistId)}/items`, {
      user: true,
      method: "POST",
      body: { uris: [uri] }
    });
    return sendJson(res, 201, { status: "added" });
  } catch (error) {
    return handleApiError(res, error);
  }
};
