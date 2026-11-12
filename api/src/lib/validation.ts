import { ATTENDANCE_STATUSES, BLOOD_GROUP, GENDER, USER_ROLE } from "#const";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

export const nameSchema = z.string().trim().min(2).max(50);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const dobSchema = z.coerce.date().refine((date) => date <= new Date(), {
  error: "Date of birth cannot be in the future",
});

export const organizationIdSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.uuid().nullish(),
);

export const avatarSchema = z.preprocess(
  (value) => (value instanceof File && value.size === 0 ? undefined : value),
  z.instanceof(File).optional(),
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

export const teamIdSchema = z.uuid({ error: "Invalid team id" });

export const userIdSchema = z.uuid({ error: "Invalid user id" });

// ---------------------------------------------------------------------------
// User schemas
// ---------------------------------------------------------------------------

export const profileFields = {
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  avatar: avatarSchema,
  gender: z.enum(GENDER),
  bloodGroup: z.enum(BLOOD_GROUP),
  dob: dobSchema,
  address: z.string().trim().min(1, { error: "Address is required" }),
};

export const createUserSchema = z
  .object({
    ...profileFields,
    password: strongPassword,
    role: z.enum(USER_ROLE).default(USER_ROLE.STUDENT),
    organizationId: organizationIdSchema,
  })
  .refine(
    ({ role, organizationId }) =>
      role === USER_ROLE.ADMIN
        ? organizationId == null
        : organizationId != null,
    {
      error:
        "ADMIN cannot belong to an organization, and other roles require one",
      path: ["organizationId"],
    },
  );

export const updateProfileSchema = z
  .object(profileFields)
  .omit({ email: true })
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    error: "At least one field is required",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Password is required" }),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { error: "Refresh token is required" }),
});

// ---------------------------------------------------------------------------
// Organization & team schemas
// ---------------------------------------------------------------------------

export const createOrganizationSchema = z.object({
  name: nameSchema,
  metadata: z.string().nullish(),
});

export const organizationIdParamSchema = z.object({
  organizationId: z.uuid({ error: "Invalid organization id" }),
});

export const createTeamSchema = z.object({
  name: nameSchema,
  leaderId: z.uuid({ error: "Invalid leader id" }),
});

export const organizationTeamParamSchema = organizationIdParamSchema.extend({
  teamId: z.uuid({ error: "Invalid team id" }),
});

export const addTeamMemberSchema = z.object({
  userId: z.uuid({ error: "Invalid user id" }),
});

export const teamMemberParamSchema = organizationTeamParamSchema.extend({
  userId: z.uuid({ error: "Invalid user id" }),
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
    )
    .min(1, { error: "At least one attendance record is required" })
    .max(200, { error: "Cannot mark more than 200 users at once" })
    .refine(
      (records) =>
        new Set(records.map((record) => record.userId)).size === records.length,
      { error: "Duplicate userId entries are not allowed" },
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
    limit: z.coerce.number().int().min(1).max(366).default(31),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: "'from' must be on or before 'to'",
    path: ["from"],
  });
