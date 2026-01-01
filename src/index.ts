import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./lib/env";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`);
});
