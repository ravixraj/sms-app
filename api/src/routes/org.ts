import { USER_ROLE } from "#const";
import { createDb } from "#db/index";
import { organization, team, teamMember, user } from "#db/schema";
import { toPublicUser } from "#lib/helper";
import { HTTP, HttpPhrase, HttpStatus } from "#lib/http";
import {
  addTeamMemberSchema,
  createOrganizationSchema,
  createTeamSchema,
  organizationIdParamSchema,
  organizationTeamParamSchema,
  teamMemberParamSchema,
} from "#lib/validation";
import { zValidator } from "#lib/zValidator";
import {
  authMiddleware,
  verifyPermission,
  type AuthEnv,
} from "#middleware/auth";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";

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

      return c.json(
        HTTP.Response(HttpPhrase.CREATED, created),
        HttpStatus.CREATED,
      );
    },
  )
  .delete(
    "/:organizationId",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("param", organizationIdParamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId } = c.req.valid("param");

      const [deleted] = await db
        .delete(organization)
        .where(eq(organization.id, organizationId))
        .returning();

      if (!deleted) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "Organization not found");
      }

      return c.json(HTTP.Response(HttpPhrase.OK, deleted), HttpStatus.OK);
    },
  )
  // Teams
  .post(
    "/:organizationId/teams",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("param", organizationIdParamSchema),
    zValidator("json", createTeamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId } = c.req.valid("param");
      const { name, leaderId } = c.req.valid("json");

      const [existingOrganization] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      if (!existingOrganization) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "Organization not found");
      }

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
        throw HTTP.Error(HttpStatus.NOT_FOUND, "Leader not found");
      }

      if (leader.organizationId !== organizationId) {
        throw HTTP.Error(
          HttpStatus.BAD_REQUEST,
          "Team leader must be a member of the organization",
        );
      }

      if (leader.role !== USER_ROLE.TEACHER) {
        throw HTTP.Error(
          HttpStatus.BAD_REQUEST,
          "Team leader must be a teacher",
        );
      }

      const [created] = await db
        .insert(team)
        .values({
          organizationId,
          name,
          leaderId,
        })
        .returning();

      return c.json(
        HTTP.Response(HttpPhrase.CREATED, created),
        HttpStatus.CREATED,
      );
    },
  )
  // Team members
  .post(
    "/:organizationId/teams/:teamId/members",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("param", organizationTeamParamSchema),
    zValidator("json", addTeamMemberSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId, teamId } = c.req.valid("param");
      const { userId } = c.req.valid("json");

      // Existence check only — no need for the full team row.
      const [existingTeam] = await db
        .select({ id: team.id })
        .from(team)
        .where(
          and(eq(team.id, teamId), eq(team.organizationId, organizationId)),
        )
        .limit(1);

      if (!existingTeam) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "Team not found");
      }

      const [memberUser] = await db
        .select({
          id: user.id,
          organizationId: user.organizationId,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!memberUser) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "User not found");
      }

      if (memberUser.organizationId !== organizationId) {
        throw HTTP.Error(
          HttpStatus.BAD_REQUEST,
          "User is not a member of the organization",
        );
      }

      // teamMember.userId is unique, so a user can belong to only one team.
      const [existing] = await db
        .select({ teamId: teamMember.teamId })
        .from(teamMember)
        .where(eq(teamMember.userId, userId))
        .limit(1);

      if (existing) {
        throw HTTP.Error(
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

      return c.json(
        HTTP.Response(HttpPhrase.CREATED, created),
        HttpStatus.CREATED,
      );
    },
  )
  .get(
    "/:organizationId/teams/:teamId/members",
    zValidator("param", organizationTeamParamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId, teamId } = c.req.valid("param");
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
        throw HTTP.Error(HttpStatus.NOT_FOUND, "Team not found");
      }

      const isAdmin = requester.role === USER_ROLE.ADMIN;
      let isOrganizationPrincipal = false;

      if (requester.role === USER_ROLE.PRINCIPAL) {
        const [principal] = await db
          .select({ organizationId: user.organizationId })
          .from(user)
          .where(eq(user.id, requester.userId))
          .limit(1);

        isOrganizationPrincipal = principal?.organizationId === organizationId;
      }

      const isTeamLeader = existingTeam.leaderId === requester.userId;

      if (!isAdmin && !isOrganizationPrincipal && !isTeamLeader) {
        throw HTTP.Error(
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
        .where(eq(teamMember.teamId, teamId));

      return c.json(HTTP.Response(HttpPhrase.OK, members), HttpStatus.OK);
    },
  )
  .delete(
    "/:organizationId/teams/:teamId/members/:userId",
    verifyPermission([USER_ROLE.ADMIN]),
    zValidator("param", teamMemberParamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { organizationId, teamId, userId } = c.req.valid("param");

      // Only leaderId is needed for the leadership check.
      const [existingTeam] = await db
        .select({ leaderId: team.leaderId })
        .from(team)
        .where(
          and(eq(team.id, teamId), eq(team.organizationId, organizationId)),
        )
        .limit(1);

      if (!existingTeam) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "Team not found");
      }

      if (existingTeam.leaderId === userId) {
        throw HTTP.Error(
          HttpStatus.CONFLICT,
          "Reassign team leadership before removing the leader",
        );
      }

      const [deleted] = await db
        .delete(teamMember)
        .where(
          and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)),
        )
        .returning();

      if (!deleted) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "Team member not found");
      }

      return c.json(HTTP.Response(HttpPhrase.OK, deleted), HttpStatus.OK);
    },
  );
