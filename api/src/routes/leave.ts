import {
  LEAVE_STATUSES,
  USER_ROLE,
  ok,
  HTTPStatus,
  type UserRole,
} from "#const";
import {
  applyLeaveSchema,
  leaveQuerySchema,
  reviewLeaveSchema,
} from "#validation";
import { leave, user } from "#db/schema";
import { zValidator } from "#middleware/zValidator";
import { authMw, verifyPermission, type AuthEnv } from "#middleware/auth";
import { bodyLimitMw } from "#middleware/bodyLimit";
import type { Db } from "#middleware/db";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Read the school from the database rather than the JWT, so a stale token
 * cannot scope a request to a school the user no longer belongs to.
 */
const requireOrgId = async (
  db: Db,
  userId: string,
  role: UserRole,
): Promise<string> => {
  const account = await db.query.user.findFirst({
    where: { id: userId, role },
    columns: { orgid: true },
  });

  if (!account?.orgid) {
    throw new HTTPException(HTTPStatus.FORBIDDEN, {
      message: "No school assigned to your account",
    });
  }

  return account.orgid;
};

/** One projection for every leave response, so timestamps never go missing. */
const leaveFields = {
  id: leave.id,
  startDate: leave.startDate,
  endDate: leave.endDate,
  reason: leave.reason,
  status: leave.status,
  createdAt: leave.createdAt,
  reviewedAt: leave.reviewedAt,
} as const;

const countLeaves = async (db: Db, where: SQL | undefined) => {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leave)
    .where(where);
  return row?.total ?? 0;
};

/** A failed update means either "not yours" or "already reviewed". */
const throwReviewError = async (
  db: Db,
  leaveId: string,
  orgid: string,
): Promise<never> => {
  const existing = await db.query.leave.findFirst({
    where: { id: leaveId },
    columns: { orgid: true, status: true },
  });

  if (!existing || existing.orgid !== orgid) {
    throw new HTTPException(HTTPStatus.NOT_FOUND, {
      message: "Leave request not found",
    });
  }

  throw new HTTPException(HTTPStatus.CONFLICT, {
    message: "Leave request has already been reviewed",
  });
};

export default new Hono<AuthEnv>()
  .use(authMw)
  // Review (approve/reject) a leave request — PRINCIPAL
  .patch(
    "/review",
    bodyLimitMw(2 * 1024),
    verifyPermission([USER_ROLE.PRINCIPAL]),
    zValidator("json", reviewLeaveSchema),
    async (c) => {
      const db = c.get("db");
      const principal = c.get("user");
      const { leaveId, status } = c.req.valid("json");

      const orgid = await requireOrgId(
        db,
        principal.userId,
        USER_ROLE.PRINCIPAL,
      );

      // The PENDING guard makes the review a one-time transition, so
      // reviewedAt is stamped exactly once and cannot be overwritten.
      const [updated] = await db
        .update(leave)
        .set({ status, reviewedAt: new Date() })
        .where(
          and(
            eq(leave.id, leaveId),
            eq(leave.orgid, orgid),
            eq(leave.status, LEAVE_STATUSES.PENDING),
          ),
        )
        .returning(leaveFields);

      if (!updated) await throwReviewError(db, leaveId, orgid);

      return c.json(ok({ leave: updated }), HTTPStatus.OK);
    },
  )
  // List leave requests in the org — PRINCIPAL
  .get(
    "/",
    verifyPermission([USER_ROLE.PRINCIPAL]),
    zValidator("query", leaveQuerySchema),
    async (c) => {
      const db = c.get("db");
      const principal = c.get("user");
      const { status, limit, offset } = c.req.valid("query");

      const orgid = await requireOrgId(
        db,
        principal.userId,
        USER_ROLE.PRINCIPAL,
      );

      const conditions = [eq(leave.orgid, orgid)];
      if (status) conditions.push(eq(leave.status, status));
      const where = and(...conditions);

      const [total, records] = await Promise.all([
        countLeaves(db, where),
        db
          .select({
            ...leaveFields,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
          })
          .from(leave)
          .innerJoin(user, eq(leave.userId, user.id))
          .where(where)
          .orderBy(desc(leave.createdAt), desc(leave.id))
          .limit(limit)
          .offset(offset),
      ]);

      return c.json(
        ok({
          leaves: records,
          pagination: { total, limit, offset },
        }),
        HTTPStatus.OK,
      );
    },
  )
  // Apply for leave — STUDENT, TEACHER
  .post(
    "/",
    bodyLimitMw(8 * 1024),
    verifyPermission([USER_ROLE.STUDENT, USER_ROLE.TEACHER]),
    zValidator("json", applyLeaveSchema),
    async (c) => {
      const db = c.get("db");
      const requester = c.get("user");
      const { startDate, endDate, reason } = c.req.valid("json");

      const orgid = await requireOrgId(db, requester.userId, requester.role);

      const [created] = await db
        .insert(leave)
        .values({
          userId: requester.userId,
          orgid,
          startDate,
          endDate,
          reason,
        })
        .returning(leaveFields);

      if (!created) {
        throw new HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, {
          message: "Failed to create leave request",
        });
      }

      return c.json(ok({ leave: created }), HTTPStatus.CREATED);
    },
  )
  // List the signed-in user's own leave requests — STUDENT, TEACHER
  .get(
    "/me",
    verifyPermission([USER_ROLE.STUDENT, USER_ROLE.TEACHER]),
    zValidator("query", leaveQuerySchema),
    async (c) => {
      const db = c.get("db");
      const requester = c.get("user");
      const { status, limit, offset } = c.req.valid("query");

      const conditions = [eq(leave.userId, requester.userId)];
      if (status) conditions.push(eq(leave.status, status));
      const where = and(...conditions);

      const [total, records] = await Promise.all([
        countLeaves(db, where),
        db
          .select(leaveFields)
          .from(leave)
          .where(where)
          .orderBy(desc(leave.createdAt), desc(leave.id))
          .limit(limit)
          .offset(offset),
      ]);

      return c.json(
        ok({
          leaves: records,
          pagination: { total, limit, offset },
        }),
        HTTPStatus.OK,
      );
    },
  );
