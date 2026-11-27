export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AppStatus = AttendanceStatus | LeaveStatus;

export const statusStyles: Record<AppStatus, string> = {
  PRESENT: "border-chart-3/25 bg-chart-3/10 text-chart-3",
  ABSENT: "border-destructive/25 bg-destructive/10 text-destructive",
  LEAVE: "border-chart-4/30 bg-chart-4/15 text-chart-4",
  PENDING: "border-chart-4/30 bg-chart-4/15 text-chart-4",
  APPROVED: "border-chart-3/25 bg-chart-3/10 text-chart-3",
  REJECTED: "border-destructive/25 bg-destructive/10 text-destructive",
};

export const statusLabels: Record<AppStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LEAVE: "Leave",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const statusTextStyles: Record<AppStatus, string> = {
  PRESENT: "text-chart-3",
  ABSENT: "text-destructive",
  LEAVE: "text-chart-4",
  PENDING: "text-chart-4",
  APPROVED: "text-chart-3",
  REJECTED: "text-destructive",
};

/** Lighter fill for calendar cells, where a full bordered chip is too heavy. */
export const statusCellStyles: Record<AttendanceStatus, string> = {
  PRESENT: "bg-chart-3/10 text-chart-3",
  ABSENT: "bg-destructive/10 text-destructive",
  LEAVE: "bg-chart-4/15 text-chart-4",
};
