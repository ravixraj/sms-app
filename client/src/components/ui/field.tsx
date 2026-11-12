import type { ComponentProps } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

type ViewProps = ComponentProps<typeof View>;
type TextProps = ComponentProps<typeof Text>;

export function FieldGroup({ className, ...props }: ViewProps) {
  return <View className={cn("gap-4", className)} {...props} />;
}

export function Field({ className, ...props }: ViewProps) {
  return <View className={cn("gap-2", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function FieldDescription({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-xs leading-4 text-muted-foreground", className)}
      {...props}
    />
  );
}

export function FieldError({ className, children, ...props }: TextProps) {
  if (!children) return null;

  return (
    <Text
      accessibilityLiveRegion="polite"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    >
      {children}
    </Text>
  );
}
