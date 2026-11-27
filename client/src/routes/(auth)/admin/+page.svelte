<script lang="ts">
  import DatePicker from "#lib/components/DatePicker.svelte";
  import type { Snippet } from "svelte";
  import { toast } from "svelte-sonner";
  import { client } from "#lib/api.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import {
    schoolDate,
    addTeamMemberSchema,
    deleteTeamMemberSchema,
    createTeamSchema,
    createUserSchema,
    deleteOrgSchema,
    orgSchema,
    updateTeamSchema,
  } from "#lib/validation.js";
  import { handleZodError } from "#lib/handleZodError.js";
  import * as Card from "#lib/components/ui/card/index.js";
  import * as Field from "#lib/components/ui/field/index.js";
  import * as Dialog from "#lib/components/ui/dialog/index.js";
  import * as Select from "#lib/components/ui/select/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Textarea } from "#lib/components/ui/textarea/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import IconBuildingCommunity from "@tabler/icons-svelte/icons/building-community";
  import IconUserPlus from "@tabler/icons-svelte/icons/user-plus";
  import IconUsersGroup from "@tabler/icons-svelte/icons/users-group";
  import IconUserShare from "@tabler/icons-svelte/icons/user-share";
  import IconTrash from "@tabler/icons-svelte/icons/trash";
  import IconEdit from "@tabler/icons-svelte/icons/edit";
  import IconShieldCheck from "@tabler/icons-svelte/icons/shield-check";

  type ConfirmAction = "deleteOrg" | "removeMember";

  let confirmAction = $state<ConfirmAction | null>(null);
  let confirmOpen = $state(false);

  function askConfirm(action: ConfirmAction) {
    confirmAction = action;
    confirmOpen = true;
  }

  function closeConfirm() {
    confirmOpen = false;
    confirmAction = null;
  }

  // Shared dialog state, ordered to match the cards below.
  let open = $state({
    createOrg: false,
    deleteOrg: false,
    createTeam: false,
    updateTeam: false,
    addMember: false,
    removeMember: false,
    createUser: false,
  });
  const pending = $state({
    createOrg: false,
    deleteOrg: false,
    createTeam: false,
    updateTeam: false,
    addMember: false,
    removeMember: false,
    createUser: false,
  });
  // --- Create school ---
  let orgName = $state("");
  let metadata = $state("");

  async function createSchool() {
    if (pending.createOrg) return;
    pending.createOrg = true;
    try {
      const input = handleZodError(
        orgSchema.safeParse({
          name: orgName,
          metadata: metadata.trim() || null,
        }),
      );
      const response = await client.api.admin.org.$post(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success("School created", { description: result.data.id });
      orgName = "";
      metadata = "";
      open.createOrg = false;
    } catch (error) {
      toast.error("Unable to create school.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.createOrg = false;
    }
  }

  // --- Delete school ---
  let orgId = $state("");

  function requestDeleteSchool(event: SubmitEvent) {
    event.preventDefault();
    if (pending.deleteOrg) return;
    handleZodError(deleteOrgSchema.safeParse({ orgid: orgId }));
    askConfirm("deleteOrg");
  }

  async function performDeleteSchool() {
    closeConfirm();
    if (pending.deleteOrg) return;
    pending.deleteOrg = true;
    try {
      const input = handleZodError(deleteOrgSchema.safeParse({ orgid: orgId }));
      const response = await client.api.admin.org.$delete(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success("School deleted");
      orgId = "";
      open.deleteOrg = false;
    } catch (error) {
      toast.error("Unable to delete school.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.deleteOrg = false;
    }
  }

  // --- Create team ---
  let teamOrgId = $state("");
  let teamName = $state("");
  let leaderId = $state("");

  async function createTeam() {
    if (pending.createTeam) return;
    pending.createTeam = true;
    try {
      const input = handleZodError(
        createTeamSchema.safeParse({
          name: teamName,
          orgid: teamOrgId,
          leaderId,
        }),
      );
      const response = await client.api.admin.team.$post(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success("Team created", { description: result.data.id });
      teamName = "";
      teamOrgId = "";
      leaderId = "";
      open.createTeam = false;
    } catch (error) {
      toast.error("Unable to create team.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.createTeam = false;
    }
  }

  // --- Update team ---
  let updateOrgId = $state("");
  let updateTeamId = $state("");
  let updateName = $state("");
  let updateLeaderId = $state("");

  async function updateTeam() {
    if (pending.updateTeam) return;
    pending.updateTeam = true;
    try {
      const input = handleZodError(
        updateTeamSchema.safeParse({
          orgid: updateOrgId,
          teamId: updateTeamId,
          ...(updateName.trim() ? { name: updateName } : {}),
          ...(updateLeaderId.trim() ? { leaderId: updateLeaderId } : {}),
        }),
      );
      const response = await client.api.admin.team.$patch(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success("Team updated");
      updateOrgId = "";
      updateTeamId = "";
      updateName = "";
      updateLeaderId = "";
      open.updateTeam = false;
    } catch (error) {
      toast.error("Unable to update team.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.updateTeam = false;
    }
  }

  // --- Add team member ---
  let memberTeamId = $state("");
  let memberUserId = $state("");

  async function addTeamMember() {
    if (pending.addMember) return;
    pending.addMember = true;
    try {
      const input = handleZodError(
        addTeamMemberSchema.safeParse({
          teamId: memberTeamId,
          userId: memberUserId,
        }),
      );
      const response = await client.api.admin.team.member.$post(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success("Member added to team");
      memberTeamId = "";
      memberUserId = "";
      open.addMember = false;
    } catch (error) {
      toast.error("Unable to add team member.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.addMember = false;
    }
  }

  // --- Remove team member ---
  let removeMemberTeamId = $state("");
  let removeMemberUserId = $state("");
  let removeMemberOrgId = $state("");

  function requestRemoveTeamMember() {
    if (pending.removeMember) return;
    handleZodError(
      deleteTeamMemberSchema.safeParse({
        teamId: removeMemberTeamId,
        userId: removeMemberUserId,
        orgid: removeMemberOrgId,
      }),
    );
    askConfirm("removeMember");
  }

  async function performRemoveTeamMember() {
    closeConfirm();
    if (pending.removeMember) return;
    pending.removeMember = true;
    try {
      const input = handleZodError(
        deleteTeamMemberSchema.safeParse({
          teamId: removeMemberTeamId,
          userId: removeMemberUserId,
          orgid: removeMemberOrgId,
        }),
      );
      const response = await client.api.admin.team.member.$delete(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success("Member removed from team");
      removeMemberTeamId = "";
      removeMemberUserId = "";
      removeMemberOrgId = "";
      open.removeMember = false;
    } catch (error) {
      toast.error("Unable to remove team member.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.removeMember = false;
    }
  }

  // --- Create user ---
  let userName = $state("");
  let email = $state("");
  let password = $state("");
  let role = $state<"STUDENT" | "TEACHER" | "PRINCIPAL" | "ADMIN">("STUDENT");
  let userOrgId = $state("");
  let gender = $state<"MALE" | "FEMALE" | "OTHER">("OTHER");
  let bg = $state<"A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-">(
    "O+",
  );
  let dob = $state("");
  let address = $state("");
  let avatar = $state<File | null>(null);

  async function createUser(event: SubmitEvent) {
    event.preventDefault();
    if (pending.createUser) return;
    pending.createUser = true;
    try {
      const input = handleZodError(
        createUserSchema.safeParse({
          name: userName,
          email,
          password,
          role,
          orgid: role === "ADMIN" ? null : userOrgId,
          gender,
          bg,
          dob,
          address,
          ...(avatar ? { avatar } : {}),
        }),
      );
      const response = await client.api.admin.user.$post(
        {
          form: {
            name: input.name,
            email: input.email,
            password: input.password,
            role: input.role,
            orgid: input.orgid ?? "",
            gender: input.gender,
            bg: input.bg,
            dob: input.dob,
            address: input.address,
            ...(input.avatar ? { avatar: input.avatar } : {}),
          },
        },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success("User created successfully", {
        description: result.data.user.id,
      });
      open.createUser = false;
      userName = "";
      email = "";
      password = "";
      role = "STUDENT";
      userOrgId = "";
      gender = "OTHER";
      bg = "O+";
      dob = "";
      address = "";
      avatar = null;
    } catch (error) {
      toast.error("Unable to create user.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.createUser = false;
    }
  }

  function setAvatar(event: Event) {
    avatar = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
  }
</script>

<svelte:head>
  <title>Admin</title>
  <meta name="description" content="Manage users and teams." />
</svelte:head>

{#snippet adminDialog(
  Icon: typeof IconBuildingCommunity,
  key: keyof typeof open,
  title: string,
  description: string,
  form: Snippet,
)}
  <Dialog.Root bind:open={open[key]}>
    <Dialog.Trigger>
      {#snippet child({ props })}
        <Button {...props} class="min-h-12 w-full">
          <Icon data-icon="inline-start" />
          {title}
        </Button>
      {/snippet}
    </Dialog.Trigger>
    <Dialog.Content class="max-h-svh overflow-y-auto sm:max-w-lg">
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-2">
          <Icon class="size-4" />
          {title}
        </Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
      </Dialog.Header>
      {@render form()}
    </Dialog.Content>
  </Dialog.Root>
{/snippet}

{#snippet orgForm()}
  <form
    class="grid gap-4"
    onsubmit={(event) => {
      event.preventDefault();
      void createSchool();
    }}
  >
    <Field.Field
      ><Field.FieldLabel for="org-name">School name</Field.FieldLabel><Input
        id="org-name"
        bind:value={orgName}
        minlength={2}
        maxlength={50}
        placeholder="Enter school name"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="org-metadata"
        >Notes <span class="font-normal text-muted-foreground">(optional)</span
        ></Field.FieldLabel
      ><Textarea
        id="org-metadata"
        bind:value={metadata}
        maxlength={500}
        rows={3}
        placeholder="Location, contact, or other context"
      /></Field.Field
    >
    <Dialog.Footer>
      <Button type="submit" disabled={pending.createOrg || !orgName.trim()}>
        {#if pending.createOrg}<Spinner data-icon="inline-start" />{/if}
        {pending.createOrg ? "Creating…" : "Create school"}
      </Button>
    </Dialog.Footer>
  </form>
{/snippet}

{#snippet deleteOrgForm()}
  <form class="grid gap-4" onsubmit={requestDeleteSchool}>
    <Field.Field
      ><Field.FieldLabel for="delete-org-id">School ID</Field.FieldLabel><Input
        id="delete-org-id"
        bind:value={orgId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Dialog.Footer>
      <Button
        variant="destructive"
        type="submit"
        disabled={pending.deleteOrg || !orgId.trim()}
      >
        {#if pending.deleteOrg}<Spinner data-icon="inline-start" />{/if}
        {pending.deleteOrg ? "Deleting…" : "Delete school"}
      </Button>
    </Dialog.Footer>
  </form>
{/snippet}

{#snippet teamForm()}
  <form
    class="grid gap-4"
    onsubmit={(event) => {
      event.preventDefault();
      void createTeam();
    }}
  >
    <Field.Field
      ><Field.FieldLabel for="team-name">Team name</Field.FieldLabel><Input
        id="team-name"
        bind:value={teamName}
        minlength={2}
        maxlength={50}
        placeholder="Enter Team Name"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="team-org">School ID</Field.FieldLabel><Input
        id="team-org"
        bind:value={teamOrgId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="team-leader">Teacher leader ID</Field.FieldLabel
      ><Input
        id="team-leader"
        bind:value={leaderId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Dialog.Footer>
      <Button type="submit" disabled={pending.createTeam || !teamName.trim()}>
        {#if pending.createTeam}<Spinner data-icon="inline-start" />{/if}
        {pending.createTeam ? "Creating…" : "Create team"}
      </Button>
    </Dialog.Footer>
  </form>
{/snippet}

{#snippet updateTeamForm()}
  <form
    class="grid gap-4"
    onsubmit={(event) => {
      event.preventDefault();
      void updateTeam();
    }}
  >
    <Field.Field
      ><Field.FieldLabel for="update-org">School ID</Field.FieldLabel><Input
        id="update-org"
        bind:value={updateOrgId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="update-team-id">Team ID</Field.FieldLabel><Input
        id="update-team-id"
        bind:value={updateTeamId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="update-team-name"
        >New name <span class="font-normal text-muted-foreground"
          >(optional)</span
        ></Field.FieldLabel
      ><Input
        id="update-team-name"
        bind:value={updateName}
        placeholder="Enter a new team name"
        minlength={2}
        maxlength={50}
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="update-leader"
        >New teacher leader ID <span class="font-normal text-muted-foreground"
          >(optional)</span
        ></Field.FieldLabel
      ><Input
        id="update-leader"
        bind:value={updateLeaderId}
        placeholder="UUID"
      /></Field.Field
    >
    <Dialog.Footer>
      <Button
        type="submit"
        disabled={pending.updateTeam ||
          (!updateName.trim() && !updateLeaderId.trim())}
      >
        {#if pending.updateTeam}<Spinner data-icon="inline-start" />{/if}
        {pending.updateTeam ? "Saving…" : "Save team changes"}
      </Button>
    </Dialog.Footer>
  </form>
{/snippet}

{#snippet memberForm()}
  <form
    class="grid gap-4"
    onsubmit={(event) => {
      event.preventDefault();
      void addTeamMember();
    }}
  >
    <Field.Field
      ><Field.FieldLabel for="member-team-id">Team ID</Field.FieldLabel><Input
        id="member-team-id"
        bind:value={memberTeamId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="member-user-id">User ID</Field.FieldLabel><Input
        id="member-user-id"
        bind:value={memberUserId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Dialog.Footer>
      <Button type="submit" disabled={pending.addMember}>
        {#if pending.addMember}<Spinner data-icon="inline-start" />{/if}
        {pending.addMember ? "Adding…" : "Add member"}
      </Button>
    </Dialog.Footer>
  </form>
{/snippet}

{#snippet removeMemberForm()}
  <form
    class="grid gap-4"
    onsubmit={(event) => {
      event.preventDefault();
      requestRemoveTeamMember();
    }}
  >
    <Field.Field
      ><Field.FieldLabel for="remove-member-org">School ID</Field.FieldLabel
      ><Input
        id="remove-member-org"
        bind:value={removeMemberOrgId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="remove-member-team-id">Team ID</Field.FieldLabel
      ><Input
        id="remove-member-team-id"
        bind:value={removeMemberTeamId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Field.Field
      ><Field.FieldLabel for="remove-member-user-id">User ID</Field.FieldLabel
      ><Input
        id="remove-member-user-id"
        bind:value={removeMemberUserId}
        placeholder="UUID"
        required
      /></Field.Field
    >
    <Dialog.Footer>
      <Button
        variant="destructive"
        type="submit"
        disabled={pending.removeMember}
      >
        {#if pending.removeMember}<Spinner data-icon="inline-start" />{/if}
        {pending.removeMember ? "Removing…" : "Remove member"}
      </Button>
    </Dialog.Footer>
  </form>
{/snippet}

{#snippet userForm()}
  <form class="grid gap-4" onsubmit={createUser}>
    <Field.FieldGroup class="grid gap-4 sm:grid-cols-2">
      <Field.Field
        ><Field.FieldLabel for="user-name">Full name</Field.FieldLabel><Input
          id="user-name"
          bind:value={userName}
          minlength={2}
          maxlength={100}
          required
        /></Field.Field
      >
      <Field.Field
        ><Field.FieldLabel for="user-email">Email</Field.FieldLabel><Input
          id="user-email"
          bind:value={email}
          type="email"
          maxlength={254}
          required
        /></Field.Field
      >
      <Field.Field
        ><Field.FieldLabel for="user-password">Password</Field.FieldLabel><Input
          id="user-password"
          bind:value={password}
          type="password"
          minlength={8}
          maxlength={50}
          autocomplete="new-password"
          required
        /></Field.Field
      >
      <Field.Field
        ><Field.FieldLabel for="user-role">Role</Field.FieldLabel><Select.Root
          type="single"
          bind:value={role}
        >
          <Select.Trigger id="user-role" class="h-12 w-full" aria-label="Role">
            {role}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each ["STUDENT", "TEACHER", "PRINCIPAL", "ADMIN"] as value (value)}
                <Select.Item {value} label={value}>{value}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root></Field.Field
      >
      {#if role !== "ADMIN"}<Field.Field class="sm:col-span-2"
          ><Field.FieldLabel for="user-org">School ID</Field.FieldLabel><Input
            id="user-org"
            bind:value={userOrgId}
            placeholder="UUID"
            required
          /></Field.Field
        >{/if}
      <Field.Field
        ><Field.FieldLabel for="user-gender">Gender</Field.FieldLabel
        ><Select.Root type="single" bind:value={gender}>
          <Select.Trigger
            id="user-gender"
            class="h-12 w-full"
            aria-label="Gender"
          >
            {gender}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each ["MALE", "FEMALE", "OTHER"] as value (value)}
                <Select.Item {value} label={value}>{value}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root></Field.Field
      >
      <Field.Field
        ><Field.FieldLabel for="user-bg">Blood Grp</Field.FieldLabel
        ><Select.Root type="single" bind:value={bg}>
          <Select.Trigger id="user-bg" class="h-12 w-full" aria-label="BG">
            {bg}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as group (group)}
                <Select.Item value={group} label={group}>{group}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root></Field.Field
      >
      <Field.Field
        ><Field.FieldLabel for="user-dob">Date of birth</Field.FieldLabel
        ><DatePicker
          id="user-dob"
          value={dob}
          max={auth.schoolDate || schoolDate()}
          label="Date of birth"
          onchange={(value) => (dob = value)}
        /></Field.Field
      >
      <Field.Field
        ><Field.FieldLabel for="user-avatar"
          >Avatar <span class="font-normal text-muted-foreground"
            >(optional, max 100 KB)</span
          ></Field.FieldLabel
        ><input
          id="user-avatar"
          type="file"
          accept="image/*"
          onchange={setAvatar}
          class="block min-h-12 w-full rounded-md border border-input bg-background p-1.5 text-sm text-muted-foreground file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        /></Field.Field
      >
      <Field.Field class="sm:col-span-2"
        ><Field.FieldLabel for="user-address">Address</Field.FieldLabel
        ><Textarea
          id="user-address"
          bind:value={address}
          maxlength={1000}
          rows={2}
          required
        /></Field.Field
      >
    </Field.FieldGroup>
    <Dialog.Footer>
      <Button type="submit" disabled={pending.createUser}>
        {#if pending.createUser}<Spinner data-icon="inline-start" />{/if}
        {pending.createUser ? "Creating…" : "Create user"}
      </Button>
    </Dialog.Footer>
  </form>
{/snippet}

<main
  class="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 sm:py-10 lg:px-8"
>
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <IconShieldCheck class="size-4 text-primary/70" aria-hidden="true" />
        Admin
      </Card.Title>
      <Card.Description>
        Manage schools, accounts, teams, and team membership.
      </Card.Description>
    </Card.Header>
    <Card.Content
      class="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4"
    >
      {@render adminDialog(
        IconBuildingCommunity,
        "createOrg",
        "Create school",
        "Create a school and capture its ID for the next setup steps.",
        orgForm,
      )}
      {@render adminDialog(
        IconTrash,
        "deleteOrg",
        "Delete school",
        "Delete a school and all of its related data.",
        deleteOrgForm,
      )}
      {@render adminDialog(
        IconUsersGroup,
        "createTeam",
        "Create team",
        "Create a team in a school.",
        teamForm,
      )}
      {@render adminDialog(
        IconEdit,
        "updateTeam",
        "Update team",
        "Enter the school and team IDs, then provide a new name, a teacher leader ID, or both.",
        updateTeamForm,
      )}
      {@render adminDialog(
        IconUserShare,
        "addMember",
        "Add team member",
        "Add a user to a team in the same school.",
        memberForm,
      )}
      {@render adminDialog(
        IconTrash,
        "removeMember",
        "Remove team member",
        "Remove a user from a team in the same school.",
        removeMemberForm,
      )}
      {@render adminDialog(
        IconUserPlus,
        "createUser",
        "Create user",
        "Create an account with its profile details.",
        userForm,
      )}
    </Card.Content>
  </Card.Root>
</main>

<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <IconTrash class="size-4 text-destructive" aria-hidden="true" />
        {confirmAction === "deleteOrg"
          ? "Delete school?"
          : "Remove team member?"}
      </Dialog.Title>
      <Dialog.Description>
        {confirmAction === "deleteOrg"
          ? "This deletes the school and all its related data. This cannot be undone."
          : "This removes the user from the team. This cannot be undone."}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="ghost" onclick={closeConfirm}>Cancel</Button>
      <Button
        variant="destructive"
        disabled={!confirmAction}
        onclick={() => {
          if (confirmAction === "deleteOrg") void performDeleteSchool();
          else if (confirmAction === "removeMember")
            void performRemoveTeamMember();
        }}
      >
        {confirmAction === "deleteOrg" ? "Delete school" : "Remove member"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
