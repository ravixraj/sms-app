import {
  ATTENDANCE_STATUSES,
  BG,
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
  jsonb,
  integer,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", USER_ROLE);
export const genderEnum = pgEnum("gender", GENDER);
export const bgEnum = pgEnum("bg", BG);

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
};

export const user = pgTable(
  "user",
  {
    id: uuid("id")
      .default(sql`uuidv7()`)
      .primaryKey(),
    orgid: uuid("orgid").references(() => org.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    password: text("password").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull(),
    avatar: text("avatar"),
    gender: genderEnum("gender").notNull(),
    dob: date("dob", { mode: "date" }),
    bg: bgEnum("bg").notNull(),
    address: text("address"),
    refreshToken: text("refresh_token"),
    ...timestamps,
  },
  (t) => [
    unique("user_org_id_unique").on(t.orgid, t.id),
    check(
      "user_org_role_check",
      sql`(
      ${t.role} = 'ADMIN' AND ${t.orgid} IS NULL)
      OR
      (${t.role} <> 'ADMIN' AND ${t.orgid} IS NOT NULL)`,
    ),
  ],
);

export const org = pgTable("org", {
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
    orgid: uuid("orgid")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    leaderId: uuid("leader_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [
    index("team_leaderId_idx").on(t.leaderId),
    unique("team_org_name_unique").on(t.orgid, t.name),
    foreignKey({
      name: "team_org_leader_fk",
      columns: [t.orgid, t.leaderId],
      foreignColumns: [user.orgid, user.id],
    }).onDelete("restrict"),
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
    createdAt: timestamps.createdAt,
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
    status: attendanceStatusEnum("status").notNull(),
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
    orgid: uuid("orgid")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull(),
    status: leaveStatusEnum("status").notNull().default("PENDING"),
    createdAt: date("created_at", { mode: "date" }).defaultNow(),
    reviewedAt: date("reviewed_at", { mode: "date" }),
  },
  (t) => [
    index("leave_userId_idx").on(t.userId),
    index("leave_org_status_idx").on(t.orgid, t.status), // speeds up org-scoped leave queries
    check("leave_date_range_check", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

const subject = [
  "MATHS",
  "SCIENCE",
  "ENGLISH",
  "HINDI",
  "SOCIAL_STUDIES",
  "COMPUTER_SCIENCE",
  "PHYSICAL_EDUCATION",
  "ARTS",
  "MUSIC",
  "OTHER",
] as const;

export type ReportCardSubject = {
  subject: (typeof subject)[number];
  maxMarks: number;
  obtainedMarks: number | null;
  isAbsent?: boolean;
  result: "PASS" | "FAIL";
};

export const result = pgTable(
  "report_card",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orgid: uuid("orgid")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    academicYear: integer("academic_year").notNull(),
    subjects: jsonb("subjects").$type<ReportCardSubject[]>().notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.orgid, t.userId, t.year],
    }),
  ],
);

export const relations = defineRelations(
  { user, org, team, teamMember, attendance, leave },
  (r) => ({
    user: {
      org: r.one.org({
        from: r.user.orgid,
        to: r.org.id,
        optional: true,
      }),
      teamMember: r.one.teamMember({
        from: r.user.id,
        to: r.teamMember.userId,
        optional: true,
      }),
      ledTeams: r.many.team(),
      attendanceRecords: r.many.attendance({
        alias: "attendance_user",
      }),
      markedAttendances: r.many.attendance({
        alias: "attendance_marker",
      }),
      leaveRequests: r.many.leave(),
    },
    org: {
      users: r.many.user(),
      teams: r.many.team(),
      leaves: r.many.leave(),
    },
    team: {
      org: r.one.org({
        from: r.team.orgid,
        to: r.org.id,
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
        optional: false,
      }),
      org: r.one.org({
        from: r.leave.orgid,
        to: r.org.id,
        optional: false,
      }),
    },
  }),
);
