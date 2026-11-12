import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "expo-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { client, parseApiResponse } from "@/lib/api";
import { useAuthStore, type AuthSession } from "@/stores/auth-store";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Invalid email address" })),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters long" })
    .max(50, { error: "Password must be at most 50 characters long" })
    .regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[#?!@$%^&*-]).+$/, {
      error:
        "Password must contain at least one uppercase letter, one lowercase letter, number and one special character.",
    }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  });

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMessage(null);

    try {
      const response = await client.api.v1.auth.login.$post({
        json: data,
      });

      const result = await parseApiResponse<AuthSession>(response);

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSession(result.data);
      router.replace("/");
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage("Unable to reach the server. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center p-4"
        keyboardShouldPersistTaps="handled"
      >
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Login to your account
            </CardDescription>
          </CardHeader>

          <CardContent className="mt-4">
            {errorMessage && (
              <View className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3">
                <Text className="text-center text-sm font-medium text-destructive">
                  {errorMessage}
                </Text>
              </View>
            )}

            <FieldGroup>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Email</FieldLabel>
                    <Input
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      placeholder="Enter your email"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.email)}
                    />
                    <FieldError>{errors.email?.message}</FieldError>
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Password</FieldLabel>
                    <Input
                      autoCapitalize="none"
                      autoComplete="current-password"
                      secureTextEntry
                      placeholder="Enter your password"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.password)}
                    />
                    <FieldError>{errors.password?.message}</FieldError>
                  </Field>
                )}
              />

              <Button
                className="mt-2"
                disabled={isSubmitting}
                loading={isSubmitting}
                onPress={() => handleSubmit(onSubmit)()}
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
