import { isUserRole, type UserRole } from "#const";
import { HTTP, HttpStatus } from "#lib/http";
import { createFactory } from "hono/factory";
import { verify, type JwtVariables } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";

export type AuthUser = {
  userId: string;
  role: UserRole;
};

export type AuthEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
  } & JwtVariables<AuthUser>;
};

export const factory = createFactory<AuthEnv>();

export const authMiddleware = factory.defineMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw HTTP.error(
      HttpStatus.UNAUTHORIZED,
      "Missing or malformed Authorization header",
    );
  }

  let payload: JWTPayload;

  try {
    payload = await verify(
      authHeader.slice(7),
      c.env.ACCESS_TOKEN_SECRET,
      "HS256",
    );
  } catch (error) {
    throw HTTP.error(
      HttpStatus.UNAUTHORIZED,
      "Invalid or expired access token",
      error,
    );
  }

  if (typeof payload.userId !== "string" || !isUserRole(payload.role)) {
    throw HTTP.error(HttpStatus.UNAUTHORIZED, "Invalid access token payload");
  }

  c.set("user", { userId: payload.userId, role: payload.role });

  await next();
});

export const verifyPermission = (roles: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return factory.defineMiddleware(async (c, next) => {
    if (!allowedRoles.includes(c.get("user").role)) {
      throw HTTP.error(
        HttpStatus.FORBIDDEN,
        "You do not have permission to perform this action",
      );
    }

    await next();
  });
};
