
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      try {
        await env.DB.prepare("SELECT 1").first();

        return Response.json({
          success: true,
          database: "connected"
        });
      } catch {
        return Response.json(
          {
            success: false,
            error: "Database is not configured yet"
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { success: false, error: "API route not found" },
        { status: 404 }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
