<script setup lang="ts">
import { onMounted } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import TableSkeleton from '@/components/common/TableSkeleton.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import RoleEditDialog from '@/components/dialogs/RoleEditDialog.vue'
import { useRoles } from '@/composables/useRoles'
import { usePermissions } from '@/composables/usePermissions'
import { PERMISSIONS } from '@/config/permissions'
import { roleColor } from '@/config/roles'

const {
  filtered,
  loading,
  search,
  editing,
  creating,
  confirmingDelete,
  deleting,
  confirmDelete,
  ensureLoaded,
  permissionCount,
  memberCount,
  openEdit,
  closeEdit,
} = useRoles()

const { can } = usePermissions()

onMounted(ensureLoaded)

function closeDialog(open: boolean) {
  if (open) return
  closeEdit()
  creating.value = false
}
</script>

<template>
  <SectionCard
    title="Roles"
    description="A role is a named bundle of permissions. Change what a role can do and everyone holding it is affected immediately."
    flush
  >
    <template #actions>
      <v-btn
        v-if="can(PERMISSIONS.RolesWrite)"
        color="primary"
        prepend-icon="mdi-plus"
        @click="creating = true"
      >
        New role
      </v-btn>
    </template>

    <div class="toolbar">
      <v-text-field
        v-model="search"
        placeholder="Search roles"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        clearable
      />
    </div>

    <TableSkeleton v-if="loading" :rows="3" :columns="3" />

    <EmptyState
      v-else-if="!filtered.length"
      icon="mdi-shield-key-outline"
      title="No roles match that search"
      description="Clear the search box to see every role, or create one for the job you have in mind."
    />

    <ul v-else class="roles">
      <li v-for="role in filtered" :key="role.id" class="roles__row">
        <div class="roles__main">
          <div class="roles__head">
            <v-chip :color="roleColor(role)" size="small" variant="tonal">{{ role.label }}</v-chip>
            <span v-if="role.is_system" class="roles__badge">Built in</span>
          </div>
          <p v-if="role.description" class="roles__description">{{ role.description }}</p>
        </div>

        <div class="roles__meta">
          <span>
            {{ role.is_superuser ? 'Every permission' : `${permissionCount(role)} permissions` }}
          </span>
          <span class="roles__dot" aria-hidden="true" />
          <span>{{ memberCount(role) }} {{ memberCount(role) === 1 ? 'person' : 'people' }}</span>
        </div>

        <div class="roles__actions">
          <v-btn
            v-if="can(PERMISSIONS.RolesWrite)"
            variant="text"
            size="small"
            :aria-label="`Edit ${role.label}`"
            @click="openEdit(role)"
          >
            <v-icon icon="mdi-pencil-outline" size="18" />
          </v-btn>
          <v-btn
            v-if="can(PERMISSIONS.RolesWrite) && !role.is_system"
            variant="text"
            size="small"
            :aria-label="`Delete ${role.label}`"
            @click="confirmingDelete = role"
          >
            <v-icon icon="mdi-trash-can-outline" size="18" />
          </v-btn>
        </div>
      </li>
    </ul>
  </SectionCard>

  <RoleEditDialog
    :model-value="Boolean(editing) || creating"
    :role="editing"
    @update:model-value="closeDialog"
  />

  <ConfirmDialog
    :model-value="Boolean(confirmingDelete)"
    title="Delete this role?"
    :message="
      confirmingDelete
        ? `${memberCount(confirmingDelete)} people currently hold ${confirmingDelete.label}. They keep their accounts but lose every permission until you give them another role.`
        : ''
    "
    confirm-label="Delete role"
    destructive
    :loading="deleting"
    @update:model-value="(value) => !value && (confirmingDelete = null)"
    @confirm="confirmingDelete && confirmDelete(confirmingDelete)"
  />
</template>

<style scoped>
.toolbar {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-color: rgb(var(--v-theme-surface-alt));
}

.toolbar :deep(.v-input) {
  max-width: 340px;
}

.roles {
  list-style: none;
  margin: 0;
  padding: 0;
}

.roles__row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.roles__row:last-child {
  border-bottom: none;
}

.roles__main {
  flex: 1;
  min-width: 0;
}

.roles__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.roles__badge {
  font-size: 0.6875rem;
  color: rgb(var(--v-theme-text-secondary));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  padding: 1px 6px;
}

.roles__description {
  margin-top: 5px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
  max-width: 62ch;
}

.roles__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
  white-space: nowrap;
}

.roles__dot {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background-color: rgb(var(--v-chart-axis));
}

.roles__actions {
  display: flex;
  gap: 2px;
}

@media (max-width: 760px) {
  .roles__row {
    flex-wrap: wrap;
    gap: 10px;
  }

  .roles__main {
    flex-basis: 100%;
  }
}
</style>
