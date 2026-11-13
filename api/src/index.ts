import { getPgErrorCode } from "#db/index";
import {
  HTTP,
  HttpStatus,
  type ApiError,
  type ApiErrorStatus,
} from "#lib/http";
import type { AuthEnv } from "#middleware/auth";
import { Hono } from "hono";
import type { ApplyGlobalResponse } from "hono/client";
import { bodyLimit } from "hono/body-limit";
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
  .use(
    bodyLimit({
      maxSize: 100 * 1024, // 100kb
      onError: (c) =>
        c.json(
          HTTP.failure("Request body exceeds the 100 KB limit"),
          HttpStatus.PAYLOAD_TOO_LARGE,
        ),
    }),
  )
  .route("/", userRouter)
  .route("/org", orgRouter)
  .route("/attendance", attendanceRouter)
  .notFound((c) =>
    c.json(
      HTTP.failure("The requested route was not found"),
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
        HTTP.failure(err.status >= 500 ? "Internal server error" : err.message),
        err.status,
      );
    }

    const databaseCode = getPgErrorCode(err);

    if (databaseCode === "23505") {
      return c.json(
        HTTP.failure("A record with the same value already exists"),
        HttpStatus.CONFLICT,
      );
    }

    if (databaseCode === "23503") {
      return c.json(
        HTTP.failure("A related record does not exist"),
        HttpStatus.BAD_REQUEST,
      );
    }

    if (databaseCode === "23514") {
      return c.json(
        HTTP.failure("The request violates a data constraint"),
        HttpStatus.BAD_REQUEST,
      );
    }

    console.error({
      requestId: c.get("requestId"),
      error: err?.name ?? "UnknownError",
    });

    return c.json(
      HTTP.failure("Internal server error"),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

export type AppType = ApplyGlobalResponse<
  typeof app,
  { [Status in ApiErrorStatus]: { json: ApiError } }
>;

export default app;
