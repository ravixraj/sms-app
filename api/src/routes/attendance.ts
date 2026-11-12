import { ATTENDANCE_STATUSES, USER_ROLE } from "#const";
import { createDb } from "#db/index";
import { attendance, team, teamMember, user } from "#db/schema";
import { HTTP, HttpPhrase, HttpStatus } from "#lib/http";
import {
  attendanceQuerySchema,
  classQuerySchema,
  markAttendanceSchema,
  userAttendanceParamSchema,
} from "#lib/validation";
import { zValidator } from "#lib/zValidator";
import {
  authMiddleware,
  verifyPermission,
  type AuthEnv,
} from "#middleware/auth";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";

// A TEACHER acts as the class in-charge: their scope is the team(s) they lead,
// not the whole organization. ADMINs and PRINCIPALs can read attendance but
// cannot mark it.
const findLedTeamIds = async (
  db: ReturnType<typeof createDb>,
  leaderId: string,
  organizationId: string,
) => {
  const ledTeams = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(eq(team.leaderId, leaderId), eq(team.organizationId, organizationId)),
    );

  return ledTeams.map((ledTeam) => ledTeam.id);
};

// ---------------------------------------------------------------------------
// Attendance routes
// ---------------------------------------------------------------------------

export default new Hono<AuthEnv>()
  .use(authMiddleware)
  // Mark attendance for a class on one day — TEACHER (class in-charge) only
  .post(
    "/",
    verifyPermission([USER_ROLE.TEACHER]),
    zValidator("json", markAttendanceSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { teamId, date, records } = c.req.valid("json");
      const teacher = c.get("user");

      const [ledTeam] = await db
        .select({ id: team.id })
        .from(team)
        .where(and(eq(team.id, teamId), eq(team.leaderId, teacher.userId)))
        .limit(1);

      if (!ledTeam) {
        throw HTTP.Error(
          HttpStatus.FORBIDDEN,
          "You are not the class in-charge of this team",
        );
      }

      const userIds = records.map((record) => record.userId);

      // Every record must belong to the class the teacher is marking.
      const classMembers = await db
        .select({ userId: teamMember.userId })
        .from(teamMember)
        .where(
          and(
            eq(teamMember.teamId, teamId),
            inArray(teamMember.userId, userIds),
          ),
        );

      if (classMembers.length !== userIds.length) {
        const memberIds = new Set(classMembers.map((member) => member.userId));
        const notInClass = userIds.filter((id) => !memberIds.has(id));

        throw HTTP.Error(
          HttpStatus.FORBIDDEN,
          `These users are not in your class: ${notInClass.join(", ")}`,
        );
      }

      // Composite PK (userId, date) makes this a single atomic upsert: existing
      // records for that day are updated instead of duplicated.
      const marked = await db
        .insert(attendance)
        .values(
          records.map((record) => ({
            userId: record.userId,
            date,
            status: record.status,
            markedBy: teacher.userId,
          })),
        )
        .onConflictDoUpdate({
          target: [attendance.userId, attendance.date],
          set: {
            status: sql`excluded.status`,
            markedBy: sql`excluded.marked_by`,
          },
        })
        .returning();

      return c.json(
        HTTP.Response(HttpPhrase.OK, {
          teamId,
          date,
          count: marked.length,
          attendance: marked,
        }),
        HttpStatus.OK,
      );
    },
  )
  // Get the class(es) the logged-in TEACHER is in charge of, with students
  .get(
    "/classes",
    verifyPermission([USER_ROLE.TEACHER]),
    zValidator("query", classQuerySchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { date } = c.req.valid("query");
      const teacher = c.get("user");

      // TEACHERs always belong to an organization, and their scope is the
      // teams they lead — no separate user/org lookup needed.
      const ledTeams = await db
        .select({ id: team.id, name: team.name })
        .from(team)
        .where(eq(team.leaderId, teacher.userId))
        .orderBy(team.name);

      if (ledTeams.length === 0) {
        return c.json(
          HTTP.Response(HttpPhrase.OK, { classes: [] }),
          HttpStatus.OK,
        );
      }

      const members = await db
        .select({
          teamId: teamMember.teamId,
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(
          inArray(
            teamMember.teamId,
            ledTeams.map((ledTeam) => ledTeam.id),
          ),
        )
        .orderBy(user.name);

      // Optionally include the status already marked for this class on `date`.
      const statusByStudent = new Map<
        string,
        {
          status: (typeof ATTENDANCE_STATUSES)[keyof typeof ATTENDANCE_STATUSES];
          markedBy: string | null;
        }
      >();

      if (date && members.length > 0) {
        const marked = await db
          .select({
            userId: attendance.userId,
            status: attendance.status,
            markedBy: attendance.markedBy,
          })
          .from(attendance)
          .where(
            and(
              eq(attendance.date, date),
              inArray(
                attendance.userId,
                members.map((member) => member.id),
              ),
            ),
          );

        for (const row of marked) {
          statusByStudent.set(row.userId, {
            status: row.status,
            markedBy: row.markedBy,
          });
        }
      }

      const classes = ledTeams.map((ledTeam) => ({
        ...ledTeam,
        students: members
          .filter((member) => member.teamId === ledTeam.id)
          .map(({ teamId: _, ...student }) => ({
            ...student,
            status: statusByStudent.get(student.id)?.status ?? null,
            markedBy: statusByStudent.get(student.id)?.markedBy ?? null,
          })),
      }));

      return c.json(
        HTTP.Response(HttpPhrase.OK, { date: date ?? null, classes }),
        HttpStatus.OK,
      );
    },
  )
  // Get one user's attendance
  .get(
    "/users/:userId",
    zValidator("param", userAttendanceParamSchema),
    zValidator("query", attendanceQuerySchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const { userId } = c.req.valid("param");
      const { from, to, limit, offset } = c.req.valid("query");
      const requester = c.get("user");

      const [targetUser] = await db
        .select({
          id: user.id,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!targetUser) {
        throw HTTP.Error(HttpStatus.NOT_FOUND, "User not found");
      }

      // Anyone can read their own attendance. ADMINs can read anyone's,
      // principals can read anyone in their organization, and a TEACHER (class
      // in-charge) can only read members of the team(s) they lead.
      if (requester.userId !== userId && requester.role !== USER_ROLE.ADMIN) {
        const [requesterRecord] = await db
          .select({ organizationId: user.organizationId })
          .from(user)
          .where(eq(user.id, requester.userId))
          .limit(1);

        const organizationId = requesterRecord?.organizationId;

        const sameOrganization =
          organizationId != null &&
          organizationId === targetUser.organizationId;

        let canViewOthers =
          requester.role === USER_ROLE.PRINCIPAL && sameOrganization;

        if (
          !canViewOthers &&
          requester.role === USER_ROLE.TEACHER &&
          organizationId != null &&
          sameOrganization
        ) {
          const ledTeamIds = await findLedTeamIds(
            db,
            requester.userId,
            organizationId,
          );

          if (ledTeamIds.length > 0) {
            const [membership] = await db
              .select({ userId: teamMember.userId })
              .from(teamMember)
              .where(
                and(
                  eq(teamMember.userId, userId),
                  inArray(teamMember.teamId, ledTeamIds),
                ),
              )
              .limit(1);

            canViewOthers = !!membership;
          }
        }

        if (!canViewOthers) {
          throw HTTP.Error(
            HttpStatus.FORBIDDEN,
            "You are not allowed to view this user's attendance",
          );
        }
      }

      const conditions = [eq(attendance.userId, userId)];

      if (from) {
        conditions.push(gte(attendance.date, from));
      }

      if (to) {
        conditions.push(lte(attendance.date, to));
      }

      const where = and(...conditions);

      const [statusCounts, records] = await Promise.all([
        db
          .select({
            status: attendance.status,
            total: sql<number>`count(*)::int`,
          })
          .from(attendance)
          .where(where)
          .groupBy(attendance.status),
        db
          .select({
            date: attendance.date,
            status: attendance.status,
            markedBy: attendance.markedBy,
          })
          .from(attendance)
          .where(where)
          .orderBy(desc(attendance.date))
          .limit(limit)
          .offset(offset),
      ]);

      const summary = {
        total: 0,
        present: 0,
        absent: 0,
        leave: 0,
      };

      for (const row of statusCounts) {
        summary.total += row.total;

        if (row.status === ATTENDANCE_STATUSES.PRESENT) {
          summary.present = row.total;
        } else if (row.status === ATTENDANCE_STATUSES.ABSENT) {
          summary.absent = row.total;
        } else if (row.status === ATTENDANCE_STATUSES.LEAVE) {
          summary.leave = row.total;
        }
      }

      return c.json(
        HTTP.Response(HttpPhrase.OK, {
          user: targetUser,
          range: { from: from ?? null, to: to ?? null },
          pagination: { total: summary.total, limit, offset },
          summary,
          records,
        }),
        HttpStatus.OK,
      );
    },
  );
