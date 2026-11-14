import { getPgErrorCode } from "#db/index";
import { HttpStatus, type ApiError, type ApiErrorStatus } from "#lib/http";
import type { AuthEnv } from "#middleware/auth";
import { Hono } from "hono";
import type { ApplyGlobalResponse } from "hono/client";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

// routes
import attendanceRouter from "#routes/attendance";
import orgRouter from "#routes/org";
import userRouter from "#routes/user";

const app = new Hono<AuthEnv>({
  strict: false,
})
  .basePath("/api/v1")
  .use(requestId())
  .use(
    "*",
    cors({
      origin: (_, c) => c.env.CLIENT_URL,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length", "X-Request-Id"],
      credentials: true,
      maxAge: 86400,
    }),
  )
  .use(logger())
  .use(
    secureHeaders({
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      strictTransportSecurity: "max-age=31536000; includeSubDomains",
    }),
  )
  .route("/", userRouter)
  .route("/org", orgRouter)
  .route("/attendance", attendanceRouter)
  .notFound((c) =>
    c.json(
      {
        success: false,
        message: "The requested route was not found",
      } satisfies ApiError,
      HttpStatus.NOT_FOUND,
    ),
  )
  .onError((c) => {
    const err = c.error;

    if (err instanceof HTTPException) {
      if (err.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        console.error({ requestId: c.get("requestId"), status: err.status });
      }

      return c.json(
        {
          success: false,
          message: err.status >= 500 ? "Internal server error" : err.message,
        } satisfies ApiError,
        err.status,
      );
    }

    const databaseCode = getPgErrorCode(err);

    if (databaseCode === "23505") {
      return c.json(
        {
          success: false,
          message: "A record with the same value already exists",
        } satisfies ApiError,
        HttpStatus.CONFLICT,
      );
    }

    if (databaseCode === "23503") {
      return c.json(
        {
          success: false,
          message: "A related record does not exist",
        } satisfies ApiError,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (databaseCode === "23514") {
      return c.json(
        {
          success: false,
          message: "The request violates a data constraint",
        } satisfies ApiError,
        HttpStatus.BAD_REQUEST,
      );
    }

    console.error({
      requestId: c.get("requestId"),
      error: err?.name ?? "UnknownError",
    });

    return c.json(
      {
        success: false,
        message: "Internal server error",
      } satisfies ApiError,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

export type AppType = ApplyGlobalResponse<
  typeof app,
  { [Status in ApiErrorStatus]: { json: ApiError } }
>;

export default app;
