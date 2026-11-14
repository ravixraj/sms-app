import { USER_ROLE } from "#const";
import { createDb, getPgErrorCode } from "#db/index";
import { user } from "#db/schema";
import { hashPassword, passwordMatch, signToken } from "#lib/helper";
import { HTTP, HttpStatus, type ApiError } from "#lib/http";
import { deleteAvatar, uploadAvatar } from "#lib/r2";
import {
  createUserSchema,
  loginSchema,
  refreshTokenSchema,
} from "#lib/validation";
import { zValidator } from "#lib/zValidator";
import {
  authMiddleware,
  verifyPermission,
  type AuthEnv,
} from "#middleware/auth";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";

type Db = ReturnType<typeof createDb>;
type UserRecord = typeof user.$inferSelect;
type PublicUser = Omit<UserRecord, "password" | "refreshToken">;

/** Creates a token pair and stores the refresh token on the user row. */
const issueSession = async (db: Db, env: Env, publicUser: PublicUser) => {
  const payload: JWTPayload = {
    userId: publicUser.id,
    role: publicUser.role,
    organizationId: publicUser.organizationId,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signToken(payload, env.ACCESS_TOKEN_SECRET, env.ACCESS_TOKEN_EXPIRY),
    signToken(payload, env.REFRESH_TOKEN_SECRET, env.REFRESH_TOKEN_EXPIRY),
  ]);

  await db.update(user).set({ refreshToken }).where(eq(user.id, publicUser.id));

  return {
    user: publicUser,
    accessToken,
    refreshToken,
  };
};

export default new Hono<AuthEnv>()
  .post("/auth/login", zValidator("json", loginSchema), async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { email, password } = c.req.valid("json");

    const userRecord = await db.query.user.findFirst({
      where: { email },
      columns: { refreshToken: false },
    });

    if (!userRecord || !(await passwordMatch(password, userRecord.password))) {
      throw HTTP.error(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    const { password: _password, ...publicUser } = userRecord;

    const session = await issueSession(db, c.env, publicUser);

    return c.json(HTTP.success(session), HttpStatus.OK);
  })
  .post("/auth/refresh", zValidator("json", refreshTokenSchema), async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { refreshToken } = c.req.valid("json");

    let payload: JWTPayload;

    try {
      payload = await verify(refreshToken, c.env.REFRESH_TOKEN_SECRET, "HS256");
    } catch (error) {
      throw HTTP.error(
        HttpStatus.UNAUTHORIZED,
        "Invalid or expired refresh token",
        error,
      );
    }

    if (typeof payload.userId !== "string") {
      throw HTTP.error(
        HttpStatus.UNAUTHORIZED,
        "Invalid or expired refresh token",
      );
    }

    const userRecord = await db.query.user.findFirst({
      where: { id: payload.userId, refreshToken },
      columns: { password: false, refreshToken: false },
    });

    if (!userRecord) {
      throw HTTP.error(
        HttpStatus.UNAUTHORIZED,
        "Invalid or expired refresh token",
      );
    }

    const session = await issueSession(db, c.env, userRecord);

    return c.json(HTTP.success(session), HttpStatus.OK);
  })
  .post("/auth/logout", authMiddleware, async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { userId } = c.get("user");

    await db
      .update(user)
      .set({ refreshToken: null })
      .where(eq(user.id, userId));

    return c.json(HTTP.success(null), HttpStatus.OK);
  })
  .post(
    "/users",
    bodyLimit({
      maxSize: 100 * 1024, // 100kb
      onError: (c) =>
        c.json(
          {
            success: false,
            message: "Request body exceeds the 100 KB limit",
          } satisfies ApiError,
          HttpStatus.PAYLOAD_TOO_LARGE,
        ),
    }),
    authMiddleware,
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("form", createUserSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const {
        name,
        email,
        password,
        role,
        organizationId: requestedOrganizationId,
        avatar,
        gender,
        bloodGroup,
        dob,
        address,
      } = c.req.valid("form");

      const organizationId =
        role === USER_ROLE.ADMIN ? null : requestedOrganizationId;

      const [existingUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (existingUser) {
        throw HTTP.error(
          HttpStatus.CONFLICT,
          "A user with this email already exists",
        );
      }

      const [hashedPassword, uploadedAvatar] = await Promise.all([
        hashPassword(password),
        avatar
          ? uploadAvatar(c.env.USER_AVATARS, avatar, c.env.AVATAR_PUBLIC_URL)
          : null,
      ]);

      let newUser: UserRecord;

      try {
        [newUser] = await db
          .insert(user)
          .values({
            name,
            email,
            password: hashedPassword,
            role,
            organizationId,
            avatar: uploadedAvatar?.url,
            gender,
            bloodGroup,
            dob,
            address,
          })
          .returning();

        if (!newUser) {
          throw HTTP.error(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Failed to create user",
          );
        }
      } catch (error) {
        if (uploadedAvatar) {
          await deleteAvatar(
            c.env.USER_AVATARS,
            uploadedAvatar.key,
            c.env.AVATAR_PUBLIC_URL,
          );
        }

        const databaseCode = getPgErrorCode(error);

        if (databaseCode === "23503") {
          throw HTTP.error(
            HttpStatus.NOT_FOUND,
            "Organization not found",
            error,
          );
        }

        throw error;
      }

      const {
        password: _password,
        refreshToken: _refreshToken,
        ...publicUser
      } = newUser;

      return c.json(
        HTTP.success({ user: publicUser }, "Created"),
        HttpStatus.CREATED,
      );
    },
  )
  .get("/user/me", authMiddleware, async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { userId } = c.get("user");

    const userRecord = await db.query.user.findFirst({
      where: { id: userId },
      columns: {
        password: false,
        refreshToken: false,
      },
      with: {
        organization: true,
        teamMember: {
          with: {
            team: true,
          },
        },
      },
    });

    if (!userRecord) {
      throw HTTP.error(HttpStatus.NOT_FOUND, "User not found");
    }

    return c.json(HTTP.success({ user: userRecord }), HttpStatus.OK);
  });
