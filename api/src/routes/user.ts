import { USER_ROLE } from "#const";
import type { AppBindings } from "#app-env";
import { createDb, getPgErrorCode } from "#db/index";
import { user } from "#db/schema";
import {
  generateAccessAndRefreshTokens,
  hashPassword,
  passwordMatch,
  toPublicUser,
} from "#lib/helper";
import { HTTP, HttpPhrase, HttpStatus } from "#lib/http";
import { deleteAvatar, uploadAvatar } from "#lib/r2";
import {
  createUserSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from "#lib/validation";
import { zValidator } from "#lib/zValidator";
import {
  authMiddleware,
  verifyPermission,
  type AuthEnv,
} from "#middleware/auth";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";

type Db = ReturnType<typeof createDb>;
type UserRecord = typeof user.$inferSelect;

/** Creates a token pair and stores the refresh token on the user row. */
const issueSession = async (
  db: Db,
  env: AppBindings,
  userRecord: UserRecord,
) => {
  const tokens = await generateAccessAndRefreshTokens(
    { userId: userRecord.id, role: userRecord.role },
    {
      accessSecret: env.ACCESS_TOKEN_SECRET,
      accessExpiry: env.ACCESS_TOKEN_EXPIRY,
      refreshSecret: env.REFRESH_TOKEN_SECRET,
      refreshExpiry: env.REFRESH_TOKEN_EXPIRY,
    },
  );

  await db
    .update(user)
    .set({ refreshToken: tokens.refreshToken })
    .where(eq(user.id, userRecord.id));

  return {
    user: toPublicUser(userRecord),
    ...tokens,
  };
};

export default new Hono<AuthEnv>()
  .post("/auth/login", zValidator("json", loginSchema), async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { email, password } = c.req.valid("json");

    const userRecord = await db.query.user.findFirst({
      where: { email },
    });

    if (!userRecord || !(await passwordMatch(password, userRecord.password))) {
      throw HTTP.Error(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    const session = await issueSession(db, c.env, userRecord);

    return c.json(HTTP.Response(HttpPhrase.OK, session), HttpStatus.OK);
  })
  .post("/auth/refresh", zValidator("json", refreshTokenSchema), async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { refreshToken } = c.req.valid("json");

    let payload: JWTPayload;

    try {
      payload = await verify(refreshToken, c.env.REFRESH_TOKEN_SECRET, "HS256");
    } catch (error) {
      throw HTTP.Error(
        HttpStatus.UNAUTHORIZED,
        "Invalid or expired refresh token",
        error,
      );
    }

    if (typeof payload.userId !== "string") {
      throw HTTP.Error(
        HttpStatus.UNAUTHORIZED,
        "Invalid or expired refresh token",
      );
    }

    const userRecord = await db.query.user.findFirst({
      where: { id: payload.userId },
    });

    if (!userRecord || userRecord.refreshToken !== refreshToken) {
      throw HTTP.Error(
        HttpStatus.UNAUTHORIZED,
        "Invalid or expired refresh token",
      );
    }

    const session = await issueSession(db, c.env, userRecord);

    return c.json(HTTP.Response(HttpPhrase.OK, session), HttpStatus.OK);
  })
  .post("/auth/logout", authMiddleware, async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { userId } = c.get("user");

    await db
      .update(user)
      .set({ refreshToken: null })
      .where(eq(user.id, userId));

    return c.json(HTTP.Response(HttpPhrase.OK, null), HttpStatus.OK);
  })
  .post(
    "/users",
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
        organizationId,
        avatar,
        gender,
        bloodGroup,
        dob,
        address,
      } = c.req.valid("form");

      const [existingUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (existingUser) {
        throw HTTP.Error(
          HttpStatus.CONFLICT,
          "A user with this email already exists",
        );
      }

      const [hashedPassword, uploadedAvatar] = await Promise.all([
        hashPassword(password),
        avatar ? uploadAvatar(c.env.USER_AVATARS, avatar) : null,
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
            organizationId:
              role === USER_ROLE.ADMIN ? null : (organizationId ?? null),
            avatar: uploadedAvatar?.key,
            gender,
            bloodGroup,
            dob,
            address,
          })
          .returning();

        if (!newUser) {
          throw HTTP.Error(HttpStatus.BAD_REQUEST, "Failed to create user");
        }
      } catch (error) {
        if (uploadedAvatar) {
          await deleteAvatar(c.env.USER_AVATARS, uploadedAvatar.key);
        }

        const databaseCode = getPgErrorCode(error);

        if (databaseCode === "23505") {
          throw HTTP.Error(
            HttpStatus.CONFLICT,
            "A user with this email already exists",
            error,
          );
        }

        if (databaseCode === "23503") {
          throw HTTP.Error(
            HttpStatus.NOT_FOUND,
            "Organization not found",
            error,
          );
        }

        throw error;
      }

      return c.json(
        HTTP.Response(HttpPhrase.CREATED, {
          user: toPublicUser(newUser),
        }),
        HttpStatus.CREATED,
      );
    },
  )
  .get("/users/me", authMiddleware, async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const { userId } = c.get("user");

    const userRecord = await db.query.user.findFirst({
      where: { id: userId },
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
      throw HTTP.Error(HttpStatus.NOT_FOUND, "User not found");
    }

    return c.json(
      HTTP.Response(HttpPhrase.OK, { user: toPublicUser(userRecord) }),
      HttpStatus.OK,
    );
  })
  .patch(
    "/users/me",
    authMiddleware,
    zValidator("form", updateProfileSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { userId } = c.get("user");
      const data = c.req.valid("form");

      const [existing] = await db
        .select({ avatar: user.avatar })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!existing) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "User not found");
      }

      const uploadedAvatar = data.avatar
        ? await uploadAvatar(c.env.USER_AVATARS, data.avatar)
        : null;

      let updatedUser: UserRecord | undefined;

      try {
        [updatedUser] = await db
          .update(user)
          .set({
            name: data.name,
            gender: data.gender,
            bloodGroup: data.bloodGroup,
            avatar: uploadedAvatar?.key,
            dob: data.dob,
            address: data.address,
          })
          .where(eq(user.id, userId))
          .returning();
      } catch (error) {
        if (uploadedAvatar) {
          await deleteAvatar(c.env.USER_AVATARS, uploadedAvatar.key);
        }

        throw error;
      }

      if (!updatedUser) {
        if (uploadedAvatar) {
          await deleteAvatar(c.env.USER_AVATARS, uploadedAvatar.key);
        }

        throw HTTP.Error(HttpStatus.NOT_FOUND, "User not found");
      }

      // Delete the old avatar only after the database update succeeds.
      if (
        uploadedAvatar &&
        existing.avatar &&
        existing.avatar !== uploadedAvatar.key
      ) {
        await deleteAvatar(c.env.USER_AVATARS, existing.avatar);
      }

      return c.json(
        HTTP.Response(HttpPhrase.OK, { user: toPublicUser(updatedUser) }),
        HttpStatus.OK,
      );
    },
  );
