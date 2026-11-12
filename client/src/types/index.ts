export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE";

export type UserRole =
  "ADMIN" | "STUDENT" | "TEACHER" | "PRINCIPAL" | "ACCOUNTANT";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export type BloodGroup =
  "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export interface Organization {
  id: string;
  name: string;
  metadata?: string | null;
  createdAt?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  status: AttendanceStatus | null;
  markedBy: string | null;
}

export interface ClassData {
  id: string;
  name: string;
  students: Student[];
}

export interface ClassesResponse {
  date: string | null;
  classes: ClassData[];
}

export interface AttendanceRecord {
  date: string;
  status: AttendanceStatus;
  markedBy: string | null;
}

export interface UserAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  leave: number;
}

export interface UserAttendanceResponse {
  user: {
    id: string;
    name: string;
    role: UserRole;
    organizationId: string | null;
  };
  range: { from: string | null; to: string | null };
  pagination: { total: number; limit: number; offset: number };
  summary: UserAttendanceSummary;
  records: AttendanceRecord[];
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
  leaderId: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  team?: Team | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  avatar: string | null;
  gender: Gender;
  bloodGroup: BloodGroup;
  dob: string | null;
  address: string | null;
  organizationId: string | null;
  organization: Organization | null;
  teamMember?: TeamMember | null;
  createdAt: string;
  updatedAt: string;
}
