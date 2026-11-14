import { USER_ROLE } from "#const";
import { createDb } from "#db/index";
import { organization, team, teamMember, user } from "#db/schema";
import { HTTP, HttpStatus } from "#lib/http";
import {
  addTeamMemberSchema,
  createOrganizationSchema,
  createTeamSchema,
  deleteOrganizationSchema,
  deleteTeamMemberSchema,
  teamMemberParamSchema,
  teamMembersQuerySchema,
  updateTeamSchema,
} from "#lib/validation";
import { zValidator } from "#lib/zValidator";
import {
  authMiddleware,
  verifyPermission,
  type AuthEnv,
} from "#middleware/auth";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

type Db = ReturnType<typeof createDb>;

/** Ensures a team leader exists, belongs to the organization, and is a teacher. */
const verifyTeamLeader = async (
  db: Db,
  leaderId: string,
  organizationId: string,
) => {
  const [leader] = await db
    .select({
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, leaderId))
    .limit(1);

  if (!leader) {
    throw HTTP.error(HttpStatus.NOT_FOUND, "Leader not found");
  }

  if (leader.organizationId !== organizationId) {
    throw HTTP.error(
      HttpStatus.BAD_REQUEST,
      "Team leader must be a member of the organization",
    );
  }

  if (leader.role !== USER_ROLE.TEACHER) {
    throw HTTP.error(HttpStatus.BAD_REQUEST, "Team leader must be a teacher");
  }

  return leader;
};

export default new Hono<AuthEnv>()
  .use(authMiddleware)
  .post(
    "/",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("json", createOrganizationSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const data = c.req.valid("json");

      const [created] = await db
        .insert(organization)
        .values({
          name: data.name,
          metadata: data.metadata,
        })
        .returning();

      if (!created) {
        throw HTTP.error(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "Failed to create organization",
        );
      }

      return c.json(HTTP.success(created, "Created"), HttpStatus.CREATED);
    },
  )
  .delete(
    "/",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("json", deleteOrganizationSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId } = c.req.valid("json");

      const [deleted] = await db
        .delete(organization)
        .where(eq(organization.id, organizationId))
        .returning();

      if (!deleted) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Organization not found");
      }

      return c.json(HTTP.success(deleted), HttpStatus.OK);
    },
  )
  .post(
    "/team",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("json", createTeamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId, name, leaderId } = c.req.valid("json");

      const [existingOrganization] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      if (!existingOrganization) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Organization not found");
      }

      await verifyTeamLeader(db, leaderId, organizationId);

      const [created] = await db
        .insert(team)
        .values({
          organizationId,
          name,
          leaderId,
        })
        .returning();

      if (!created) {
        throw HTTP.error(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "Failed to create team",
        );
      }

      return c.json(HTTP.success(created, "Created"), HttpStatus.CREATED);
    },
  )
  .patch(
    "/team",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("json", updateTeamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId, teamId, name, leaderId } = c.req.valid("json");

      const [existingTeam] = await db
        .select({ id: team.id })
        .from(team)
        .where(
          and(eq(team.id, teamId), eq(team.organizationId, organizationId)),
        )
        .limit(1);

      if (!existingTeam) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Team not found");
      }

      if (leaderId !== undefined) {
        await verifyTeamLeader(db, leaderId, organizationId);
      }

      const updates: Partial<typeof team.$inferInsert> = {};

      if (name !== undefined) {
        updates.name = name;
      }

      if (leaderId !== undefined) {
        updates.leaderId = leaderId;
      }

      const [updated] = await db
        .update(team)
        .set(updates)
        .where(
          and(eq(team.id, teamId), eq(team.organizationId, organizationId)),
        )
        .returning();

      if (!updated) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Team not found");
      }

      return c.json(HTTP.success(updated, "Updated"), HttpStatus.OK);
    },
  )
  .post(
    "/team/member",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("json", addTeamMemberSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { teamId, userId } = c.req.valid("json");

      // organizationId is needed to verify the user belongs to the same org.
      const [existingTeam] = await db
        .select({ id: team.id, organizationId: team.organizationId })
        .from(team)
        .where(eq(team.id, teamId))
        .limit(1);

      if (!existingTeam) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Team not found");
      }

      const [memberUser] = await db
        .select({
          id: user.id,
          organizationId: user.organizationId,
          role: user.role,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!memberUser) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "User not found");
      }

      if (memberUser.organizationId !== existingTeam.organizationId) {
        throw HTTP.error(
          HttpStatus.BAD_REQUEST,
          "User is not a member of the organization",
        );
      }

      if (memberUser.role !== USER_ROLE.STUDENT) {
        throw HTTP.error(
          HttpStatus.BAD_REQUEST,
          "Only students can be added to a class",
        );
      }

      // teamMember.userId is unique, so a user can belong to only one team.
      const [existing] = await db
        .select({ teamId: teamMember.teamId })
        .from(teamMember)
        .where(eq(teamMember.userId, userId))
        .limit(1);

      if (existing) {
        throw HTTP.error(
          HttpStatus.CONFLICT,
          existing.teamId === teamId
            ? "User is already a member of this team"
            : "User already belongs to another team",
        );
      }

      const [created] = await db
        .insert(teamMember)
        .values({
          teamId,
          userId,
        })
        .returning();

      if (!created) {
        throw HTTP.error(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "Failed to add team member",
        );
      }

      return c.json(HTTP.success(created, "Created"), HttpStatus.CREATED);
    },
  )
  .get(
    "/team/member",
    zValidator("query", teamMembersQuerySchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId, teamId } = c.req.valid("query");
      const requester = c.get("user");

      // Only leaderId is needed for the permission check.
      const [existingTeam] = await db
        .select({ leaderId: team.leaderId })
        .from(team)
        .where(
          and(eq(team.id, teamId), eq(team.organizationId, organizationId)),
        )
        .limit(1);

      if (!existingTeam) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Team not found");
      }

      const account = await db.query.user.findFirst({
        where: { id: requester.userId },
        columns: { organizationId: true },
      });
      const isAdmin = requester.role === USER_ROLE.ADMIN;
      const isOrganizationPrincipal =
        requester.role === USER_ROLE.PRINCIPAL &&
        account?.organizationId === organizationId;
      const isTeamLeader =
        requester.role === USER_ROLE.TEACHER &&
        account?.organizationId === organizationId &&
        existingTeam.leaderId === requester.userId;

      if (!isAdmin && !isOrganizationPrincipal && !isTeamLeader) {
        throw HTTP.error(
          HttpStatus.FORBIDDEN,
          "Only administrators, principals of this organization, or the team leader can view team members",
        );
      }

      const members = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          gender: user.gender,
          joinedAt: teamMember.createdAt,
        })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(
          and(
            eq(teamMember.teamId, teamId),
            eq(user.organizationId, organizationId),
            eq(user.role, USER_ROLE.STUDENT),
          ),
        );

      return c.json(HTTP.success(members), HttpStatus.OK);
    },
  )
  .delete(
    "/team/member/:userId",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("param", teamMemberParamSchema),
    zValidator("json", deleteTeamMemberSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { userId } = c.req.valid("param");
      const { organizationId } = c.req.valid("json");

      // The membership row identifies the team, so teamId is not needed.
      const [existingMember] = await db
        .select({
          teamId: teamMember.teamId,
          organizationId: team.organizationId,
          leaderId: team.leaderId,
        })
        .from(teamMember)
        .innerJoin(team, eq(teamMember.teamId, team.id))
        .where(eq(teamMember.userId, userId))
        .limit(1);

      if (!existingMember || existingMember.organizationId !== organizationId) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Team member not found");
      }

      if (existingMember.leaderId === userId) {
        throw HTTP.error(
          HttpStatus.CONFLICT,
          "Reassign team leadership before removing the leader",
        );
      }

      const [deleted] = await db
        .delete(teamMember)
        .where(
          and(
            eq(teamMember.teamId, existingMember.teamId),
            eq(teamMember.userId, userId),
          ),
        )
        .returning();

      if (!deleted) {
        throw HTTP.error(HttpStatus.NOT_FOUND, "Team member not found");
      }

      return c.json(HTTP.success(deleted), HttpStatus.OK);
    },
  );
