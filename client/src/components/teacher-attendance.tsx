import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { authClient, parseApiResponse } from "@/lib/api";
import type { AttendanceStatus, ClassData, ClassesResponse } from "@/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TeacherAttendance() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [date] = useState(todayISO);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authClient.api.v1.attendance.classes.$get({
        query: { date },
      });
      const result = await parseApiResponse<ClassesResponse>(response);
      if (!result.success) {
        setError(result.message);
        return;
      }
      const fetched = result.data.classes;
      setClasses(fetched);

      if (fetched.length > 0) {
        setSelectedClassId(fetched[0].id);
        const initial: Record<string, AttendanceStatus> = {};
        for (const cls of fetched) {
          for (const s of cls.students) {
            initial[s.id] = s.status ?? "PRESENT";
          }
        }
        setStatusMap(initial);
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void fetchClasses();
  }, [fetchClasses]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    if (!search.trim()) return selectedClass.students;
    const q = search.toLowerCase();
    return selectedClass.students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [selectedClass, search]);

  const counts = useMemo(() => {
    if (!selectedClass) return { PRESENT: 0, ABSENT: 0, LEAVE: 0 };
    return selectedClass.students.reduce(
      (acc, s) => {
        const st = statusMap[s.id] ?? "PRESENT";
        acc[st] = (acc[st] ?? 0) + 1;
        return acc;
      },
      { PRESENT: 0, ABSENT: 0, LEAVE: 0 } as Record<AttendanceStatus, number>,
    );
  }, [selectedClass, statusMap]);

  const markAllPresent = () => {
    if (!selectedClass) return;
    const next = { ...statusMap };
    for (const s of selectedClass.students) {
      next[s.id] = "PRESENT";
    }
    setStatusMap(next);
  };

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const submitAttendance = async () => {
    if (!selectedClass) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const records = selectedClass.students.map((s) => ({
      userId: s.id,
      status: statusMap[s.id] ?? ("PRESENT" as AttendanceStatus),
    }));

    try {
      const response = await authClient.api.v1.attendance.$post({
        json: {
          teamId: selectedClass.id,
          date,
          records,
        },
      });
      const result = await parseApiResponse<unknown>(response);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSuccess("Attendance submitted successfully!");
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner className="text-primary" />
      </View>
    );
  }

  if (error && classes.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-sm font-medium text-destructive mb-3">
          {error}
        </Text>
        <TouchableOpacity
          className="rounded-xl bg-primary px-5 py-2.5"
          onPress={fetchClasses}
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
      contentContainerClassName="p-4 pb-36 max-w-2xl mx-auto w-full"
      showsVerticalScrollIndicator={false}
    >
      {/* Header Card */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Icon name="calendar-check" size={20} color="#787067" />
          <View>
            <Text className="text-lg font-bold text-foreground">
              {selectedClass?.name || "Class"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {formatDisplayDate(date)} · Period 1
            </Text>
          </View>
        </View>
        <View className="rounded-full bg-blue-100/90 border border-blue-200 px-3 py-1">
          <Text className="text-xs font-semibold text-blue-700">Draft</Text>
        </View>
      </View>

      {/* Top 3 Summary Cards */}
      <View className="flex-row gap-2.5 mb-4">
        <View className="flex-1 items-center justify-center rounded-2xl bg-green-200/80 py-3.5">
          <Text className="text-xl font-bold text-green-950">
            {counts.PRESENT}
          </Text>
          <Text className="text-xs font-medium text-green-800">Present</Text>
        </View>
        <View className="flex-1 items-center justify-center rounded-2xl bg-red-200/80 py-3.5">
          <Text className="text-xl font-bold text-red-950">
            {counts.ABSENT}
          </Text>
          <Text className="text-xs font-medium text-red-800">Absent</Text>
        </View>
        <View className="flex-1 items-center justify-center rounded-2xl bg-amber-200/80 py-3.5">
          <Text className="text-xl font-bold text-amber-950">
            {counts.LEAVE}
          </Text>
          <Text className="text-xs font-medium text-amber-800">Leave</Text>
        </View>
      </View>

      {/* Search bar + "Mark all present" button */}
      <View className="flex-row items-center gap-2 mb-4">
        <View className="flex-1 flex-row items-center rounded-xl border border-border bg-card px-3 py-2">
          <Icon name="search" size={16} color="#A8A29E" />
          <TextInput
            placeholder="Search student"
            placeholderTextColor="#A8A29E"
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-2 text-sm text-foreground p-0"
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={markAllPresent}
          className="rounded-xl border border-border bg-card px-3.5 py-2.5"
        >
          <Text className="text-xs font-semibold text-foreground">
            Mark all present
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feedback messages */}
      {error ? (
        <View className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 mb-3">
          <Text className="text-center text-xs font-medium text-destructive">
            {error}
          </Text>
        </View>
      ) : null}
      {success ? (
        <View className="rounded-xl border border-green-200 bg-green-100 p-3 mb-3">
          <Text className="text-center text-xs font-medium text-green-800">
            {success}
          </Text>
        </View>
      ) : null}

      {/* Students List Table */}
      <View className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
        {filteredStudents.map((s, index) => {
          const currentStatus = statusMap[s.id] ?? "PRESENT";
          const isLast = index === filteredStudents.length - 1;
          const idxNumber = String(index + 1).padStart(2, "0");

          return (
            <View
              key={s.id}
              className={`flex-row items-center justify-between px-4 py-3 ${
                !isLast ? "border-b border-border/50" : ""
              }`}
            >
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <Text className="text-xs font-mono text-muted-foreground w-5">
                  {idxNumber}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-sm font-semibold text-foreground flex-1"
                >
                  {s.name}
                </Text>
              </View>

              {/* P A L buttons */}
              <View className="flex-row gap-1.5">
                <TouchableOpacity
                  onPress={() => setStudentStatus(s.id, "PRESENT")}
                  className={`h-9 w-9 items-center justify-center rounded-xl border ${
                    currentStatus === "PRESENT"
                      ? "bg-green-100 border-green-400"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      currentStatus === "PRESENT"
                        ? "text-green-800"
                        : "text-foreground"
                    }`}
                  >
                    P
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStudentStatus(s.id, "ABSENT")}
                  className={`h-9 w-9 items-center justify-center rounded-xl border ${
                    currentStatus === "ABSENT"
                      ? "bg-red-100 border-red-400"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      currentStatus === "ABSENT"
                        ? "text-red-800"
                        : "text-foreground"
                    }`}
                  >
                    A
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStudentStatus(s.id, "LEAVE")}
                  className={`h-9 w-9 items-center justify-center rounded-xl border ${
                    currentStatus === "LEAVE"
                      ? "bg-amber-100 border-amber-400"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      currentStatus === "LEAVE"
                        ? "text-amber-800"
                        : "text-foreground"
                    }`}
                  >
                    L
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={submitAttendance}
        disabled={submitting}
        className="flex-row items-center justify-center gap-2 rounded-2xl bg-[#D97757] py-4 px-6 shadow-sm"
      >
        {submitting ? (
          <Spinner className="text-white" />
        ) : (
          <Icon name="check" size={18} color="#FFFFFF" strokeWidth={2.5} />
        )}
        <Text className="text-base font-bold text-white">
          {submitting ? "Submitting…" : "Submit attendance"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
