import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  destructive: "bg-destructive",
  outline: "border border-input bg-transparent",
  ghost: "bg-transparent",
  link: "bg-transparent",
} as const;

const buttonTextVariants = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  accent: "text-accent-foreground",
  destructive: "text-destructive-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  link: "text-primary underline",
} as const;

const buttonSpinnerVariants = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  accent: "text-accent-foreground",
  destructive: "text-destructive-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  link: "text-primary",
} as const;

const buttonSizes = {
  default: "h-12 px-5",
  sm: "h-9 px-3.5",
  lg: "h-14 px-6",
  icon: "h-12 w-12",
} as const;

const buttonTextSizes = {
  default: "text-base",
  sm: "text-sm",
  lg: "text-lg",
  icon: "text-base",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

type PressableProps = ComponentProps<typeof Pressable>;

export type ButtonProps = PressableProps & {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  textClassName?: string;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  children,
  disabled,
  loading = false,
  textClassName,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-xl active:opacity-90",
        buttonVariants[variant],
        buttonSizes[size],
        isDisabled && "opacity-50",
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Spinner className={buttonSpinnerVariants[variant]} /> : null}
      {typeof children === "string" || typeof children === "number" ? (
        <Text
          className={cn(
            "text-center font-semibold",
            buttonTextVariants[variant],
            buttonTextSizes[size],
            textClassName,
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
