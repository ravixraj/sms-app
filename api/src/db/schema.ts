import {
  ATTENDANCE_STATUSES,
  BLOOD_GROUP,
  GENDER,
  LEAVE_STATUSES,
  USER_ROLE,
} from "#const";
import { defineRelations, sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  boolean,
  index,
  primaryKey,
  date,
  check,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", USER_ROLE);
export const genderEnum = pgEnum("gender", GENDER);
export const bloodGroupEnum = pgEnum("blood_group", BLOOD_GROUP);

export const user = pgTable(
  "user",
  {
    id: uuid("id")
      .default(sql`uuidv7()`)
      .primaryKey(),
    organizationId: uuid("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    password: text("password").notNull(),
    role: userRoleEnum("role").notNull().default("STUDENT"),
    avatar: text("avatar"),
    gender: genderEnum("gender").notNull(),
    bloodGroup: bloodGroupEnum("blood_group").notNull(),
    dob: date("dob", { mode: "date" }),
    address: text("address"),
    refreshToken: text("refresh_token"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("user_organizationId_idx").on(t.organizationId),
    check(
      "user_organization_role_check",
      sql`(
      ${t.role} = 'ADMIN' AND ${t.organizationId} IS NULL) 
      OR 
      (${t.role} <> 'ADMIN' AND ${t.organizationId} IS NOT NULL)`,
    ),
  ],
);

export const organization = pgTable("organization", {
  id: uuid("id")
    .default(sql`uuidv7()`)
    .primaryKey(),
  name: text("name").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const team = pgTable(
  "team",
  {
    id: uuid("id")
      .default(sql`uuidv7()`)
      .primaryKey(),
    name: text("name").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    leaderId: uuid("leader_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("team_organizationId_idx").on(t.organizationId),
    index("team_leaderId_idx").on(t.leaderId), // speeds up "is user a team leader?" checks
  ],
);

export const teamMember = pgTable(
  "team_member",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const attendanceStatusEnum = pgEnum(
  "attendance_status",
  ATTENDANCE_STATUSES,
);
export const attendance = pgTable(
  "attendance",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("PRESENT"),
    markedBy: uuid("marked_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    index("attendance_date_idx").on(t.date), // speeds up date-range attendance queries
  ],
);

export const leaveStatusEnum = pgEnum("leave_status", LEAVE_STATUSES);
export const leave = pgTable(
  "leave",
  {
    id: uuid("id")
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull(),
    status: leaveStatusEnum("status").notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
  },
  (t) => [
    index("leave_userId_idx").on(t.userId),
    index("leave_organizationId_idx").on(t.organizationId), // speeds up org-scoped leave queries
    index("leave_status_idx").on(t.status),
    check("leave_date_range_check", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const relations = defineRelations(
  { user, organization, team, teamMember, attendance, leave },
  (r) => ({
    user: {
      organization: r.one.organization({
        from: r.user.organizationId,
        to: r.organization.id,
        optional: true,
      }),
      teamMember: r.one.teamMember({
        from: r.user.id,
        to: r.teamMember.userId,
        optional: false,
      }),
      attendanceRecords: r.many.attendance({
        alias: "attendance_user",
      }),
      markedAttendances: r.many.attendance({
        alias: "attendance_marker",
      }),
      leaveRequests: r.many.leave({
        alias: "leave_user",
      }),
      reviewedLeaves: r.many.leave({
        alias: "leave_reviewer",
      }),
    },
    organization: {
      users: r.many.user(),
      teams: r.many.team(),
      leaves: r.many.leave(),
    },
    team: {
      organization: r.one.organization({
        from: r.team.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      leader: r.one.user({
        from: r.team.leaderId,
        to: r.user.id,
        optional: false,
      }),
      teamMembers: r.many.teamMember(),
    },
    teamMember: {
      team: r.one.team({
        from: r.teamMember.teamId,
        to: r.team.id,
        optional: false,
      }),
      user: r.one.user({
        from: r.teamMember.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    attendance: {
      user: r.one.user({
        from: r.attendance.userId,
        to: r.user.id,
        alias: "attendance_user",
        optional: false,
      }),
      marker: r.one.user({
        from: r.attendance.markedBy,
        to: r.user.id,
        alias: "attendance_marker",
      }),
    },
    leave: {
      user: r.one.user({
        from: r.leave.userId,
        to: r.user.id,
        alias: "leave_user",
        optional: false,
      }),
      organization: r.one.organization({
        from: r.leave.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      reviewer: r.one.user({
        from: r.leave.reviewedBy,
        to: r.user.id,
        alias: "leave_reviewer",
      }),
    },
  }),
);
