<script lang="ts">
  import { mode } from "mode-watcher";
  import {
    Toaster as Sonner,
    type ToasterProps as SonnerProps,
  } from "svelte-sonner";
  import IconLoader from "@tabler/icons-svelte/icons/loader";
  import IconCircleCheck from "@tabler/icons-svelte/icons/circle-check";
  import IconAlertOctagon from "@tabler/icons-svelte/icons/alert-octagon";
  import IconInfoCircle from "@tabler/icons-svelte/icons/info-circle";
  import IconAlertTriangle from "@tabler/icons-svelte/icons/alert-triangle";

  let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
  theme={mode.current}
  class="toaster group"
  style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
  toastOptions={{
    classes: {
      toast: "cn-toast",
      description: "whitespace-pre-line",
    },
  }}
  {...restProps}
>
  {#snippet loadingIcon()}
    <IconLoader class="size-4 animate-spin" />
  {/snippet}
  {#snippet successIcon()}
    <IconCircleCheck class="size-4" />
  {/snippet}
  {#snippet errorIcon()}
    <IconAlertOctagon class="size-4" />
  {/snippet}
  {#snippet infoIcon()}
    <IconInfoCircle class="size-4" />
  {/snippet}
  {#snippet warningIcon()}
    <IconAlertTriangle class="size-4" />
  {/snippet}
</Sonner>
