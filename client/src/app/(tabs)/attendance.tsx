import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth-store";
import { TeacherAttendance } from "@/components/teacher-attendance";
import { StudentAttendance } from "@/components/student-attendance";

export default function AttendanceScreen() {
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.role === "TEACHER";

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "left", "right"]}
    >
      {isTeacher ? <TeacherAttendance /> : <StudentAttendance />}
    </SafeAreaView>
  );
}
