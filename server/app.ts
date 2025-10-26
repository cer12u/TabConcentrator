import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite";

declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

export async function buildApp(): Promise<Express> {
  const app = express();

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined;

    const originalResJson = res.json.bind(res);
    res.json = function json(body: any) {
      capturedJsonResponse = body;
      return originalResJson(body);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

        if (capturedJsonResponse && res.statusCode >= 400) {
          const errorInfo =
            (capturedJsonResponse as Record<string, unknown>).error ??
            (capturedJsonResponse as Record<string, unknown>).message;
          if (typeof errorInfo === "string" && errorInfo.length > 0) {
            logLine += ` :: error: ${errorInfo}`;
          }
        }

        if (logLine.length > 150) {
          logLine = `${logLine.slice(0, 149)}…`;
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Error handler caught:", err);

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  return app;
}
