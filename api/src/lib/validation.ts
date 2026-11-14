import { ATTENDANCE_STATUSES, BLOOD_GROUP, GENDER, USER_ROLE } from "#const";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

export const nameSchema = z
  .string({ error: "Name must be text" })
  .trim()
  .min(2, { error: "Name must be at least 2 characters long" })
  .max(50, { error: "Name must be at most 50 characters long" });

export const profileNameSchema = z
  .string({ error: "Name must be text" })
  .trim()
  .min(2, { error: "Name must be at least 2 characters long" })
  .max(100, { error: "Name must be at most 100 characters long" });

export const emailSchema = z
  .string({ error: "Email must be text" })
  .trim()
  .max(254, { error: "Email must be at most 254 characters long" })
  .toLowerCase()
  .pipe(z.email({ error: "Invalid email address" }));

export const organizationIdSchema = z.uuid({
  error: "Invalid organization id",
});

export const nullableOrganizationIdSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.uuid({ error: "Invalid organization id" }).nullish(),
);

export const teamIdSchema = z.uuid({ error: "Invalid team id" });
export const userIdSchema = z.uuid({ error: "Invalid user id" });
export const leaderIdSchema = z.uuid({ error: "Invalid leader id" });

export const avatarSchema = z.preprocess(
  (value) => (value instanceof File && value.size === 0 ? undefined : value),
  z
    .instanceof(File, { error: "Avatar must be an uploaded file" })
    .refine((file) => file.size <= 100 * 1024, {
      error: "Avatar must be at most 100 KB",
    })
    .optional(),
);

export const strongPassword = z
  .string()
  .min(8, { error: "Password must be at least 8 characters long" })
  .max(50, { error: "Password must be at most 50 characters long" })
  .regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[#?!@$%^&*-]).+$/, {
    error:
      "Password must contain at least one uppercase letter, one lowercase letter, number and one special character.",
  });

export const dateSchema = z.iso.date({
  error: "Date must be a valid date in YYYY-MM-DD format",
});

// ---------------------------------------------------------------------------
// User schemas
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  name: profileNameSchema,
  email: emailSchema,
  avatar: avatarSchema,
  gender: z.enum(GENDER, { error: "Gender must be MALE, FEMALE, or OTHER" }),
  bloodGroup: z.enum(BLOOD_GROUP, { error: "Invalid blood group" }),
  dob: z.iso
    .date({ error: "Date of birth must be a valid YYYY-MM-DD date" })
    .transform((date) => new Date(`${date}T00:00:00Z`))
    .refine((date) => date <= new Date(), {
      error: "Date of birth cannot be in the future",
    }),
  address: z
    .string({ error: "Address must be text" })
    .trim()
    .min(1, { error: "Address is required" })
    .max(1000, { error: "Address must be at most 1000 characters long" }),
});

export const createUserSchema = profileSchema
  .extend({
    password: strongPassword,
    role: z
      .enum(USER_ROLE, { error: "Invalid role" })
      .default(USER_ROLE.STUDENT),
    organizationId: nullableOrganizationIdSchema,
  })
  .refine(
    ({ role, organizationId }) =>
      role === USER_ROLE.ADMIN || organizationId != null,
    {
      // An admin's organizationId is ignored and stored as null by the route.
      error: "Non-admin users must belong to an organization",
      path: ["organizationId"],
    },
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: strongPassword,
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: "Refresh token must be text" })
    .min(1, { error: "Refresh token is required" })
    .max(4096, { error: "Refresh token is too long" }),
});

// ---------------------------------------------------------------------------
// Organization & team schemas
// ---------------------------------------------------------------------------

export const createOrganizationSchema = z.object({
  name: nameSchema,
  metadata: z
    .string({ error: "Metadata must be text" })
    .max(2000, { error: "Metadata must be at most 2000 characters long" })
    .nullish(),
});

export const deleteOrganizationSchema = z.object({
  organizationId: organizationIdSchema,
});

export const createTeamSchema = z.object({
  organizationId: organizationIdSchema,
  name: nameSchema,
  leaderId: leaderIdSchema,
});

export const updateTeamSchema = z
  .object({
    organizationId: organizationIdSchema,
    teamId: teamIdSchema,
    name: nameSchema.optional(),
    leaderId: leaderIdSchema.optional(),
  })
  .refine(
    ({ name, leaderId }) => name !== undefined || leaderId !== undefined,
    {
      error: "At least one of name or leaderId is required",
    },
  );

export const teamMembersQuerySchema = z.object({
  organizationId: organizationIdSchema,
  teamId: teamIdSchema,
});

export const addTeamMemberSchema = z.object({
  teamId: teamIdSchema,
  userId: userIdSchema,
});

export const teamMemberParamSchema = z.object({
  userId: userIdSchema,
});

export const deleteTeamMemberSchema = z.object({
  organizationId: organizationIdSchema,
});

// ---------------------------------------------------------------------------
// Attendance schemas
// ---------------------------------------------------------------------------

export const markAttendanceDateSchema = dateSchema.refine(
  (date) => date <= new Date().toISOString().slice(0, 10),
  { error: "Attendance cannot be marked for a future date" },
);

export const markAttendanceSchema = z.object({
  teamId: teamIdSchema,
  date: markAttendanceDateSchema,
  records: z
    .array(
      z.object({
        userId: userIdSchema,
        status: z.enum(ATTENDANCE_STATUSES, {
          error: "Invalid attendance status",
        }),
      }),
      { error: "Records must be an array" },
    )
    .min(1, { error: "At least one attendance record is required" })
    .max(200, { error: "Cannot mark more than 200 users at once" })
    .refine(
      (records) =>
        new Set(records.map((record) => record.userId)).size === records.length,
      { error: "Each user can appear only once in the records" },
    ),
});

export const userAttendanceParamSchema = z.object({
  userId: userIdSchema,
});

export const classQuerySchema = z.object({
  date: dateSchema.optional(),
});

export const attendanceQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    limit: z.coerce
      .number({ error: "Limit must be a number" })
      .int({ error: "Limit must be an integer" })
      .min(1, { error: "Limit must be at least 1" })
      .max(366, { error: "Limit must be at most 366" })
      .default(31),
    offset: z.coerce
      .number({ error: "Offset must be a number" })
      .int({ error: "Offset must be an integer" })
      .min(0, { error: "Offset must be 0 or greater" })
      .default(0),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: "'from' must be on or before 'to'",
    path: ["from"],
  });
