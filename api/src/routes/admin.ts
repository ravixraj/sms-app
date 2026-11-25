import { Hono } from "hono";
import { authMw, verifyPermission, type AuthEnv } from "#middleware/auth";
import type { Db } from "#middleware/db";
import { bodyLimitMw } from "#middleware/bodyLimit";
import { zValidator } from "#middleware/zValidator";
import { HTTPException } from "hono/http-exception";
import { org, team, teamMember, user } from "#db/schema";
import { hashPassword, uploadAvatar } from "#lib/helper";
import { and, eq } from "drizzle-orm";
import { USER_ROLE, ok, HTTPStatus } from "#const";
import {
  deleteOrgSchema,
  orgSchema,
  createUserSchema,
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  deleteTeamMemberSchema,
} from "#validation";

const verifyTeamLeader = async (db: Db, leaderId: string, orgid: string) => {
  const leader = await db.query.user.findFirst({
    where: { id: leaderId, orgid, role: USER_ROLE.TEACHER },
    columns: { id: true },
  });
  if (!leader)
    throw new HTTPException(HTTPStatus.BAD_REQUEST, {
      message: "Leader must be a teacher in this school",
    });
};

export default new Hono<AuthEnv>()
  .use(authMw)
  .use(verifyPermission(USER_ROLE.ADMIN))
  .post(
    "/org",
    bodyLimitMw(4 * 1024),
    zValidator("json", orgSchema),
    async (c) => {
      const db = c.get("db");
      const [created] = await db
        .insert(org)
        .values(c.req.valid("json"))
        .returning({ id: org.id, name: org.name });
      if (!created)
        throw new HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, {
          message: "Failed to create school",
        });
      return c.json(ok(created), HTTPStatus.CREATED);
    },
  )
  .delete(
    "/org",
    bodyLimitMw(2 * 1024),
    zValidator("json", deleteOrgSchema),
    async (c) => {
      const db = c.get("db");
      const { orgid } = c.req.valid("json");
      const [deleted] = await db
        .delete(org)
        .where(eq(org.id, orgid))
        .returning({ id: org.id });
      if (!deleted)
        throw new HTTPException(HTTPStatus.NOT_FOUND, {
          message: "School not found",
        });
      return c.json(ok(deleted), HTTPStatus.OK);
    },
  )
  .post(
    "/user",
    bodyLimitMw(112 * 1024),
    zValidator("form", createUserSchema),
    async (c) => {
      const db = c.get("db");
      const {
        name,
        email,
        password,
        role,
        orgid: requestedOrgid,
        avatar,
        gender,
        bg,
        dob,
        address,
      } = c.req.valid("form");

      const orgid = role === USER_ROLE.ADMIN ? null : requestedOrgid;

      if (orgid) {
        const existingOrg = await db.query.org.findFirst({
          where: { id: orgid },
          columns: { id: true },
        });

        if (!existingOrg) {
          throw new HTTPException(HTTPStatus.NOT_FOUND, {
            message: "School not found",
          });
        }
      }

      const [hashedPassword, uploadedAvatar] = await Promise.all([
        hashPassword(password),
        avatar ? uploadAvatar(c, avatar) : null,
      ]);

      try {
        // The unique constraint on email replaces the separate pre-check, and
        // RETURNING enumerates only the columns safe to send back.
        const [createdUser] = await db
          .insert(user)
          .values({
            name,
            email,
            password: hashedPassword,
            role,
            orgid,
            avatar: uploadedAvatar?.key,
            gender,
            bg,
            dob,
            address,
          })
          .onConflictDoNothing({ target: user.email })
          .returning({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            orgid: user.orgid,
          });

        if (!createdUser) {
          throw new HTTPException(HTTPStatus.CONFLICT, {
            message: "A user with this email already exists",
          });
        }

        return c.json(ok({ user: createdUser }), HTTPStatus.CREATED);
      } catch (error) {
        // Roll back the uploaded object if the insert did not succeed.
        if (uploadedAvatar) {
          await c.env.BUCKET.delete(uploadedAvatar.key).catch(() => {});
        }
        // Preserve expected errors (e.g. the email conflict) as-is.
        if (error instanceof HTTPException) throw error;

        throw new HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, {
          message: "Failed to create user",
        });
      }
    },
  )
  .post(
    "/team",
    bodyLimitMw(2 * 1024),
    zValidator("json", createTeamSchema),
    async (c) => {
      const db = c.get("db");
      const data = c.req.valid("json");
      await verifyTeamLeader(db, data.leaderId, data.orgid);
      const [created] = await db
        .insert(team)
        .values(data)
        .returning({ id: team.id, name: team.name });
      if (!created)
        throw new HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, {
          message: "Failed to create team",
        });
      return c.json(ok(created), HTTPStatus.CREATED);
    },
  )
  .patch(
    "/team",
    bodyLimitMw(2 * 1024),
    zValidator("json", updateTeamSchema),
    async (c) => {
      const db = c.get("db");
      const { orgid, teamId, name, leaderId } = c.req.valid("json");
      if (leaderId !== undefined) await verifyTeamLeader(db, leaderId, orgid);
      const [updated] = await db
        .update(team)
        .set({ name, leaderId })
        .where(and(eq(team.id, teamId), eq(team.orgid, orgid)))
        .returning({ id: team.id, name: team.name, leaderId: team.leaderId });
      if (!updated)
        throw new HTTPException(HTTPStatus.NOT_FOUND, {
          message: "Team not found",
        });
      return c.json(ok(updated), HTTPStatus.OK);
    },
  )
  .post(
    "/team/member",
    bodyLimitMw(2 * 1024),
    zValidator("json", addTeamMemberSchema),
    async (c) => {
      const db = c.get("db");
      const { teamId, userId } = c.req.valid("json");
      const [eligible] = await db
        .select({ userId: user.id })
        .from(team)
        .innerJoin(user, and(eq(user.id, userId), eq(user.orgid, team.orgid)))
        .where(eq(team.id, teamId))
        .limit(1);
      if (!eligible)
        throw new HTTPException(HTTPStatus.BAD_REQUEST, {
          message: "Team and user must belong to the same school",
        });
      const [created] = await db
        .insert(teamMember)
        .values({ teamId, userId })
        .onConflictDoNothing({ target: teamMember.userId })
        .returning({ teamId: teamMember.teamId, userId: teamMember.userId });
      if (!created)
        throw new HTTPException(HTTPStatus.CONFLICT, {
          message: "User already belongs to a team",
        });
      return c.json(ok(created), HTTPStatus.CREATED);
    },
  )
  .delete(
    "/team/member",
    bodyLimitMw(2 * 1024),
    zValidator("json", deleteTeamMemberSchema),
    async (c) => {
      const db = c.get("db");
      const { teamId, userId, orgid } = c.req.valid("json");
      const scopedTeam = await db.query.team.findFirst({
        where: { id: teamId, orgid },
        columns: { id: true },
      });
      if (!scopedTeam)
        throw new HTTPException(HTTPStatus.NOT_FOUND, {
          message: "Team not found",
        });

      const [deleted] = await db
        .delete(teamMember)
        .where(
          and(eq(teamMember.userId, userId), eq(teamMember.teamId, teamId)),
        )
        .returning({ teamId: teamMember.teamId, userId: teamMember.userId });

      if (!deleted)
        throw new HTTPException(HTTPStatus.NOT_FOUND, {
          message: "Team member not found",
        });
      return c.json(ok(deleted), HTTPStatus.OK);
    },
  );
