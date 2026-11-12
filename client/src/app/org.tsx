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
import { authClient, parseApiResponse } from "@/lib/api";

const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters long" })
    .max(100, { message: "Name must be at most 100 characters long" }),
  metadata: z.string().trim().optional(),
});

type CreateOrgFormValues = z.infer<typeof createOrganizationSchema>;

export default function CreateOrgScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgFormValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      metadata: "",
    },
    mode: "onTouched",
  });

  const onSubmit = async (data: CreateOrgFormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await authClient.api.v1.org.$post({
        json: {
          name: data.name,
          metadata: data.metadata ? data.metadata : null,
        },
      });
      const result = await parseApiResponse<unknown>(response);

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage("Organization created successfully!");
      reset();
    } catch {
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
            <CardTitle className="text-center">Create Organization</CardTitle>
            <CardDescription className="text-center">
              Set up a new organization for your team.
            </CardDescription>
          </CardHeader>

          <CardContent className="mt-4">
            {errorMessage ? (
              <View className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3">
                <Text className="text-center text-sm font-medium text-destructive">
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {successMessage ? (
              <View className="mb-4 rounded-xl border border-success/20 bg-success/10 p-3">
                <Text className="text-center text-sm font-medium text-success">
                  {successMessage}
                </Text>
              </View>
            ) : null}

            <FieldGroup>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Organization Name</FieldLabel>
                    <Input
                      placeholder="Enter organization name"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.name)}
                    />
                    <FieldError>{errors.name?.message}</FieldError>
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="metadata"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Metadata (Optional)</FieldLabel>
                    <Input
                      placeholder="Optional notes or JSON metadata"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.metadata)}
                    />
                    <FieldError>{errors.metadata?.message}</FieldError>
                  </Field>
                )}
              />

              <Button
                className="mt-2"
                disabled={isSubmitting}
                loading={isSubmitting}
                onPress={() => handleSubmit(onSubmit)()}
              >
                {isSubmitting ? "Creating…" : "Create Organization"}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
