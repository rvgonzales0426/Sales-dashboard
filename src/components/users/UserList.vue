<script setup lang="ts">
import { onMounted } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import TableSkeleton from '@/components/common/TableSkeleton.vue'
import UserRoleChip from './UserRoleChip.vue'
import UserEditDialog from '@/components/dialogs/UserEditDialog.vue'
import UserInviteDialog from '@/components/dialogs/UserInviteDialog.vue'
import { useUsers } from '@/composables/useUsers'
import { usePermissions } from '@/composables/usePermissions'
import { PERMISSIONS } from '@/config/permissions'

const {
  loading,
  filtered,
  search,
  roleFilter,
  statusFilter,
  hasFilters,
  isFilteredEmpty,
  clearFilters,
  ensureLoaded,
  refresh,
  editing,
  inviteOpen,
  openEdit,
  closeEdit,
  isSelf,
  roleFilterItems,
} = useUsers()

const { can } = usePermissions()

onMounted(ensureLoaded)

const statusItems = [
  { value: 'all', title: 'All statuses' },
  { value: 'active', title: 'Active' },
  { value: 'inactive', title: 'Deactivated' },
]

const headers = [
  { title: 'Name', key: 'full_name', sortable: true },
  { title: 'Role', key: 'role', sortable: false, width: 140 },
  { title: 'Status', key: 'is_active', sortable: true, width: 130 },
  { title: 'Joined', key: 'created_at', sortable: true, width: 130 },
  { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 60 },
]

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <SectionCard
    title="People"
    description="Everyone with an account. Changing a role takes effect the next time they load a page."
    flush
  >
    <template #actions>
      <v-btn variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="refresh()">
        Refresh
      </v-btn>
      <v-btn
        v-if="can(PERMISSIONS.UsersInvite)"
        color="primary"
        prepend-icon="mdi-plus"
        @click="inviteOpen = true"
      >
        Invite
      </v-btn>
    </template>

    <div class="toolbar">
      <v-text-field
        v-model="search"
        placeholder="Search by name or email"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        clearable
        class="toolbar__search"
      />
      <v-select
        v-model="roleFilter"
        :items="roleFilterItems"
        density="compact"
        class="toolbar__filter"
      />
      <v-select
        v-model="statusFilter"
        :items="statusItems"
        density="compact"
        class="toolbar__filter"
      />
      <v-btn v-if="hasFilters" variant="text" size="small" @click="clearFilters">Clear</v-btn>
    </div>

    <TableSkeleton v-if="loading" :rows="6" :columns="4" />

    <EmptyState
      v-else-if="isFilteredEmpty"
      icon="mdi-filter-variant"
      title="No one matches those filters"
      description="Try a different role or status, or clear the filters to see everyone again."
    >
      <template #action>
        <v-btn variant="outlined" @click="clearFilters">Clear filters</v-btn>
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="!filtered.length"
      icon="mdi-account-multiple-outline"
      title="No accounts yet"
      description="Invite the first person and they will show up here once they accept."
    >
      <template #action>
        <v-btn v-if="can(PERMISSIONS.UsersInvite)" color="primary" @click="inviteOpen = true">
          Invite someone
        </v-btn>
      </template>
    </EmptyState>

    <v-data-table
      v-else
      :headers="headers"
      :items="filtered"
      item-value="id"
      class="user-table"
    >
      <template #item.full_name="{ item }">
        <div class="user-cell">
          <span class="user-cell__name">{{ item.full_name || 'Unnamed' }}</span>
          <span class="user-cell__email">{{ item.email }}</span>
        </div>
      </template>

      <template #item.role="{ item }">
        <UserRoleChip :role="item.role" />
      </template>

      <template #item.is_active="{ item }">
        <span class="status" :class="item.is_active ? 'status--on' : 'status--off'">
          <span class="status__dot" aria-hidden="true" />
          {{ item.is_active ? 'Active' : 'Deactivated' }}
        </span>
      </template>

      <template #item.created_at="{ item }">
        {{ formatDate(item.created_at) }}
      </template>

      <template #item.actions="{ item }">
        <v-btn
          v-if="can(PERMISSIONS.UsersWrite)"
          variant="text"
          size="small"
          :aria-label="`Edit access for ${item.email}`"
          @click="openEdit(item)"
        >
          <v-icon icon="mdi-pencil-outline" size="18" />
          <v-tooltip activator="parent" location="top">
            {{ isSelf(item) ? 'Your account' : 'Edit access' }}
          </v-tooltip>
        </v-btn>
      </template>
    </v-data-table>
  </SectionCard>

  <UserEditDialog
    :model-value="Boolean(editing)"
    :user="editing"
    @update:model-value="(value) => !value && closeEdit()"
    @saved="closeEdit"
  />

  <UserInviteDialog v-model="inviteOpen" />
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-color: rgb(var(--v-theme-surface-alt));
  flex-wrap: wrap;
}

.toolbar__search {
  flex: 1 1 240px;
  min-width: 200px;
}

.toolbar__filter {
  flex: 0 0 168px;
}

.user-cell {
  display: flex;
  flex-direction: column;
  padding-block: 6px;
}

.user-cell__name {
  font-weight: 500;
  font-size: 0.875rem;
}

.user-cell__email {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8125rem;
}

.status__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
}

.status--on .status__dot {
  background-color: rgb(var(--v-theme-success));
}

.status--off {
  color: rgb(var(--v-theme-text-secondary));
}

.status--off .status__dot {
  background-color: rgb(var(--v-chart-axis));
}

.table-footnote {
  padding: 12px 20px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}
</style>
