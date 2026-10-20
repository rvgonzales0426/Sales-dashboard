<script setup lang="ts">
import { computed, toRef } from 'vue'
import FormError from '@/components/common/FormError.vue'
import { useRoleDetail } from '@/composables/useRoleDetail'
import type { Role } from '@/types'

const props = defineProps<{ role: Role | null }>()
const open = defineModel<boolean>({ required: true })

const role = toRef(props, 'role')
const {
  form,
  selected,
  valid,
  groups,
  isNew,
  isSystem,
  isSuperuser,
  canSave,
  saving,
  error,
  save,
  toggleCategory,
  onKeyEdited,
  rules,
} = useRoleDetail(() => role.value)

const heading = computed(() => (isNew.value ? 'New role' : `Edit ${props.role?.label}`))

function categoryState(keys: string[]) {
  const chosen = keys.filter((key) => selected.value.includes(key)).length
  return { all: chosen === keys.length && keys.length > 0, some: chosen > 0 }
}

async function onSave() {
  await save()
  if (!error.value) open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="620" scrollable>
    <v-card class="rounded-overlay">
      <v-card-title>{{ heading }}</v-card-title>
      <v-card-subtitle class="text-medium-emphasis">
        Pick what this role can do. Changes apply the next time someone holding it loads a page.
      </v-card-subtitle>

      <v-card-text class="pt-2">
        <v-form v-model="valid">
          <div class="d-flex flex-column ga-4">
            <v-text-field
              v-model="form.label"
              label="Name"
              placeholder="Stock clerk"
              autofocus
              :rules="rules.label"
              :disabled="saving"
            />

            <v-text-field
              v-model="form.key"
              label="Key"
              hint="Used in code and policies. Cannot be changed once the role exists."
              persistent-hint
              :rules="rules.key"
              :disabled="saving || !isNew"
              @update:model-value="onKeyEdited"
            />

            <v-textarea
              v-model="form.description"
              label="Description"
              placeholder="What this role is for, in one line."
              rows="2"
              :disabled="saving"
            />

            <v-text-field
              v-model.number="form.rank"
              label="Rank"
              type="number"
              hint="Higher ranks sort first and read as more senior. Presentation only."
              persistent-hint
              :disabled="saving || isSystem"
            />
          </div>
        </v-form>

        <v-alert v-if="isSuperuser" type="info" variant="tonal" density="compact" class="mt-6">
          This role holds every permission, including ones added later. That is why the
          checkboxes below are locked.
        </v-alert>

        <div class="permissions mt-6">
          <h3 class="permissions__heading">Permissions</h3>

          <div v-for="group in groups" :key="group.category" class="permissions__group">
            <div class="permissions__group-head">
              <span class="permissions__category">{{ group.category }}</span>
              <v-btn
                v-if="!isSuperuser"
                variant="text"
                size="x-small"
                :disabled="saving"
                @click="
                  toggleCategory(
                    group.category,
                    !categoryState(group.items.map((item) => item.key)).all,
                  )
                "
              >
                {{
                  categoryState(group.items.map((item) => item.key)).all
                    ? 'Clear all'
                    : 'Select all'
                }}
              </v-btn>
            </div>

            <v-checkbox
              v-for="permission in group.items"
              :key="permission.key"
              v-model="selected"
              :value="permission.key"
              :disabled="saving || isSuperuser"
              density="compact"
              hide-details
            >
              <template #label>
                <div class="permission">
                  <span class="permission__label">{{ permission.label }}</span>
                  <span v-if="permission.description" class="permission__description">
                    {{ permission.description }}
                  </span>
                </div>
              </template>
            </v-checkbox>
          </div>
        </div>

        <FormError :message="error" class="mt-4" />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!canSave" @click="onSave">
          {{ isNew ? 'Create role' : 'Save changes' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.permissions__heading {
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.permissions__group {
  padding-block: 10px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.permissions__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
}

.permissions__category {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgb(var(--v-theme-text-secondary));
}

.permission {
  display: flex;
  flex-direction: column;
  padding-block: 4px;
}

.permission__label {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface));
}

.permission__description {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-text-secondary));
}
</style>
