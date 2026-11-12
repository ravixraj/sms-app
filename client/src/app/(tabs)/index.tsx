import { useState, useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/icon";

function getGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  if (hours < 12) {
    return "Good morning";
  } else if (hours < 17) {
    return "Good afternoon";
  } else {
    return "Good evening";
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerClassName="px-4 py-2 pb-32 sm:px-6 md:px-8 max-w-2xl mx-auto w-full"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between mb-4 pt-1">
          <View className="flex-1 pr-3">
            <Text className="text-xs sm:text-sm font-medium text-muted-foreground">
              {greeting}
            </Text>
            <Text className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Ravi Sharma
            </Text>
          </View>
          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-sm"
            activeOpacity={0.7}
          >
            <Icon name="bell" size={18} color="#2D2926" />
          </TouchableOpacity>
        </View>

        {/* Attendance Banner */}
        <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-green-300 bg-green-100/70 px-4 py-3.5">
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-white shadow-xs">
              <Icon name="check-circle" size={20} color="#22c55e" />
            </View>
            <View>
              <Text className="text-sm font-bold text-green-900">
                Present today
              </Text>
              <Text className="text-xs text-green-700">Marked at 8:42 AM</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-lg font-extrabold text-green-900">94%</Text>
            <Text className="text-[11px] text-green-700">this month</Text>
          </View>
        </View>

        {/* Fees Due Banner */}
        <View className="mb-6 flex-row items-center justify-between rounded-2xl border border-amber-300 bg-amber-100/70 px-4 py-3.5">
          <View className="flex-row items-center gap-3 flex-1">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-amber-200/80">
              <Icon name="clock" size={18} color="#92400e" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-amber-900">
                Term 2 fee due in 5 days
              </Text>
              <Text className="text-xs text-amber-800">₹12,500 pending</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/fees" as any)}
            className="rounded-lg bg-amber-900/10 px-3 py-1.5"
          >
            <Text className="text-xs font-bold text-amber-900">Pay</Text>
          </TouchableOpacity>
        </View>

        <Text className="mb-3 text-sm font-semibold text-foreground">
          Quick actions
        </Text>
        <View className="mb-6 flex-row flex-wrap gap-3">
          {/* Action 1: Attendance */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/attendance" as any)}
            className="flex-1 min-w-[45%] rounded-2xl border border-border bg-card p-4"
          >
            <View className="mb-2">
              <Icon name="calendar" size={22} color="#D97757" />
            </View>
            <Text className="text-base font-bold text-foreground">
              Attendance
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Calendar and history
            </Text>
          </TouchableOpacity>

          {/* Action 2: Leave */}
          <TouchableOpacity
            activeOpacity={0.8}
            className="flex-1 min-w-[45%] rounded-2xl border border-border bg-card p-4"
          >
            <View className="mb-2">
              <Icon name="file-text" size={22} color="#D97757" />
            </View>
            <Text className="text-base font-bold text-foreground">Leave</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              1 request pending
            </Text>
          </TouchableOpacity>

          {/* Action 3: Fees */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/fees" as any)}
            className="flex-1 min-w-[45%] rounded-2xl border border-border bg-card p-4"
          >
            <View className="mb-2">
              <Icon name="credit-card" size={22} color="#D97757" />
            </View>
            <Text className="text-base font-bold text-foreground">Fees</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Pay and receipts
            </Text>
          </TouchableOpacity>

          {/* Action 4: Report Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            className="flex-1 min-w-[45%] rounded-2xl border border-border bg-card p-4"
          >
            <View className="mb-2">
              <Icon name="award" size={22} color="#D97757" />
            </View>
            <Text className="text-base font-bold text-foreground">
              Report card
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Unit test 2 is out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
