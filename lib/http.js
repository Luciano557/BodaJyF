function sendJson(res, status, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function handleApiError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message =
    status >= 500 && !error?.code
      ? "Ocurrió un error inesperado. Probá nuevamente más tarde."
      : error?.message || "No pudimos completar la solicitud.";

  if (status >= 500) console.error(error);
  return sendJson(res, status, { error: message, code: error?.code || "unexpected_error" });
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body !== "string") return {};

  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return Object.fromEntries(new URLSearchParams(req.body));
}

module.exports = { handleApiError, readBody, sendJson };
