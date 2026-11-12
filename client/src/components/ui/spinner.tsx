import type { ComponentProps } from "react";
import { ActivityIndicator } from "react-native";

import { cn } from "@/lib/utils";

type ActivityIndicatorProps = ComponentProps<typeof ActivityIndicator>;

export function Spinner({
  className,
  size = "small",
  ...props
}: ActivityIndicatorProps) {
  return (
    <ActivityIndicator
      accessibilityRole="progressbar"
      className={cn("text-current", className)}
      size={size}
      {...props}
    />
  );
}
