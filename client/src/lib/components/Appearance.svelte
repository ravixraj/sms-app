<script lang="ts">
  import { setMode, userPrefersMode } from "mode-watcher";
  import IconSun from "@tabler/icons-svelte/icons/sun";
  import IconMoon from "@tabler/icons-svelte/icons/moon";
  import IconDeviceDesktop from "@tabler/icons-svelte/icons/device-desktop";
  import IconPalette from "@tabler/icons-svelte/icons/palette";
  import * as Card from "#lib/components/ui/card/index.js";
  import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";

  const themes = [
    { value: "light", label: "Light", icon: IconSun },
    { value: "dark", label: "Dark", icon: IconMoon },
    { value: "system", label: "System", icon: IconDeviceDesktop },
  ] satisfies {
    value: "light" | "dark" | "system";
    label: string;
    icon: typeof IconSun;
  }[];

  const isTheme = (value: string): value is (typeof themes)[number]["value"] =>
    themes.some((theme) => theme.value === value);
</script>

<Card.Root id="appearance">
  <Card.Header class="gap-1 px-4 sm:px-6">
    <Card.Title class="flex items-center gap-2">
      <IconPalette class="size-4 text-primary/70" aria-hidden="true" />
      Appearance
    </Card.Title>
    <Card.Description>Choose a theme, or follow your device.</Card.Description>
  </Card.Header>
  <Card.Content class="px-4 sm:px-6">
    <ToggleGroup.Root
      type="single"
      variant="outline"
      class="w-full"
      aria-label="Color theme"
      value={userPrefersMode.current}
      onValueChange={(value) => {
        if (isTheme(value)) setMode(value);
      }}
    >
      {#each themes as theme (theme.value)}
        {@const Icon = theme.icon}
        <ToggleGroup.Item
          value={theme.value}
          class="min-h-11 flex-1 gap-2"
          aria-label={`${theme.label} theme`}
        >
          <Icon aria-hidden="true" />
          {theme.label}
        </ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
  </Card.Content>
</Card.Root>
