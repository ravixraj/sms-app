import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, UserRole } from "@/types";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "present"
  | "absent"
  | "leave"
  | "role-admin"
  | "role-principal"
  | "role-teacher"
  | "role-student"
  | "role-accountant";

export type BadgeSize = "sm" | "default" | "lg";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-primary border-primary",
  secondary: "bg-secondary border-secondary",
  outline: "border-border bg-transparent",
  destructive: "bg-destructive/10 border-destructive/20",
  // Attendance variants
  present: "bg-green-100/80 border-green-300",
  absent: "bg-red-100/80 border-red-300",
  leave: "bg-amber-100/80 border-amber-300",
  // Role variants
  "role-admin": "bg-red-100 border-red-200",
  "role-principal": "bg-purple-100 border-purple-200",
  "role-teacher": "bg-blue-100 border-blue-200",
  "role-student": "bg-green-100 border-green-200",
  "role-accountant": "bg-amber-100 border-amber-200",
};

const badgeTextVariants: Record<BadgeVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  destructive: "text-destructive",
  // Attendance text
  present: "text-green-800",
  absent: "text-red-800",
  leave: "text-amber-800",
  // Role text
  "role-admin": "text-red-800",
  "role-principal": "text-purple-800",
  "role-teacher": "text-blue-800",
  "role-student": "text-green-800",
  "role-accountant": "text-amber-800",
};

const badgeSizes: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 rounded-md",
  default: "px-3 py-1 rounded-full",
  lg: "px-4 py-1.5 rounded-full",
};

const badgeTextSizes: Record<BadgeSize, string> = {
  sm: "text-[11px]",
  default: "text-xs font-semibold",
  lg: "text-sm font-semibold",
};

export interface BadgeProps extends ComponentProps<typeof View> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children?: ReactNode;
  textClassName?: string;
}

export function Badge({
  variant = "default",
  size = "default",
  className,
  children,
  textClassName,
  ...props
}: BadgeProps) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-center border",
        badgeVariants[variant],
        badgeSizes[size],
        className,
      )}
      {...props}
    >
      {typeof children === "string" || typeof children === "number" ? (
        <Text
          className={cn(
            badgeTextVariants[variant],
            badgeTextSizes[size],
            textClassName,
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

// ── Status Chip Button (for selection/toggling in attendance) ──

export interface StatusBadgeChipProps {
  status: AttendanceStatus;
  active: boolean;
  onPress: () => void;
  size?: BadgeSize;
  className?: string;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LEAVE: "Leave",
};

export const ATTENDANCE_STATUS_VARIANTS: Record<
  AttendanceStatus,
  BadgeVariant
> = {
  PRESENT: "present",
  ABSENT: "absent",
  LEAVE: "leave",
};

export function StatusBadgeChip({
  status,
  active,
  onPress,
  size = "default",
  className,
}: StatusBadgeChipProps) {
  const variant = ATTENDANCE_STATUS_VARIANTS[status];
  const label = ATTENDANCE_STATUS_LABELS[status];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        "items-center justify-center border",
        active ? badgeVariants[variant] : "border-border bg-card",
        badgeSizes[size],
        className,
      )}
    >
      <Text
        className={cn(
          badgeTextSizes[size],
          active ? badgeTextVariants[variant] : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Role Badge Helper ──

export const ROLE_VARIANTS: Record<UserRole, BadgeVariant> = {
  ADMIN: "role-admin",
  PRINCIPAL: "role-principal",
  TEACHER: "role-teacher",
  STUDENT: "role-student",
  ACCOUNTANT: "role-accountant",
};

export function RoleBadge({
  role,
  size = "default",
  className,
}: {
  role: UserRole;
  size?: BadgeSize;
  className?: string;
}) {
  const formattedRole = role.charAt(0) + role.slice(1).toLowerCase();
  const variant = ROLE_VARIANTS[role] ?? "default";

  return (
    <Badge variant={variant} size={size} className={className}>
      {formattedRole}
    </Badge>
  );
}
