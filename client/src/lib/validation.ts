import { today } from "@internationalized/date";
import { z } from "zod";

const nameSchema = z
  .string("Enter a valid name")
  .trim()
  .min(2, "Name must be at least 2 characters long")
  .max(50, "Name must be at most 50 characters long");

const profileNameSchema = z
  .string("Enter a valid name")
  .trim()
  .min(2, "Name must be at least 2 characters long")
  .max(100, "Name must be at most 100 characters long");

const emailSchema = z
  .string("Enter a valid email address")
  .trim()
  .min(1, "Email is required")
  .max(254, "Email must be at most 254 characters long")
  .toLowerCase()
  .pipe(z.email("Invalid email address"));

const uuidSchema = (message: string) => z.uuid(message);

// All schools use India time. The server date is authoritative; the local
// clock is only a fallback before sign-in or while offline.
let serverDate: string | null = null;

export function setAuthoritativeDate(date: string) {
  serverDate = date || null;
}

export const schoolDate = () => serverDate ?? today("Asia/Kolkata").toString();

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string("Enter a valid password")
    .min(1, "Password is required")
    .max(128, "Password must be at most 128 characters long"),
});

export const orgSchema = z.object({
  name: nameSchema,
  metadata: z
    .string("Metadata must be text")
    .max(500, "Metadata must be at most 500 characters long")
    .nullish(),
});

export const deleteOrgSchema = z.object({
  orgid: uuidSchema("Invalid org id"),
});

export const createUserSchema = z
  .object({
    name: profileNameSchema,
    email: emailSchema,
    password: z
      .string("Enter a valid password")
      .min(8, "Password must be at least 8 characters long")
      .max(50, "Password must be at most 50 characters long")
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[#?!@$%^&*-]).+$/,
        "Password must contain at least one uppercase letter, one lowercase letter, number and one special character.",
      ),
    role: z.enum(["STUDENT", "TEACHER", "PRINCIPAL", "ADMIN"], "Invalid role"),
    // An admin's orgid is ignored and stored as null by the API.
    orgid: z.union([z.literal(""), uuidSchema("Invalid org id"), z.null()]),
    gender: z.enum(
      ["MALE", "FEMALE", "OTHER"],
      "Gender must be MALE, FEMALE, or OTHER",
    ),
    bg: z.enum(
      ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      "Invalid blood group",
    ),
    dob: z.iso
      .date("Date of birth must be a valid YYYY-MM-DD date")
      .refine(
        (date) => date <= schoolDate(),
        "Date of birth cannot be in the future",
      ),
    address: z
      .string("Enter a valid address")
      .trim()
      .min(1, "Address is required")
      .max(1000, "Address must be at most 1000 characters long"),
    avatar: z.preprocess(
      (value) =>
        value instanceof File && value.size === 0 ? undefined : value,
      z
        .instanceof(File, { error: "Avatar must be an uploaded file" })
        .refine(
          (file) => file.size <= 100 * 1024,
          "Avatar must be at most 100 KB",
        )
        .optional(),
    ),
  })
  .refine(({ role, orgid }) => role === "ADMIN" || !!orgid, {
    error: "Non-admin users must belong to an org",
    path: ["orgid"],
  });

export const createTeamSchema = z.object({
  orgid: uuidSchema("Invalid org id"),
  leaderId: uuidSchema("Invalid leader id"),
  name: nameSchema,
});

export const updateTeamSchema = z
  .object({
    orgid: uuidSchema("Invalid org id"),
    teamId: uuidSchema("Invalid team id"),
    name: nameSchema.optional(),
    leaderId: uuidSchema("Invalid leader id").optional(),
  })
  .refine(
    ({ name, leaderId }) => name !== undefined || leaderId !== undefined,
    {
      error: "At least one of name or leaderId is required",
    },
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

export const applyLeaveSchema = z
  .object({
    startDate: z.iso.date(
      "Start date must be a valid date in YYYY-MM-DD format",
    ),
    endDate: z.iso.date("End date must be a valid date in YYYY-MM-DD format"),
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

export const leaveStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;

export const leaveQuerySchema = z.object({
  status: z.enum(leaveStatuses, "Invalid leave status").optional(),
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
