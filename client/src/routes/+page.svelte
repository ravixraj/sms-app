<script lang="ts">
  import * as Card from "#lib/components/ui/card/index.js";
  import * as Field from "#lib/components/ui/field/index.js";
  import * as InputGroup from "#lib/components/ui/input-group/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import { toast } from "svelte-sonner";
  import IconEye from "@tabler/icons-svelte/icons/eye";
  import IconEyeOff from "@tabler/icons-svelte/icons/eye-off";
  import IconLogin from "@tabler/icons-svelte/icons/login";
  import { auth, fetchUser } from "#lib/stores/auth.svelte.js";
  import { client } from "#lib/api.js";
  import { loginSchema } from "#lib/validation.js";
  import { handleZodError } from "#lib/handleZodError.js";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  let email = $state("");
  let password = $state("");
  let showPassword = $state(false);
  let pending = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (pending) return;

    pending = true;
    try {
      const input = handleZodError(loginSchema.safeParse({ email, password }));
      const response = await client.api.auth.login.$post(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Unable to sign in.");
      }
      const session = await fetchUser();
      if (!session) {
        throw new Error("We couldn’t confirm your sign-in. Please try again.");
      }
      auth.setUser(session.user, session.schoolDate);
      email = "";
      password = "";
      await goto(resolve("/(auth)/profile"), { replace: true });
    } catch (error) {
      toast.error("Sign in failed", {
        description:
          error instanceof Error
            ? error.message
            : "Unable to sign in. Please try again.",
      });
    } finally {
      pending = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in</title>
  <meta name="description" content="Sign in to your account." />
</svelte:head>

<main
  class="flex min-h-svh w-full items-center justify-center px-4 py-6 sm:px-6 sm:py-10"
>
  <Card.Root
    class="w-full max-w-md [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(7)]"
  >
    <Card.Header class="justify-items-center gap-2 pb-1 text-center">
      <Card.Title class="text-2xl">Welcome back</Card.Title>
      <Card.Description>Sign in to your account to continue.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form
        onsubmit={handleSubmit}
        class="flex flex-col gap-5"
        aria-busy={pending}
      >
        <Field.FieldGroup class="gap-5">
          <Field.Field class="gap-2">
            <Field.FieldLabel for="email">Email</Field.FieldLabel>
            <Input
              bind:value={email}
              id="email"
              name="email"
              type="email"
              placeholder="zuck@meta.com"
              autocomplete="username"
              inputmode="email"
              autocapitalize="none"
              spellcheck={false}
              maxlength={254}
              disabled={pending}
              class="h-12"
              required
            />
          </Field.Field>
          <Field.Field class="gap-2">
            <Field.FieldLabel for="password">Password</Field.FieldLabel>
            <InputGroup.Root class="h-12">
              <InputGroup.Input
                bind:value={password}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autocomplete="current-password"
                maxlength={128}
                disabled={pending}
                class="h-full"
                required
              />
              <InputGroup.Addon align="inline-end" class="py-0">
                <InputGroup.Button
                  size="icon-sm"
                  class="size-11"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  disabled={pending}
                  onclick={() => (showPassword = !showPassword)}
                >
                  {#if showPassword}
                    <IconEyeOff aria-hidden="true" />
                  {:else}
                    <IconEye aria-hidden="true" />
                  {/if}
                </InputGroup.Button>
              </InputGroup.Addon>
            </InputGroup.Root>
          </Field.Field>
        </Field.FieldGroup>
        <Button
          type="submit"
          size="lg"
          class="min-h-12 w-full"
          disabled={pending}
        >
          {#if pending}
            <Spinner data-icon="inline-start" />
          {/if}
          {pending ? "Signing in…" : "Sign in"}
          {#if !pending}
            <IconLogin data-icon="inline-end" aria-hidden="true" />
          {/if}
        </Button>
      </form>
    </Card.Content>
  </Card.Root>
</main>
