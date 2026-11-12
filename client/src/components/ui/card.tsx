import type { ComponentProps } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

type ViewProps = ComponentProps<typeof View>;
type TextProps = ComponentProps<typeof Text>;

export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm shadow-black/5",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn("gap-1.5 p-6 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn(
        "text-2xl font-bold tracking-tight text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-sm leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("flex-row items-center p-6 pt-0", className)}
      {...props}
    />
  );
}
