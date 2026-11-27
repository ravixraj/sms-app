<script lang="ts">
  import type { LayoutProps } from "./$types";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import { Dock, DockIcon } from "#lib/components/ui/dock/index.js";
  import { Tooltip } from "bits-ui";
  import {
    IconUser,
    IconHome,
    IconCalendarCheck,
    IconCalendarMinus,
    IconSchool,
    IconClipboardList,
  } from "@tabler/icons-svelte";

  let { children }: LayoutProps = $props();

  const pathname = $derived(page.url.pathname);

  const redirectTo = $derived.by((): "/" | "/(auth)/profile" | null => {
    if (auth.loading) return null;
    if (!auth.isAuthenticated) return "/";
    if (pathname === "/admin" && !auth.isAdmin) return "/(auth)/profile";
    return null;
  });

  const redirectHref = $derived(redirectTo ? resolve(redirectTo) : null);

  $effect(() => {
    if (redirectHref) void goto(redirectHref, { replace: true });
  });

  onMount(() => {
    if (auth.loading) void auth.checkAuth();
  });
</script>

{#snippet dockLink(
  href: string,
  label: string,
  Icon: typeof IconUser,
  current: boolean,
)}
  <DockIcon>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            {href}
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-current={current ? "page" : undefined}
            class="size-full rounded-full text-muted-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-primary"
          >
            <Icon aria-hidden="true" class="size-5" stroke={1.75} />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={10}
          class="z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </DockIcon>
{/snippet}

{#if !auth.loading && auth.isAuthenticated && !redirectTo}
  {@render children()}
  {#if auth.user}
    <div
      class="h-[calc(5rem+env(safe-area-inset-bottom))]"
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center"
    >
      <div class="pointer-events-auto max-w-full">
        <Tooltip.Provider delayDuration={200}>
          <Dock aria-label="App navigation" iconSize={44}>
            {@render dockLink(
              resolve("/(auth)/home"),
              "Home",
              IconHome,
              pathname === "/home",
            )}
            {#if auth.user.role === "TEACHER" || auth.user.role === "STUDENT"}
              {@render dockLink(
                resolve("/(auth)/attendance"),
                "Attendance",
                IconCalendarCheck,
                pathname === "/attendance",
              )}
            {/if}
            {#if auth.user.role === "STUDENT" || auth.user.role === "TEACHER"}
              {@render dockLink(
                resolve("/(auth)/leave"),
                "Leave",
                IconCalendarMinus,
                pathname === "/leave",
              )}
            {/if}
            {#if auth.user.role === "PRINCIPAL"}
              {@render dockLink(
                resolve("/(auth)/leave"),
                "Leave requests",
                IconClipboardList,
                pathname === "/leave",
              )}
            {/if}
            {#if auth.isAdmin}
              {@render dockLink(
                resolve("/(auth)/admin"),
                "Admin workspace",
                IconSchool,
                pathname === "/admin",
              )}
            {/if}
            {@render dockLink(
              resolve("/(auth)/profile"),
              "Profile",
              IconUser,
              pathname === "/profile" && !page.url.hash,
            )}
          </Dock>
        </Tooltip.Provider>
      </div>
    </div>
  {/if}
{:else}
  <div
    class="flex min-h-svh items-center justify-center"
    role="status"
    aria-label="Loading"
  >
    <Spinner class="size-6" />
  </div>
{/if}
