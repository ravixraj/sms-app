import { HTTPStatus, USER_ROLE, type UserRole } from "#const";
import { HTTPException } from "hono/http-exception";
import { defineMiddleware } from "hono/factory";
import { jwt, type JwtVariables } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import { z } from "zod";
import type { Db } from "./db";

export const authUserSchema = z.object({
  userId: z.string(),
  role: z.enum(USER_ROLE),
  orgid: z.string().nullable(),
});

export type AuthEnv = {
  Bindings: Env;
  Variables: JwtVariables<JWTPayload> & {
    user: z.infer<typeof authUserSchema>;
    db: Db;
  };
};

export const authMw = defineMiddleware<AuthEnv>(async (c, next) => {
  return jwt({
    secret: c.env.ACCESS_TOKEN_SECRET,
    alg: "HS256",
    cookie: "accessToken",
  })(c, async () => {
    const payload = c.get("jwtPayload");

    if (!authUserSchema.validate(payload)) {
      throw new HTTPException(HTTPStatus.UNAUTHORIZED, {
        message: "Invalid access token payload",
      });
    }

    const { userId, role, orgid } = payload;
    c.set("user", { userId, role, orgid });

    await next();
  });
});

export const verifyPermission = (roles: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return defineMiddleware<AuthEnv>(async (c, next) => {
    if (!allowedRoles.includes(c.get("user").role)) {
      throw new HTTPException(HTTPStatus.FORBIDDEN, {
        message: "You do not have permission to perform this action",
      });
    }

    await next();
  });
};
