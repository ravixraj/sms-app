<script lang="ts">
  import { toast } from "svelte-sonner";
  import { auth } from "#lib/stores/auth.svelte.js";
  import { client } from "#lib/api.js";
  import Appearance from "#lib/components/Appearance.svelte";
  import IconMail from "@tabler/icons-svelte/icons/mail";
  import IconCalendar from "@tabler/icons-svelte/icons/calendar";
  import IconUser from "@tabler/icons-svelte/icons/user";
  import IconHeart from "@tabler/icons-svelte/icons/heart";
  import IconMapPin from "@tabler/icons-svelte/icons/map-pin";
  import IconSchool from "@tabler/icons-svelte/icons/school";
  import IconUsers from "@tabler/icons-svelte/icons/users";
  import IconLogout from "@tabler/icons-svelte/icons/logout";
  import IconRosetteDiscountCheckFilled from "@tabler/icons-svelte/icons/rosette-discount-check-filled";
  import * as Avatar from "#lib/components/ui/avatar/index.js";
  import * as Card from "#lib/components/ui/card/index.js";
  import { Badge } from "#lib/components/ui/badge/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";

  type Detail = {
    label: string;
    value: string;
    icon: typeof IconMail;
    span?: string;
  };

  const user = $derived(auth.user);
  let signingOut = $state(false);

  const classNames = $derived.by(() => {
    const names = [
      user?.teamMember?.team?.name,
      ...(user?.ledTeams ?? []).map((team) => team.name),
    ];

    return [
      ...new Set(
        names
          .map((name) => name?.trim())
          .filter((name): name is string => !!name),
      ),
    ].join(", ");
  });

  const schoolName = $derived(user?.org?.name?.trim() ?? "");

  const profileDetails = $derived.by((): Detail[] => {
    if (!user) return [];

    const rows: Detail[] = [
      {
        label: "Email",
        value: user.email,
        icon: IconMail,
        span: schoolName ? undefined : "md:col-span-3",
      },
    ];

    if (schoolName) {
      rows.push({
        label: "School",
        value: schoolName,
        icon: IconSchool,
      });
    }

    // Principals have no class/team, so only show it when one exists.
    if (classNames) {
      rows.push({
        label: user.role === "TEACHER" ? "CT" : "Class",
        value: classNames,
        icon: IconUsers,
      });
    }

    rows.push(
      {
        label: "Date of birth",
        value: formatDate(user.dob?.slice(0, 10)),
        icon: IconCalendar,
      },
      {
        label: "Gender",
        value: user.gender || "Not provided",
        icon: IconUser,
      },
      {
        label: "Blood Grp",
        value: user.bg || "Not provided",
        icon: IconHeart,
      },
      {
        label: "Address",
        value: user.address?.trim() || "Not provided",
        icon: IconMapPin,
        span: "sm:col-span-2 md:col-span-3",
      },
    );

    return rows.filter((row) => row.value);
  });

  function formatDate(value: string | null | undefined, monthOnly = false) {
    if (!value) return "Not provided";

    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return "Not provided";

    return new Intl.DateTimeFormat("en-IN", {
      day: monthOnly ? undefined : "numeric",
      month: monthOnly ? "long" : "short",
      year: "numeric",
    }).format(date);
  }

  async function logout() {
    if (signingOut) return;

    signingOut = true;
    try {
      const response = await client.api.auth.logout.$post(undefined, {
        init: { signal: AbortSignal.timeout(20_000) },
      });
      if (!response.ok) {
        throw new Error("Unable to sign out. Please try again.");
      }
      auth.clearUser();
      toast.success("Signed out successfully");
      // The session guard returns to the login page once the session clears.
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Unable to sign out. Please try again.",
      );
    } finally {
      signingOut = false;
    }
  }
</script>

<svelte:head>
  <title>Profile</title>
  <meta name="description" content="View your account details." />
</svelte:head>

{#snippet details(rows: Detail[])}
  <dl class="grid gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
    {#each rows as row (row.label)}
      {@const Icon = row.icon}
      <div
        class={[
          "flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 p-4",
          row.span,
        ]}
      >
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-primary ring-1 ring-border/70"
          aria-hidden="true"
        >
          <Icon class="size-4.5" />
        </div>
        <div class="min-w-0 flex-1">
          <dt
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {row.label}
          </dt>
          <dd
            class="mt-0.5 min-w-0 text-sm font-medium leading-normal wrap-anywhere"
          >
            {row.value}
          </dd>
        </div>
      </div>
    {/each}
  </dl>
{/snippet}

<main class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
  {#if user}
    <div class="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-8 lg:w-72 lg:shrink-0"
      >
        <Card.Root class="relative">
          <div
            class="absolute inset-x-0 top-0 h-20 bg-primary/10"
            aria-hidden="true"
          ></div>
          <Card.Header
            class="relative justify-items-center gap-3 pt-3 text-center"
          >
            <Avatar.Root class="size-24 ring-4 ring-card">
              {#if user.avatar}
                <Avatar.Image
                  src={user.avatar}
                  alt={`Profile photo of ${user.name}`}
                />
              {/if}
              <Avatar.Fallback>
                <span class="text-2xl font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </Avatar.Fallback>
            </Avatar.Root>
            <Card.Title class="text-xl font-semibold wrap-anywhere">
              {user.name}
            </Card.Title>
            <Card.Description class="wrap-anywhere">
              {user.email}
            </Card.Description>
          </Card.Header>
          <Card.Content
            class="flex-row flex-wrap items-center justify-center gap-2"
          >
            <Badge variant="secondary">{user.role}</Badge>
            {#if user.emailVerified}
              <IconRosetteDiscountCheckFilled
                class="size-4 text-chart-2"
                aria-hidden="true"
              />
            {/if}
          </Card.Content>
          <Card.Footer class="justify-center">
            <p class="text-xs text-muted-foreground">
              Member since {formatDate(user.createdAt, true)}
            </p>
          </Card.Footer>
        </Card.Root>
        <Button
          variant="outline"
          class="min-h-12 w-full"
          disabled={signingOut}
          onclick={logout}
        >
          {#if signingOut}
            <Spinner data-icon="inline-start" />
          {:else}
            <IconLogout data-icon="inline-start" aria-hidden="true" />
          {/if}
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col gap-6">
        <Card.Root>
          <Card.Header class="gap-1 px-4 sm:px-6">
            <Card.Title class="flex items-center gap-2">
              <IconUser class="size-4 text-primary/70" aria-hidden="true" />
              Profile details
            </Card.Title>
          </Card.Header>
          <Card.Content class="gap-6 px-4 sm:px-6">
            {@render details(profileDetails)}
          </Card.Content>
        </Card.Root>
        <Appearance />
      </div>
    </div>
  {/if}
</main>
