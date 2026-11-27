<script lang="ts">
  import { auth } from "#lib/stores/auth.svelte.js";
  import PrincipalLeaveRequests from "#lib/components/PrincipalLeaveRequests.svelte";
  import MyLeaveRequests from "#lib/components/MyLeaveRequests.svelte";

  const canApply = $derived(
    auth.user?.role === "STUDENT" || auth.user?.role === "TEACHER",
  );
  const isPrincipal = $derived(auth.user?.role === "PRINCIPAL");
</script>

<svelte:head>
  <title>Leave</title>
  <meta name="description" content="Manage your leave requests." />
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
  {#if isPrincipal}
    <PrincipalLeaveRequests />
  {:else if canApply}
    <MyLeaveRequests />
  {/if}
</main>
