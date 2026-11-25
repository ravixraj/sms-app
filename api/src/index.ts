import { Hono } from "hono";
import type { ApplyGlobalResponse } from "hono/client";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type {
  ClientErrorStatusCode,
  ServerErrorStatusCode,
} from "hono/utils/http-status";
import { secureHeaders } from "hono/secure-headers";

// routes
import authRouter from "#routes/auth";
import adminRouter from "#routes/admin";
import attendanceRouter from "#routes/attendance";
import leaveRouter from "#routes/leave";
import teamRouter from "#routes/team";
import { HTTPStatus } from "./const";

// mw
import type { AuthEnv } from "#middleware/auth";
import { dbMiddleware } from "#middleware/db";

const app = new Hono<AuthEnv>()
  .use(
    "*",
    cors({
      origin: (_, c) => c.env.CLIENT_URL,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 86400,
    }),
  )
  .use(
    secureHeaders({
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      strictTransportSecurity: "max-age=31536000; includeSubDomains",
    }),
  )
  .notFound((c) =>
    c.json(
      {
        success: false,
        message: "The requested route was not found",
        details: null,
      },
      HTTPStatus.NOT_FOUND,
    ),
  )
  .onError((c) => {
    const err = c.error;
    const isHttp = err instanceof HTTPException;
    const status = isHttp ? err.status : HTTPStatus.INTERNAL_SERVER_ERROR;
    const details: unknown[] | null =
      isHttp && Array.isArray(err.cause) ? err.cause : null;

    console.error(
      JSON.stringify({
        message: "request_failed",
        method: c.req.method,
        path: c.req.path,
        status,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    return c.json(
      {
        success: false,
        message: isHttp ? err.message : "Internal Server Error",
        details,
      },
      status,
    );
  })
  .basePath("/api")
  .use(dbMiddleware)
  .route("/auth", authRouter)
  .route("/admin", adminRouter)
  .route("/team", teamRouter)
  .route("/leave", leaveRouter)
  .route("/attendance", attendanceRouter);

export type AppType = ApplyGlobalResponse<
  typeof app,
  {
    [Status in ClientErrorStatusCode | ServerErrorStatusCode]: {
      json: {
        success: false;
        message: string;
        details?: unknown;
      };
    };
  }
>;

export default app;
