import { getPgErrorCode } from "#db/index";
import { HTTP, HttpStatus } from "#lib/http";
import type { AuthEnv } from "#middleware/auth";
import { Hono } from "hono";
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
      // Large enough for phone photos used as avatars.
      maxSize: 5 * 1024 * 1024,
      onError: (c) =>
        c.json(
          HTTP.Response("Request body exceeds the 5 MB limit", null, false),
          HttpStatus.PAYLOAD_TOO_LARGE,
        ),
    }),
  )
  .route("/", userRouter)
  .route("/org", orgRouter)
  .route("/attendance", attendanceRouter)
  .notFound((c) =>
    c.json(
      HTTP.Response("The requested route was not found", null, false),
      HttpStatus.NOT_FOUND,
    ),
  )
  .onError((c) => {
    const err = c.error;

    if (err instanceof HTTPException) {
      if (err.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        console.error(`[${c.get("requestId")}]`, err);
      }

      return c.json(HTTP.Response(err.message, null, false), err.status);
    }

    const databaseCode = getPgErrorCode(err);

    if (databaseCode === "23505") {
      return c.json(
        HTTP.Response(
          "A record with the same value already exists",
          null,
          false,
        ),
        HttpStatus.CONFLICT,
      );
    }

    if (databaseCode === "23503") {
      return c.json(
        HTTP.Response("A related record does not exist", null, false),
        HttpStatus.BAD_REQUEST,
      );
    }

    if (databaseCode === "23514") {
      return c.json(
        HTTP.Response("The request violates a data constraint", null, false),
        HttpStatus.BAD_REQUEST,
      );
    }

    console.error(`[${c.get("requestId")}]`, err);

    return c.json(
      HTTP.Response("Internal server error", null, false),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

export type AppType = typeof app;

export default app;
