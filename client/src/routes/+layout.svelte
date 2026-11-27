<script lang="ts">
  import "./layout.css";
  import favicon from "#lib/assets/favicon.svg";
  import type { LayoutProps } from "./$types";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "#lib/components/ui/sonner/index.js";

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher defaultMode="system" />
<Toaster richColors closeButton position="top-right" />

{@render children()}
