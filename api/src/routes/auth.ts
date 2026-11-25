import { USER_ROLE, ok, HTTPStatus, schoolDate } from "#const";
import { loginSchema } from "#validation";
import { user } from "#db/schema";
import {
  passwordMatch,
  signToken,
  clearSessionCookies,
  setSessionCookies,
} from "#lib/helper";
import { zValidator } from "#middleware/zValidator";
import { authMw, authUserSchema, type AuthEnv } from "#middleware/auth";
import { bodyLimitMw } from "#middleware/bodyLimit";
import { getCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import type z from "zod";

const generateAccessAndRefreshTokens = async (
  env: Env,
  payload: z.infer<typeof authUserSchema>,
) => {
  const [accessToken, refreshToken] = await Promise.all([
    signToken(payload, env.ACCESS_TOKEN_SECRET, env.ACCESS_TOKEN_EXPIRY),
    signToken(payload, env.REFRESH_TOKEN_SECRET, env.REFRESH_TOKEN_EXPIRY),
  ]);
  return { accessToken, refreshToken };
};

export default new Hono<AuthEnv>()
  .post("/refresh", async (c) => {
    const db = c.get("db");
    // The refresh token lives in an httpOnly cookie — no request body needed.
    const refreshToken = getCookie(c, "refreshToken");
    if (!refreshToken) {
      throw new HTTPException(HTTPStatus.UNAUTHORIZED, {
        message: "Your session has expired. Please sign in again.",
      });
    }

    let payload: JWTPayload;

    try {
      payload = await verify(refreshToken, c.env.REFRESH_TOKEN_SECRET, "HS256");
    } catch (error) {
      throw new HTTPException(HTTPStatus.UNAUTHORIZED, {
        message: "Your session has expired. Please sign in again.",
        cause: error,
      });
    }

    if (!authUserSchema.validate(payload)) {
      throw new HTTPException(HTTPStatus.UNAUTHORIZED, {
        message: "Your session is invalid. Please sign in again.",
      });
    }

    // Sign the replacement pair from the verified claims first, then rotate in
    // a single UPDATE. The WHERE on the old token rejects any reuse.
    const newTokens = await generateAccessAndRefreshTokens(c.env, {
      userId: payload.userId,
      role: payload.role,
      orgid: payload.orgid,
    });

    const [updatedUser] = await db
      .update(user)
      .set({ refreshToken: newTokens.refreshToken })
      .where(
        and(eq(user.id, payload.userId), eq(user.refreshToken, refreshToken)),
      )
      .returning({ id: user.id, role: user.role, orgid: user.orgid });

    if (!updatedUser) {
      throw new HTTPException(HTTPStatus.UNAUTHORIZED, {
        message: "Your session has expired. Please sign in again.",
      });
    }

    // Rare: role/org changed under an unexpired token. Re-sign from the current
    // DB values and overwrite so the stored token reflects them.
    if (
      updatedUser.role !== payload.role ||
      updatedUser.orgid !== payload.orgid
    ) {
      const currentTokens = await generateAccessAndRefreshTokens(c.env, {
        userId: updatedUser.id,
        role: updatedUser.role,
        orgid: updatedUser.orgid,
      });
      await db
        .update(user)
        .set({ refreshToken: currentTokens.refreshToken })
        .where(eq(user.id, updatedUser.id));
      setSessionCookies(c, currentTokens);
      return c.json(ok(currentTokens), HTTPStatus.OK);
    }

    setSessionCookies(c, newTokens);

    return c.json(ok(newTokens), HTTPStatus.OK);
  })
  .post(
    "/login",
    bodyLimitMw(4 * 1024),
    zValidator("json", loginSchema),
    async (c) => {
      const db = c.get("db");
      const { email, password } = c.req.valid("json");

      const userRecord = await db.query.user.findFirst({
        where: { email },
        columns: {
          id: true,
          orgid: true,
          name: true,
          email: true,
          emailVerified: true,
          password: true,
          role: true,
          avatar: true,
        },
      });

      if (
        !userRecord ||
        !(await passwordMatch(password, userRecord.password))
      ) {
        throw new HTTPException(HTTPStatus.UNAUTHORIZED, {
          message: "Invalid email or password",
        });
      }

      const token = await generateAccessAndRefreshTokens(c.env, {
        userId: userRecord.id,
        role: userRecord.role,
        orgid: userRecord.orgid,
      });

      await db
        .update(user)
        .set({ refreshToken: token.refreshToken })
        .where(eq(user.id, userRecord.id));

      setSessionCookies(c, token);
      const { password: _password, ...publicUser } = userRecord;

      // Tokens stay in httpOnly cookies only — never expose them to page JS.
      return c.json(
        ok({
          user: {
            ...publicUser,
            avatar: c.env.AVATAR_PUBLIC_URL + publicUser.avatar,
          },
        }),
        HTTPStatus.OK,
      );
    },
  )
  .post("/logout", authMw, async (c) => {
    const db = c.get("db");
    const { userId } = c.get("user");

    await db
      .update(user)
      .set({ refreshToken: null })
      .where(eq(user.id, userId));

    clearSessionCookies(c);

    return c.json(ok(null), HTTPStatus.OK);
  })
  .get("/me", authMw, async (c) => {
    const db = c.get("db");
    const { userId, role } = c.get("user");

    const userRecord = await db.query.user.findFirst({
      where: { id: userId },
      columns: {
        id: true,
        orgid: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        avatar: true,
        gender: true,
        bg: true,
        dob: true,
        address: true,
        createdAt: true,
      },
      with: {
        org: {
          columns: { name: true },
        },
        // Principals are not assigned to a team, so skip the lookup.
        ...(role === USER_ROLE.PRINCIPAL
          ? {}
          : {
              teamMember: {
                columns: { userId: true },
                with: {
                  team: {
                    columns: { id: true, name: true },
                  },
                },
              },
            }),
        // Only teachers can lead classes.
        ...(role === USER_ROLE.TEACHER
          ? {
              ledTeams: {
                columns: { id: true, name: true },
              },
            }
          : {}),
      },
    });

    if (!userRecord) {
      throw new HTTPException(HTTPStatus.NOT_FOUND, {
        message: "User not found",
      });
    }

    // A conditional `with` widens Drizzle's relation type; normalize it so
    // the RPC response always has the same shape.
    const teamMember =
      userRecord.teamMember && "team" in userRecord.teamMember
        ? userRecord.teamMember
        : null;

    return c.json(
      ok({
        user: {
          ...userRecord,
          teamMember,
          avatar: c.env.AVATAR_PUBLIC_URL + userRecord.avatar,
        },
        schoolDate: schoolDate(),
      }),
      HTTPStatus.OK,
    );
  });
