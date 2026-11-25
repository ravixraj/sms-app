import {
  ATTENDANCE_STATUSES,
  USER_ROLE,
  schoolDate,
  ok,
  HTTPStatus,
} from "#const";
import {
  attendanceQuerySchema,
  attendanceClassQuerySchema,
  markAttendanceSchema,
} from "#validation";
import { attendance, team, teamMember, user } from "#db/schema";
import { zValidator } from "#middleware/zValidator";
import { authMw, verifyPermission, type AuthEnv } from "#middleware/auth";
import { bodyLimitMw } from "#middleware/bodyLimit";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

export default new Hono<AuthEnv>()
  .use(authMw)
  .post(
    "/",
    bodyLimitMw(16 * 1024),
    verifyPermission(USER_ROLE.TEACHER),
    zValidator("json", markAttendanceSchema),
    async (c) => {
      const db = c.get("db");
      const { teamId, date, records } = c.req.valid("json");
      const teacherId = c.get("user").userId;
      const teacher = await db.query.user.findFirst({
        where: { id: teacherId, role: USER_ROLE.TEACHER },
        columns: { orgid: true },
      });
      if (!teacher?.orgid)
        throw new HTTPException(HTTPStatus.FORBIDDEN, {
          message: "No school assigned to your account",
        });

      // Membership, leadership and school scope are checked together; member role is irrelevant.
      const userIds = records.map((record) => record.userId);
      const eligible = await db
        .select({ userId: teamMember.userId })
        .from(teamMember)
        .innerJoin(team, eq(team.id, teamMember.teamId))
        .innerJoin(user, eq(user.id, teamMember.userId))
        .where(
          and(
            eq(team.id, teamId),
            eq(team.leaderId, teacherId),
            eq(team.orgid, teacher.orgid),
            eq(user.orgid, teacher.orgid),
            inArray(teamMember.userId, userIds),
          ),
        );
      if (eligible.length !== records.length) {
        throw new HTTPException(HTTPStatus.FORBIDDEN, {
          message: "Every user must belong to a team you lead in your school",
        });
      }

      const marked = await db
        .insert(attendance)
        .values(
          records.map((record) => ({ ...record, date, markedBy: teacherId })),
        )
        .onConflictDoUpdate({
          target: [attendance.userId, attendance.date],
          set: {
            status: sql`excluded.status`,
            markedBy: sql`excluded.marked_by`,
          },
        })
        .returning({ userId: attendance.userId, status: attendance.status });
      return c.json(ok({ attendance: marked }), HTTPStatus.OK);
    },
  )
  // The roster is fetched from org/team/member; this endpoint returns only saved marks.
  .get(
    "/classes",
    verifyPermission(USER_ROLE.TEACHER),
    zValidator("query", attendanceClassQuerySchema),
    async (c) => {
      const db = c.get("db");
      const { date = schoolDate(), teamId } = c.req.valid("query");
      const teacherId = c.get("user").userId;
      const teacher = await db.query.user.findFirst({
        where: { id: teacherId, role: USER_ROLE.TEACHER },
        columns: { orgid: true },
      });
      if (!teacher?.orgid)
        throw new HTTPException(HTTPStatus.FORBIDDEN, {
          message: "No school assigned to your account",
        });
      const records = await db
        .select({ userId: attendance.userId, status: attendance.status })
        .from(attendance)
        .innerJoin(teamMember, eq(teamMember.userId, attendance.userId))
        .innerJoin(team, eq(team.id, teamMember.teamId))
        .innerJoin(user, eq(user.id, teamMember.userId))
        .where(
          and(
            eq(attendance.date, date),
            eq(team.leaderId, teacherId),
            eq(team.orgid, teacher.orgid),
            eq(user.orgid, teacher.orgid),
            teamId ? eq(team.id, teamId) : undefined,
          ),
        );
      return c.json(ok({ date, records }), HTTPStatus.OK);
    },
  )
  .get(
    "/me",
    verifyPermission([USER_ROLE.STUDENT, USER_ROLE.TEACHER]),
    zValidator("query", attendanceQuerySchema),
    async (c) => {
      const db = c.get("db");
      const {
        from,
        to,
        limit,
        offset,
        summary: includeSummary,
      } = c.req.valid("query");
      const userId = c.get("user").userId;

      const where = and(
        eq(attendance.userId, userId),
        from ? gte(attendance.date, from) : undefined,
        to ? lte(attendance.date, to) : undefined,
      );
      const [counts, page] = await Promise.all([
        includeSummary === "true"
          ? db
              .select({
                status: attendance.status,
                total: sql<number>`count(*)::int`,
              })
              .from(attendance)
              .where(where)
              .groupBy(attendance.status)
          : Promise.resolve(null),
        db
          .select({ date: attendance.date, status: attendance.status })
          .from(attendance)
          .where(where)
          .orderBy(desc(attendance.date))
          .limit(limit + 1)
          .offset(offset),
      ]);
      const summary = counts
        ? { total: 0, present: 0, absent: 0, leave: 0 }
        : null;
      if (summary && counts) {
        for (const row of counts) {
          summary.total += row.total;
          if (row.status === ATTENDANCE_STATUSES.PRESENT)
            summary.present = row.total;
          else if (row.status === ATTENDANCE_STATUSES.ABSENT)
            summary.absent = row.total;
          else if (row.status === ATTENDANCE_STATUSES.LEAVE)
            summary.leave = row.total;
        }
      }
      return c.json(
        ok({
          summary,
          pagination: { limit, offset, hasMore: page.length > limit },
          records: page.slice(0, limit),
        }),
        HTTPStatus.OK,
      );
    },
  );
