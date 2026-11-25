import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  BG,
  GENDER,
  LEAVE_STATUSES,
  USER_ROLE,
  schoolDate,
} from "#const";

// Shared building blocks

const uuidSchema = (message: string) => z.uuid(message);

export const entityNameSchema = z
  .string("Enter a valid name")
  .trim()
  .min(2, "Name must be at least 2 characters long")
  .max(50, "Name must be at most 50 characters long");

export const profileNameSchema = z
  .string("Enter a valid name")
  .trim()
  .min(2, "Name must be at least 2 characters long")
  .max(100, "Name must be at most 100 characters long");

export const emailSchema = z
  .string("Enter a valid email address")
  .trim()
  .min(1, "Email is required")
  .max(254, "Email must be at most 254 characters long")
  .toLowerCase()
  .pipe(z.email("Invalid email address"));

export const avatarSchema = z.preprocess(
  (value) => (value instanceof File && value.size === 0 ? undefined : value),
  z
    .instanceof(File, { error: "Avatar must be an uploaded file" })
    .refine((file) => file.size <= 100 * 1024, "Avatar must be at most 100 KB")
    .refine((file) => file.type === "image/webp", "Avatar must be a WebP image")
    .optional(),
);

export const dateSchema = z.iso.date(
  "Date must be a valid date in YYYY-MM-DD format",
);

// User schemas

export const profileSchema = z.object({
  name: profileNameSchema,
  email: emailSchema,
  avatar: avatarSchema,
  gender: z.enum(GENDER, "Gender must be MALE, FEMALE, or OTHER"),
  bg: z.enum(BG, "Invalid blood group"),
  dob: z.iso
    .date("Date of birth must be a valid YYYY-MM-DD date")
    .refine(
      (date) => date <= schoolDate(),
      "Date of birth cannot be in the future",
    )
    .transform((date) => new Date(`${date}T00:00:00Z`)),
  address: z
    .string("Enter a valid address")
    .trim()
    .min(1, "Address is required")
    .max(1000, "Address must be at most 1000 characters long"),
});

export const createUserSchema = profileSchema
  .extend({
    password: z
      .string("Enter a valid password")
      .min(8, "Password must be at least 8 characters long")
      .max(50, "Password must be at most 50 characters long")
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[#?!@$%^&*-]).+$/,
        "Password must contain at least one uppercase letter, one lowercase letter, number and one special character.",
      ),
    role: z.enum(USER_ROLE, "Invalid role"),
    orgid: z.preprocess(
      (value) => (value === "" ? null : value),
      uuidSchema("Invalid school id").nullish(),
    ),
  })
  .refine(({ role, orgid }) => role === USER_ROLE.ADMIN || orgid != null, {
    // An admin's orgid is ignored and stored as null by the route.
    error: "Non-admin users must belong to a school",
    path: ["orgid"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string("Enter a valid password")
    .min(1, "Password is required")
    .max(128, "Password must be at most 128 characters long"),
});

// Org & team schemas

export const orgSchema = z.object({
  name: entityNameSchema,
  metadata: z
    .string("Metadata must be text")
    .max(500, "Metadata must be at most 500 characters long")
    .nullish(),
});

export const deleteOrgSchema = z.object({
  orgid: uuidSchema("Invalid school id"),
});

export const createTeamSchema = z.object({
  orgid: uuidSchema("Invalid school id"),
  leaderId: uuidSchema("Invalid leader id"),
  name: entityNameSchema,
});

export const updateTeamSchema = z
  .object({
    orgid: uuidSchema("Invalid school id"),
    teamId: uuidSchema("Invalid team id"),
    name: entityNameSchema.optional(),
    leaderId: uuidSchema("Invalid leader id").optional(),
  })
  .refine(
    ({ name, leaderId }) => name !== undefined || leaderId !== undefined,
    "At least one of name or leaderId is required",
  );

export const addTeamMemberSchema = z.object({
  teamId: uuidSchema("Invalid team id"),
  userId: uuidSchema("Invalid user id"),
});

export const deleteTeamMemberSchema = z.object({
  teamId: uuidSchema("Invalid team id"),
  userId: uuidSchema("Invalid user id"),
  orgid: uuidSchema("Invalid school id"),
});

// Attendance schemas

export const markAttendanceDateSchema = dateSchema.refine(
  (date) => date <= schoolDate(),
  "Attendance cannot be marked for a future date",
);

export const markAttendanceSchema = z.object({
  teamId: uuidSchema("Invalid team id"),
  date: markAttendanceDateSchema,
  records: z
    .array(
      z.object({
        userId: uuidSchema("Invalid user id"),
        status: z.enum(ATTENDANCE_STATUSES, "Invalid attendance status"),
      }),
      "Records must be an array",
    )
    .min(1, "At least one attendance record is required")
    .max(200, "Cannot mark more than 200 users at once")
    .refine(
      (records) =>
        new Set(records.map((record) => record.userId)).size === records.length,
      "Each user can appear only once in the records",
    ),
});

export const attendanceClassQuerySchema = z.object({
  date: dateSchema.optional(),
  teamId: uuidSchema("Invalid team id").optional(),
});

export const attendanceQuerySchema = z
  .object({
    summary: z
      .enum(["true", "false"], "Summary must be true or false")
      .default("true"),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    limit: z.coerce
      .number("Limit must be a number")
      .int("Limit must be an integer")
      .min(1, "Limit must be at least 1")
      .max(366, "Limit must be at most 366")
      .default(31),
    offset: z.coerce
      .number("Offset must be a number")
      .int("Offset must be an integer")
      .min(0, "Offset must be 0 or greater")
      .default(0),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: "'from' must be on or before 'to'",
    path: ["from"],
  });

// Leave schemas

export const applyLeaveSchema = z
  .object({
    startDate: dateSchema,
    endDate: dateSchema,
    reason: z
      .string("Enter a valid reason")
      .trim()
      .min(1, "Reason is required")
      .max(1000, "Reason must be at most 1000 characters long"),
  })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    error: "End date must be on or after the start date",
    path: ["endDate"],
  });

export const leaveQuerySchema = z.object({
  status: z.enum(LEAVE_STATUSES, "Invalid leave status").optional(),
  limit: z.coerce
    .number("Limit must be a number")
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be at most 100")
    .default(50),
  offset: z.coerce
    .number("Offset must be a number")
    .int("Offset must be an integer")
    .min(0, "Offset must be 0 or greater")
    .default(0),
});

export const reviewLeaveSchema = z.object({
  leaveId: uuidSchema("Invalid leave id"),
  status: z.enum(
    [LEAVE_STATUSES.APPROVED, LEAVE_STATUSES.REJECTED],
    "Status must be APPROVED or REJECTED",
  ),
});
