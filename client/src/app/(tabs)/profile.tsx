import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Icon, type IconName } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { RoleBadge } from "@/components/ui/badge";
import { authClient, parseApiResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { UserProfile } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "" + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function formatGender(gender?: string | null): string {
  if (!gender) return "—";
  return gender.charAt(0) + gender.slice(1).toLowerCase();
}

// ── Components ───────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  isLast = false,
  badge,
  chevron = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string | null;
  isLast?: boolean;
  badge?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) {
  const row = (
    <View
      className={`flex-row items-center justify-between px-4 py-3.5 ${
        !isLast ? "border-b border-border/60" : ""
      }`}
    >
      <View className="flex-row items-center gap-3 flex-1 pr-2">
        <Icon name={icon} size={18} color="#787067" />
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      </View>

      <View className="flex-row items-center gap-2">
        {value ? (
          <Text
            numberOfLines={1}
            className="text-sm text-foreground/80 font-normal max-w-[200px] text-right"
          >
            {value}
          </Text>
        ) : null}
        {badge}
        {chevron ? (
          <Icon name="chevron-right" size={16} color="#A8A29E" />
        ) : null}
      </View>
    </View>
  );

  return onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {row}
    </TouchableOpacity>
  ) : (
    row
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authClient.api.v1.users.me.$get();
      const result = await parseApiResponse<{ user: UserProfile }>(response);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setProfile(result.data.user);
      useAuthStore.getState().setUser({
        id: result.data.user.id,
        name: result.data.user.name,
        email: result.data.user.email,
        role: result.data.user.role,
        organizationId: result.data.user.organizationId,
        avatar: result.data.user.avatar,
      });
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authClient.api.v1.auth.logout.$post();
    } catch {
      // Ignore network errors to allow local signout
    } finally {
      useAuthStore.getState().clearSession();
      setLoggingOut(false);
      router.replace("/login" as any);
    }
  };

  const teamName = profile?.teamMember?.team?.name;

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "left", "right"]}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner className="text-primary" />
        </View>
      ) : error || !profile ? (
        <View className="flex-1 items-center justify-center p-4">
          <View className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
            <Text className="text-center text-sm font-medium text-destructive">
              {error ?? "Unable to load profile."}
            </Text>
          </View>
          <TouchableOpacity
            className="mt-4 rounded-xl bg-primary px-5 py-2.5"
            onPress={fetchProfile}
          >
            <Text className="text-sm font-semibold text-primary-foreground">
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-4 pt-6 pb-36 max-w-xl mx-auto w-full"
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View className="items-center mb-6">
            <View className="relative mb-3">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-blue-100/90">
                <Text className="text-3xl font-bold tracking-tight text-blue-900">
                  {getInitials(profile.name)}
                </Text>
              </View>

              <View className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-xs">
                <Icon name="camera" size={13} color="#787067" />
              </View>
            </View>

            <Text className="text-xl font-bold tracking-tight text-foreground">
              {profile.name}
            </Text>

            <View className="flex-row items-center gap-2 mt-2">
              <RoleBadge role={profile.role} size="sm" />
              {teamName ? (
                <View className="rounded-full bg-muted/80 px-2.5 py-0.5 border border-border/40">
                  <Text className="text-[11px] font-medium text-muted-foreground">
                    {teamName}
                  </Text>
                </View>
              ) : null}
            </View>

            {profile.organization?.name ? (
              <View className="flex-row items-center gap-1.5 mt-2">
                <Icon name="graduation-cap" size={14} color="#787067" />
                <Text className="text-xs text-muted-foreground">
                  {profile.organization.name}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Personal Details */}
          <View className="mb-5">
            <Text className="text-xs font-medium text-muted-foreground px-1 mb-2">
              Personal details
            </Text>

            <View className="rounded-2xl border border-border bg-card overflow-hidden">
              <DetailRow
                icon="user"
                label="Gender"
                value={formatGender(profile.gender)}
              />
              <DetailRow
                icon="calendar"
                label="Date of birth"
                value={formatDate(profile.dob)}
              />
              <DetailRow
                icon="droplet"
                label="Blood group"
                value={profile.bloodGroup || "—"}
              />
              <DetailRow
                icon="home"
                label="Address"
                value={profile.address || "—"}
                isLast
              />
            </View>
          </View>

          {/* Account Details */}
          <View className="mb-6">
            <Text className="text-xs font-medium text-muted-foreground px-1 mb-2">
              Account
            </Text>

            <View className="rounded-2xl border border-border bg-card overflow-hidden">
              <DetailRow
                icon="mail"
                label={profile.email}
                badge={
                  <View className="rounded-full bg-green-100/90 border border-green-200 px-2.5 py-0.5">
                    <Text className="text-[11px] font-medium text-green-700">
                      {profile.emailVerified ? "Verified" : "Unverified"}
                    </Text>
                  </View>
                }
              />
              <DetailRow
                icon="lock"
                label="Change password"
                chevron
                onPress={() => {}}
              />
              <DetailRow
                icon="pencil"
                label="Edit profile"
                chevron
                isLast
                onPress={() => {}}
              />
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            disabled={loggingOut}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 px-4 mb-4"
          >
            {loggingOut ? (
              <Spinner className="text-destructive" />
            ) : (
              <Icon name="log-out" size={17} color="#dc2626" />
            )}
            <Text className="text-sm font-semibold text-destructive">
              {loggingOut ? "Logging out…" : "Log out"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
