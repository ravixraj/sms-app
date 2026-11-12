import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { authClient, parseApiResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { AttendanceStatus, UserAttendanceResponse } from "@/types";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function StudentAttendance() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<UserAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserAttendance = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await authClient.api.v1.attendance.users[":userId"].$get(
        {
          param: { userId: user.id },
          query: { limit: "31" },
        },
      );
      const result = await parseApiResponse<UserAttendanceResponse>(response);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setData(result.data);
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchUserAttendance();
  }, [fetchUserAttendance]);

  // Calendar dates calculation for current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentDay = now.getDate();
  const monthName = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Convert Sunday-indexed to Monday-indexed: Mon=0, Tue=1 ... Sun=6
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const recordsMap = useMemo(() => {
    const map = new Map<number, AttendanceStatus>();
    if (!data?.records) return map;
    for (const r of data.records) {
      const rDate = new Date(r.date + "T00:00:00");
      if (rDate.getFullYear() === year && rDate.getMonth() === month) {
        map.set(rDate.getDate(), r.status);
      }
    }
    return map;
  }, [data?.records, year, month]);

  const summary = data?.summary ?? {
    total: 0,
    present: 0,
    absent: 0,
    leave: 0,
  };
  const percentage =
    summary.total > 0
      ? Math.round((summary.present / summary.total) * 100)
      : 100;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner className="text-primary" />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-sm font-medium text-destructive mb-3">
          {error}
        </Text>
        <TouchableOpacity
          className="rounded-xl bg-primary px-5 py-2.5"
          onPress={fetchUserAttendance}
        >
          <Text className="text-sm font-semibold text-primary-foreground">
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerClassName="p-4 pb-36 max-w-xl mx-auto w-full"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Icon name="calendar-days" size={20} color="#787067" />
          <Text className="text-xl font-bold tracking-tight text-foreground">
            Attendance
          </Text>
        </View>
        <View className="rounded-full bg-blue-100/90 border border-blue-200 px-3 py-1">
          <Text className="text-xs font-semibold text-blue-700">
            {user?.name || "Student"}
          </Text>
        </View>
      </View>

      {/* Percentage Card */}
      <View className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4 mb-4">
        <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-background">
          <Text className="text-base font-extrabold text-foreground">
            {percentage}%
          </Text>
        </View>
        <View>
          <Text className="text-base font-bold text-foreground">
            Good attendance
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {summary.present} of {summary.total || daysInMonth} school days this
            month
          </Text>
        </View>
      </View>

      {/* 4 Colored Summary Blocks */}
      <View className="flex-row flex-wrap gap-2.5 mb-5">
        <View className="flex-1 min-w-[45%] rounded-2xl bg-green-200/80 p-3.5">
          <Text className="text-xs font-medium text-green-900">Present</Text>
          <Text className="text-2xl font-bold text-green-950 mt-1">
            {summary.present}
          </Text>
        </View>
        <View className="flex-1 min-w-[45%] rounded-2xl bg-red-200/80 p-3.5">
          <Text className="text-xs font-medium text-red-900">Absent</Text>
          <Text className="text-2xl font-bold text-red-950 mt-1">
            {summary.absent}
          </Text>
        </View>
        <View className="flex-1 min-w-[45%] rounded-2xl bg-amber-200/80 p-3.5">
          <Text className="text-xs font-medium text-amber-900">Late</Text>
          <Text className="text-2xl font-bold text-amber-950 mt-1">0</Text>
        </View>
        <View className="flex-1 min-w-[45%] rounded-2xl bg-blue-200/80 p-3.5">
          <Text className="text-xs font-medium text-blue-900">On leave</Text>
          <Text className="text-2xl font-bold text-blue-950 mt-1">
            {summary.leave}
          </Text>
        </View>
      </View>

      {/* Calendar Header with month & arrows */}
      <View className="flex-row items-center justify-between px-2 mb-3">
        <TouchableOpacity activeOpacity={0.7}>
          <Icon name="arrow-left" size={16} color="#787067" />
        </TouchableOpacity>
        <Text className="text-sm font-bold text-foreground">{monthName}</Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Icon name="arrow-right" size={16} color="#787067" />
        </TouchableOpacity>
      </View>

      {/* Day of Week Headers */}
      <View className="flex-row justify-between mb-2 px-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <Text
            key={i}
            className="w-10 text-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="flex-row flex-wrap mb-4">
        {Array.from({ length: startOffset }).map((_, i) => (
          <View key={`empty-${i}`} className="w-[14.28%] h-10" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const status = recordsMap.get(day);
          const isToday = day === currentDay;

          let bgStyle = "";
          let textStyle = "text-foreground";

          if (status === "PRESENT") {
            bgStyle = "bg-green-200/90";
            textStyle = "text-green-950 font-bold";
          } else if (status === "ABSENT") {
            bgStyle = "bg-red-200/90";
            textStyle = "text-red-950 font-bold";
          } else if (status === "LEAVE") {
            bgStyle = "bg-blue-200/90";
            textStyle = "text-blue-950 font-bold";
          }

          return (
            <View
              key={day}
              className="w-[14.28%] h-11 items-center justify-center p-0.5"
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-xl ${bgStyle} ${
                  isToday ? "border-2 border-foreground" : ""
                }`}
              >
                <Text className={`text-xs font-medium ${textStyle}`}>
                  {day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View className="flex-row items-center justify-center gap-4 mb-6">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-green-500" />
          <Text className="text-xs text-muted-foreground">Present</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-red-500" />
          <Text className="text-xs text-muted-foreground">Absent</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-amber-500" />
          <Text className="text-xs text-muted-foreground">Late</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-blue-500" />
          <Text className="text-xs text-muted-foreground">Leave</Text>
        </View>
      </View>

      {/* Recent Records List */}
      <Text className="text-xs font-semibold text-muted-foreground mb-2 px-1">
        Recent
      </Text>
      <View className="rounded-2xl border border-border bg-card overflow-hidden">
        {data?.records && data.records.length > 0 ? (
          data.records.slice(0, 5).map((r, i) => {
            const isLast = i === Math.min(data.records.length, 5) - 1;
            const statusColor =
              r.status === "PRESENT"
                ? "bg-green-100/90 border-green-200 text-green-700"
                : r.status === "ABSENT"
                  ? "bg-red-100/90 border-red-200 text-red-700"
                  : "bg-blue-100/90 border-blue-200 text-blue-700";

            return (
              <View
                key={r.date}
                className={`flex-row items-center justify-between px-4 py-3.5 ${
                  !isLast ? "border-b border-border/50" : ""
                }`}
              >
                <Text className="text-sm font-medium text-foreground">
                  {formatShortDate(r.date)}
                </Text>
                <View
                  className={`rounded-full border px-2.5 py-0.5 ${statusColor.split(" ").slice(0, 2).join(" ")}`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${statusColor.split(" ")[2]}`}
                  >
                    {r.status === "PRESENT"
                      ? "Present"
                      : r.status === "ABSENT"
                        ? "Absent"
                        : "Leave"}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View className="py-6 items-center">
            <Text className="text-xs text-muted-foreground">
              No attendance records found yet.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
