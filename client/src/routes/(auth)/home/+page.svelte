<script lang="ts">
  import { onMount } from "svelte";
  import { now } from "@internationalized/date";
  import IconCalendarCheck from "@tabler/icons-svelte/icons/calendar-check";
  import { client } from "#lib/api.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import { schoolDate } from "#lib/validation.js";
  import * as Card from "#lib/components/ui/card/index.js";
  import { Badge } from "#lib/components/ui/badge/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import StatusBadge from "#lib/components/StatusBadge.svelte";
  import type { AttendanceStatus } from "#lib/status.js";

  type Status = AttendanceStatus;

  const today = $derived(auth.schoolDate || schoolDate());
  const hour = now("Asia/Kolkata").hour;
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const isStudent = $derived(auth.user?.role === "STUDENT");
  const firstName = $derived(auth.user?.name.trim().split(/\s+/)[0] ?? "there");
  const classOrRole = $derived.by(() => {
    // Principals/admins have no team, so skip the team lookup for them.
    if (auth.user?.role === "PRINCIPAL" || auth.user?.role === "ADMIN") {
      return auth.user.role;
    }
    const teamName =
      auth.user?.teamMember?.team.name?.trim() ??
      auth.user?.ledTeams?.[0]?.name?.trim();
    if (teamName) {
      return teamName.toLowerCase().startsWith("class")
        ? teamName
        : `Class ${teamName}`;
    }
    return auth.user?.role ?? "—";
  });

  let todayStatus = $state<Status | null>(null);
  let loading = $state(true);
  let errorMessage = $state("");

  async function load() {
    loading = true;
    errorMessage = "";
    try {
      const response = await client.api.attendance.me.$get({
        query: { from: today, to: today },
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Unable to load today's attendance");
      }
      todayStatus = result.data.records[0]?.status ?? null;
    } catch (error) {
      todayStatus = null;
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (isStudent) void load();
  });
</script>

<svelte:head>
  <title>Home</title>
  <meta name="description" content="Your home overview." />
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
  <Card.Root>
    <Card.Header class="gap-1 px-4 sm:px-6">
      <Card.Title class="flex flex-wrap items-center justify-between gap-2">
        <span>{greeting}, {firstName}</span>
        <Badge variant="outline" class="px-3 py-1 tracking-wide uppercase">
          {classOrRole}
        </Badge>
      </Card.Title>
    </Card.Header>
  </Card.Root>

  {#if isStudent}
    <Card.Root>
      <Card.Header class="gap-1 px-4 sm:px-6">
        <Card.Title class="flex items-center gap-2">
          <IconCalendarCheck class="size-4 text-primary/70" aria-hidden="true" />
          Today
        </Card.Title>
      </Card.Header>
      <Card.Content class="gap-4 px-4 sm:px-6">
        {#if loading}
          <div
            role="status"
            class="flex flex-col items-center justify-center gap-3 px-4 py-10 text-muted-foreground"
          >
            <Spinner
              class="size-6 text-primary"
              role="presentation"
              aria-hidden="true"
            />
            <p class="text-sm">Loading attendance…</p>
          </div>
        {:else if errorMessage}
          <div class="space-y-3">
            <p role="alert">{errorMessage}</p>
            <Button
              variant="outline"
              class="min-h-11"
              onclick={() => void load()}>Try again</Button
            >
          </div>
        {:else if todayStatus}
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/20 px-4 py-3"
          >
            <StatusBadge status={todayStatus} />
            <span class="text-sm text-muted-foreground"
              >(marked by teacher)</span
            >
          </div>
        {:else}
          <div class="rounded-lg border bg-muted/20 px-4 py-3">
            <Badge variant="secondary">Not marked yet</Badge>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</main>
