<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TableSkeleton from '@/components/common/TableSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AreaTag from '@/components/cockpit/AreaTag.vue'
import PersonDialog from '@/components/dialogs/PersonDialog.vue'
import MergePeopleDialog from '@/components/dialogs/MergePeopleDialog.vue'
import { useAdminStore, type PersonWithLinks } from '@/stores/admin'
import { useSalesStore } from '@/stores/sales'
import { useToast } from '@/composables/useToast'
import { ROLE_LABEL } from '@/lib/cockpit/filters'
import { normalizeNamePart } from '@/lib/excel/names'

/**
 * The sales team as the system knows it, across every upload. Duplicates
 * (a typo that slipped in as a new person) are merged here; the merged
 * spelling becomes an alias so the next workbook maps straight to the survivor.
 */
const admin = useAdminStore()
const sales = useSalesStore()
const toast = useToast()

const search = ref('')
const showMerged = ref(false)
const editing = ref<PersonWithLinks | null>(null)
const merging = ref<PersonWithLinks | null>(null)

onMounted(() => admin.fetchPeople().catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load people.')))

const visible = computed(() => {
  const q = normalizeNamePart(search.value)
  return admin.people.filter(
    (p) => (showMerged.value || !p.merged_into) && (!q || normalizeNamePart(`${p.first_name} ${p.last_name}`).includes(q)),
  )
})

const nameOf = (id: string | null) => {
  const p = admin.people.find((x) => x.id === id)
  return p ? `${p.last_name}, ${p.first_name}` : 'someone'
}

async function afterChange(message: string) {
  toast.success(message)
  await sales.invalidate()
}
</script>

<template>
  <div class="people">
    <div class="people__bar">
      <v-text-field v-model="search" label="Search people" prepend-inner-icon="mdi-magnify" density="compact" class="people__search" hide-details clearable />
      <v-switch v-model="showMerged" label="Show merged" hide-details />
    </div>

    <section class="surface-panel">
      <TableSkeleton v-if="!admin.peopleLoaded" :rows="6" :columns="5" />
      <EmptyState v-else-if="!visible.length" icon="mdi-account-search-outline" title="No one found" description="People are added by workbook uploads. Try another search." />
      <div v-else class="people__scroll">
        <table class="people__table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Area</th>
              <th scope="col">Also spelt</th>
              <th scope="col">Sign-in</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in visible" :key="p.id" :class="{ 'is-quiet': !p.active || p.merged_into }">
              <th scope="row">
                {{ p.last_name }}, {{ p.first_name }}
                <span v-if="p.merged_into" class="people__tag">merged into {{ nameOf(p.merged_into) }}</span>
                <span v-else-if="!p.active" class="people__tag">inactive</span>
              </th>
              <td>{{ ROLE_LABEL[p.position] }}</td>
              <td><AreaTag :area="p.area" /></td>
              <td class="people__aliases">{{ p.aliases.length ? p.aliases.map((a) => a.replace('|', ', ')).join(' · ') : '—' }}</td>
              <td>{{ p.profile?.email ?? '—' }}</td>
              <td class="num">
                <template v-if="!p.merged_into">
                  <v-btn variant="text" size="small" @click="editing = p">Edit</v-btn>
                  <v-btn variant="text" size="small" @click="merging = p">Merge…</v-btn>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <PersonDialog :person="editing" @close="editing = null" @saved="afterChange('Saved.')" />
    <MergePeopleDialog :person="merging" :people="admin.people" @close="merging = null" @merged="afterChange('Merged. Their history is now one person.')" />
  </div>
</template>

<style scoped>
.people {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.people__bar {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.people__search {
  max-width: 320px;
}

.people__scroll {
  /* Contains absolutely positioned screen-reader labels, which would otherwise widen the page. */
  position: relative;
  overflow-x: auto;
}

.people__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

th,
td {
  padding: 10px 16px;
  text-align: left;
  border-bottom: 1px solid rgb(var(--v-theme-line));
  white-space: nowrap;
}

thead th {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

tbody th {
  font-weight: 500;
}

.is-quiet {
  color: rgb(var(--v-theme-ink-2));
}

.people__tag {
  margin-left: 8px;
  font-family: var(--font-label);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

.people__aliases {
  white-space: normal;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
  text-transform: capitalize;
}

.num {
  text-align: right;
}

/* Wide tables scroll inside their own frame, never the page. */
.people > * {
  min-width: 0;
}
</style>
