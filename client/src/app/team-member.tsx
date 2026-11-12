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

const addTeamMemberSchema = z.object({
  organizationId: z.uuid({ error: "Enter a valid organization ID" }),
  teamId: z.uuid({ error: "Enter a valid team ID" }),
  userId: z.uuid({ error: "Enter a valid user ID" }),
});

type AddTeamMemberFormValues = z.infer<typeof addTeamMemberSchema>;

export default function AddTeamMemberScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddTeamMemberFormValues>({
    resolver: zodResolver(addTeamMemberSchema),
    defaultValues: {
      organizationId: "",
      teamId: "",
      userId: "",
    },
    mode: "onTouched",
  });

  const onSubmit = async (data: AddTeamMemberFormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await authClient.api.v1.org[":organizationId"].teams[
        ":teamId"
      ].members.$post({
        param: {
          organizationId: data.organizationId,
          teamId: data.teamId,
        },
        json: {
          userId: data.userId,
        },
      });
      const result = await parseApiResponse<unknown>(response);

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage("Member added to team successfully!");
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
            <CardTitle className="text-center">Add Team Member</CardTitle>
            <CardDescription className="text-center">
              Add an organization member to a team.
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
                name="teamId"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>Team ID</FieldLabel>
                    <Input
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Enter team ID"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.teamId)}
                    />
                    <FieldError>{errors.teamId?.message}</FieldError>
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="userId"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field>
                    <FieldLabel>User ID</FieldLabel>
                    <Input
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Enter user ID to add"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      invalid={Boolean(errors.userId)}
                    />
                    <FieldError>{errors.userId?.message}</FieldError>
                  </Field>
                )}
              />

              <Button
                className="mt-2"
                disabled={isSubmitting}
                loading={isSubmitting}
                onPress={() => handleSubmit(onSubmit)()}
              >
                {isSubmitting ? "Adding…" : "Add Member"}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
