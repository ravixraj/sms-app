import type { ComponentPropsWithRef, ComponentRef } from "react";
import { TextInput } from "react-native";

import { cn } from "@/lib/utils";

type TextInputProps = ComponentPropsWithRef<typeof TextInput>;

export type InputHandle = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  invalid?: boolean;
};

export function Input({
  className,
  invalid,
  placeholderTextColor,
  ref,
  ...props
}: InputProps) {
  return (
    <TextInput
      ref={ref}
      className={cn(
        "h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground",
        invalid && "border-destructive",
        className,
      )}
      placeholderTextColor={placeholderTextColor ?? "oklch(0.5 0.01 95)"}
      {...props}
    />
  );
}
