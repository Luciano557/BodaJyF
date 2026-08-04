const { handleApiError, sendJson } = require("../lib/http");
const { SpotifyError, spotifyApi } = require("../lib/spotify");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Método no permitido." });
  }

  try {
    const query = String(req.query?.q || "").trim().replace(/\s+/g, " ");
    if (query.length < 2 || query.length > 80) {
      throw new SpotifyError(
        "Escribí al menos dos caracteres para buscar una canción.",
        400,
        "invalid_search"
      );
    }

    const params = new URLSearchParams({ q: query, type: "track", limit: "5", market: "AR" });
    const { payload } = await spotifyApi(`/search?${params}`);
    const tracks = (payload.tracks?.items || []).map((track) => ({
      id: track.id,
      uri: track.uri,
      name: track.name,
      artists: (track.artists || []).map((artist) => artist.name).join(", "),
      album: track.album?.name || "",
      image: track.album?.images?.find((image) => image.width <= 300)?.url || track.album?.images?.at(-1)?.url || "",
      url: track.external_urls?.spotify || "",
      durationMs: track.duration_ms
    }));

    return sendJson(res, 200, { tracks });
  } catch (error) {
    return handleApiError(res, error);
  }
};
