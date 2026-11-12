import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
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

const createTeamSchema = z.object({
  organizationId: z.uuid({ error: "Enter a valid organization ID" }),
  name: z
    .string()
    .trim()
    .min(2, { error: "Team name must be at least 2 characters" })
    .max(50, { error: "Team name must be at most 50 characters" }),
  leaderId: z.uuid({ error: "Enter a valid leader ID" }),
});

type CreateTeamFormValues = z.infer<typeof createTeamSchema>;

export default function CreateTeamScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      organizationId: "",
      name: "",
      leaderId: "",
    },
    mode: "onTouched",
  });

  const onSubmit = async (data: CreateTeamFormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await authClient.api.v1.org[
        ":organizationId"
      ].teams.$post({
        param: { organizationId: data.organizationId },
        json: {
          name: data.name,
          leaderId: data.leaderId,
        },
      });
      const result = await parseApiResponse<unknown>(response);

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage("Team created successfully!");
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
            <CardTitle className="text-center">Create Team</CardTitle>
            <CardDescription className="text-center">
              Add a team and assign its leader.
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
                name="organizationId"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Organization ID</FieldLabel>
                    <Input
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Enter organization ID"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.organizationId)}
                    />
                    <FieldError>{errors.organizationId?.message}</FieldError>
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Team Name</FieldLabel>
                    <Input
                      placeholder="e.g. Class 7-B"
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
                name="leaderId"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Leader ID</FieldLabel>
                    <Input
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Enter the leader's user ID"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.leaderId)}
                    />
                    <FieldError>{errors.leaderId?.message}</FieldError>
                  </Field>
                )}
              />

              <Button
                className="mt-2"
                disabled={isSubmitting}
                loading={isSubmitting}
                onPress={() => handleSubmit(onSubmit)()}
              >
                {isSubmitting ? "Creating…" : "Create Team"}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
