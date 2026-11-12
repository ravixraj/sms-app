import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const COLORS = {
  card: "#FBF9F5",
  border: "#E3DCCE",
  foreground: "#2D2926",
  mutedForeground: "#787067",
  primary: "#D97757",
  primaryForeground: "#FAF9F5",
} as const;

interface TabItem {
  name: string;
  title: string;
  icon: IconName;
}

const TABS: TabItem[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "attendance", title: "Attendance", icon: "calendar-check" },
  { name: "fees", title: "Fees", icon: "wallet" },
  { name: "profile", title: "Profile", icon: "user-round" },
];

function TabBarItem({
  focused,
  icon,
  label,
}: {
  focused: boolean;
  icon: IconName;
  label: string;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center gap-1"
    >
      <View
        className={cn(
          "h-8 min-w-11 items-center justify-center rounded-full px-3",
          focused ? "bg-primary" : "bg-transparent",
        )}
      >
        <Icon
          name={icon}
          size={19}
          color={focused ? COLORS.primaryForeground : COLORS.mutedForeground}
          strokeWidth={focused ? 2.4 : 2}
        />
      </View>
      <Text
        numberOfLines={1}
        className={cn(
          "text-[10px] tracking-tight",
          focused
            ? "font-bold text-foreground"
            : "font-medium text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          bottom: bottomOffset,
          left: 16,
          right: 16,
          height: 68,
          borderRadius: 34,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.card,
          paddingBottom: 0,
          paddingHorizontal: 6,
          ...Platform.select({
            ios: {
              shadowColor: COLORS.foreground,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
            },
            android: {
              elevation: 10,
            },
            default: {
              shadowColor: COLORS.foreground,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
            },
          }),
        },
        tabBarItemStyle: {
          height: 66,
          alignItems: "center",
          justifyContent: "center",
        },
        tabBarIconStyle: {
          width: "100%",
          height: 56,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused }) => (
              <TabBarItem focused={focused} icon={tab.icon} label={tab.title} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
