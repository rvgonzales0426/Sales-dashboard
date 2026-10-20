# Thesis System Template

A reusable Vue 3 + Supabase starter: auth, permission-based access control, an
app shell, and a design system that has been tuned rather than left at
defaults. Clone it per project and build the domain features on top — there is
no business logic in here.

Roles are **rows, not an enum**: an admin creates a role and ticks its
permissions in the app, with no deploy. Permissions are enforced by Postgres
RLS, so hiding a button is a courtesy and the database is the real gate.

**Stack:** Vue 3 (`<script setup>`, TypeScript) · Vuetify 3 · Supabase
(Postgres, Auth, RLS) · Pinia · Vue Router 4 · Vite.

---

## Setup

```bash
npm install
cp .env.example .env      # then fill in your Supabase URL + anon key
npm run dev
```

**1. Create a Supabase project** and copy the URL and anon key from
*Project settings → API* into `.env`.

**2. Run the migrations.** Paste `supabase/migrations/0001_profiles.sql` then
`0002_rls.sql` into the SQL editor, or `supabase db push` if you use the CLI.

**3. Sign up through the app**, then make yourself an admin:

```sql
update public.profiles
set role_id = (select id from public.roles where key = 'admin')
where email = 'you@example.com';
```

**4. (Optional) Deploy the invite function.** The Invite button on
*Users* needs it, because inviting requires the service-role key:

```bash
supabase functions deploy invite-user
```

Everything else works without it.

**5. Set your redirect URL.** In *Authentication → URL configuration*, add
`http://localhost:5173/reset-password` (and your production equivalent), or
password reset links will bounce.

---

## Architecture

Five layers, and each one has a single job. The auth and user-management code
is the worked example — copy its shape for every feature you add.

| Layer | Lives in | Does |
|---|---|---|
| **Page** | `src/pages/<area>/XView.vue` | Route wrapper. Header + a component. No logic. |
| **Component** | `src/components/<area>/` | List / display / CRUD UI for one area. |
| **Dialog** | `src/components/dialogs/` | Modals, kept out of the component that opens them. |
| **Composable** | `src/composables/useX.ts` | State, forms, drafts. **The business logic.** |
| **Store** | `src/stores/*.ts` | The only place that calls Supabase. |

Access control spans three places: `stores/roles.ts` owns the role and
permission data, `stores/auth.ts` holds the signed-in user's effective
permission set, and `has_permission()` in Postgres enforces it for real.

Three rules that keep it that way:

1. **No Supabase calls outside a Pinia store.** Ever. `grep -rn "@/lib/supabase" src/`
   should only ever return files in `src/stores/`.
2. **Every file under ~400 lines.** Past that, split it: pull the dialog into
   its own component, move logic into a composable, or break a fat composable
   apart by responsibility.
3. **Naming.** `PascalCase.vue` for components and dialogs, `useX.ts` for
   composables, one store per domain area.

### Adding a feature — the walkthrough

Say you're adding *Equipment* to an inventory project:

```
src/stores/equipment.ts                        # supabase.from('equipment')...
src/composables/useEquipment.ts                # list state, search, filters
src/composables/useEquipmentDetail.ts          # the edit draft
src/components/equipment/EquipmentList.vue     # table, empty state, skeleton
src/components/dialogs/EquipmentDialog.vue     # create / edit modal
src/pages/equipment/EquipmentView.vue          # <PageHeader/> + <EquipmentList/>
```

Then add the route (below) and a nav entry in `src/config/navigation.ts`.
`stores/users.ts` → `useUsers.ts` → `UserList.vue` → `UserEditDialog.vue` →
`UsersView.vue` is exactly this chain, already written.

---


---

## How access control works

Three layers, and only the last one actually stops anybody.

```
  routes.ts   meta: { permissions: ['users.read'] }   ← which pages render
  guards.ts   auth.canAny(to.meta.permissions)        ← client-side redirect
  Postgres    using (has_permission('users.read'))    ← the enforcement
```

A **permission** is a capability string like `users.write`, seeded by
migration because code and policies reference it. A **role** is a row holding
a bag of permissions, created at runtime. A user has one role.

Two flags on `roles` keep the system honest:

- `is_superuser` — holds every permission implicitly, *including ones added by
  a later migration*. The `admin` role has it, which is why you never have to
  remember to re-grant admin after adding a feature.
- `is_system` — cannot be deleted or have its key changed. Protects `admin`
  and `user`, the two roles the app itself depends on.

---

## How to add a new role

This is now a runtime action, not a code change.

**In the app:** Administration → Roles → *New role*. Name it, tick its
permissions, save. Assign it to people on the Users page. Nothing to deploy.

**In a migration**, if you want every clone of the template to start with it:

```sql
insert into public.roles (key, label, description, rank)
values ('adviser', 'Adviser', 'Reviews submissions but cannot manage accounts.', 50);

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r, public.permissions p
where r.key = 'adviser' and p.key in ('users.read');
```

Nothing in the client hard-codes a role name, so the picker, chips, filters
and member counts all pick it up on their own.

---

## How to add a new permission

This one *is* a code change, because policies and components reference the key.

**1. Seed the row** in a migration:

```sql
insert into public.permissions (key, label, description, category)
values ('reports.export', 'Export reports', 'Download report data as CSV.', 'Reports');
```

**2. Add the constant** in [`src/config/permissions.ts`](src/config/permissions.ts):

```ts
export const PERMISSIONS = {
  // ...
  ReportsExport: 'reports.export',
} as const
```

**3. Use it** — in a route, a component, or a policy:

```ts
meta: { permissions: ['reports.export'] }        // router/routes.ts
v-if="can(PERMISSIONS.ReportsExport)"            // any component
using (public.has_permission('reports.export'))  // RLS
```

**4. Grant it** to roles in the app. The `admin` role already has it, because
`is_superuser` covers permissions that did not exist when the role was made.

---

## How to add a new protected route

Add the record in [`src/router/routes.ts`](src/router/routes.ts), under the
`AppLayout` parent:

```ts
{
  path: 'equipment',
  name: 'equipment',
  component: () => import('@/pages/equipment/EquipmentView.vue'),
  meta: { title: 'Equipment', permissions: ['equipment.read'] },
},
```

- `meta.title` — the page label, breadcrumb, and document title.
- `meta.permissions` — holding **any one** of them gets you in. Omit it and any
  signed-in user can visit. Fail it and the guard sends you to `/403`.
- `meta.requiresAuth` is inherited from the layout route, so you don't repeat it.

Then add it to [`src/config/navigation.ts`](src/config/navigation.ts) so it
appears in the sidebar. The nav item's `permissions` only hides the link.

---

## How to extend the RLS pattern to a new table

The helpers in `0002_rls.sql` — `has_permission()`, `has_role()`, `is_admin()`,
`is_active_user()`, `current_role_key()` — exist so no policy ever needs its
own join against `profiles`. Copy this for each new table:

```sql
create table public.equipment (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table public.equipment enable row level security;

create policy equipment_select on public.equipment for select to authenticated
  using (owner_id = auth.uid() or public.has_permission('equipment.read'));

create policy equipment_insert on public.equipment for insert to authenticated
  with check (public.has_permission('equipment.write') and owner_id = auth.uid());

create policy equipment_update on public.equipment for update to authenticated
  using (owner_id = auth.uid() or public.has_permission('equipment.write'))
  with check (owner_id = auth.uid() or public.has_permission('equipment.write'));

create policy equipment_delete on public.equipment for delete to authenticated
  using (public.has_permission('equipment.write'));
```

Shared reference data (departments, categories, rooms) reads for everyone:

```sql
create policy equipment_select on public.equipment for select to authenticated
  using (public.is_active_user());
```

Three things worth knowing:

- The helpers are `SECURITY DEFINER` so they can read `profiles`, `roles` and
  `role_permissions` without tripping the policies they are used inside. A
  plain subquery against `profiles` in a `profiles` policy recurses forever.
- Prefer `has_permission()` over `has_role()`. A policy written against a
  capability survives someone renaming a role or inventing a new one;
  a policy written against `'admin'` does not.
- A policy cannot restrict *columns*. "Someone with users.write may edit this
  row but not their own role" needs a trigger — see `enforce_profile_rules()`.

---

## The design system

Not decoration — these are the decisions that keep it from looking generic, and
they are worth holding when you extend it.

**Palette** ([`src/plugins/vuetify.ts`](src/plugins/vuetify.ts)). Light is warm
paper `#F5F5F1` with white surfaces and a deep pine accent `#0F5C4C`; dark is
`#0D0F0E` with raised `#161917` surfaces and a mint accent `#4CC49E`. The dark
theme is designed, not inverted: the accent is a different step of the hue, and
surfaces get *lighter* as they rise.

**Radius carries hierarchy** — 6px on inputs, buttons and chips; 10px
(`.rounded-panel`) on cards and tables; 14px (`.rounded-overlay`) on dialogs and
menus. Not one radius on everything.

**Shadow means "floating."** In-page surfaces are flat with a 1px hairline
border. Only menus, dialogs and the snackbar get a shadow, and they all get the
same one. The app bar and sidebar separate by border.

**One motion budget** — 180ms on the sidebar collapse, a 120ms theme cross-fade.
Nothing else animates, and both respect `prefers-reduced-motion`.

**Component defaults over per-call props.** Buttons are sentence case and flat,
inputs are outlined and comfortable, ripples are off — all set once in the
`defaults` block. If you find yourself passing the same prop everywhere, it
belongs there instead.

**Copy.** Active voice, sentence case, and empty states that say what to do next
("Invite the first person and they will show up here"), never "No data".

**Chart colours** were validated for colour-vision-deficiency separation and
surface contrast in both themes (`--v-chart-1` … `--v-chart-4`). If you re-hue
them, re-validate.

---

## What's included

```
src/
├── components/
│   ├── app/          # sidebar, app bar, breadcrumbs, user menu, snackbar
│   ├── auth/         # login, register, forgot/reset password forms
│   ├── common/       # PageHeader, SectionCard, EmptyState, StatCard, skeletons
│   ├── dashboard/    # stat panel, SVG area chart, activity feed
│   ├── dialogs/      # UserEdit, UserInvite, RoleEdit, Confirm
│   ├── roles/        # RoleList
│   ├── settings/     # profile, security, appearance
│   └── users/        # UserList, UserRoleChip
├── composables/      # forms, drafts, list state, permissions, chart geometry
├── config/           # permissions.ts, roles.ts, navigation.ts
├── layouts/          # AppLayout (shell), AuthLayout (centred)
├── lib/supabase.ts   # the one client + error-message mapping
├── pages/            # thin route wrappers
├── plugins/vuetify.ts# themes + component defaults
├── router/           # routes.ts, guards.ts
├── stores/           # auth, roles, users, theme, ui — the only Supabase callers
└── styles/           # settings.scss (SASS vars), main.scss (global tuning)
supabase/
├── migrations/       # 0001_profiles.sql (schema + seed), 0002_rls.sql (policies)
└── functions/invite-user   # service-role invite, permission-checked
```

## Known limits

- **Invites** need the Edge Function deployed (`supabase functions deploy
  invite-user`). Everything else runs on the anon key alone.
- **One role per user.** `profiles.role_id` is a single reference. Multiple
  roles would mean a join table and a union in `has_permission()` — a contained
  change if a project needs it.
- **Permissions are cached at sign-in.** `my_permissions()` is called when the
  profile loads, so a role change reaches an already-open session on its next
  page load. RLS is always current regardless, so the worst case is a button
  that looks available and then fails.
- **Email changes** are out of scope — `profiles.email` follows `auth.users`
  through a trigger, but the UI doesn't offer to change it.
- **The dashboard is placeholder data.** `src/composables/useDashboard.ts` has a
  timeout where the store calls go; the file says so in a comment block.
