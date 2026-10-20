<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAdminStore, type PersonWithLinks } from '@/stores/admin'
import { useToast } from '@/composables/useToast'
import { cleanName, nameKey } from '@/lib/excel/names'
import { AREA_LABEL, ROLE_LABEL } from '@/lib/cockpit/filters'
import type { Area, Position, Profile } from '@/types'

/**
 * Edit a person. Fixing a typo in the name changes their name key; the old
 * spelling is kept as an alias by the database, so workbooks that still carry
 * it keep mapping here. Linking a sign-in enables their own cockpit (agent).
 */
const props = defineProps<{ person: PersonWithLinks | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const admin = useAdminStore()
const toast = useToast()
const open = computed({ get: () => props.person !== null, set: (v) => (v ? null : emit('close')) })

const form = ref({ last: '', first: '', position: 'psr' as Position, area: 'north' as Area, active: true, profileId: null as string | null })
const profiles = ref<Pick<Profile, 'id' | 'email' | 'full_name'>[]>([])

watch(
  () => props.person,
  async (p) => {
    if (!p) return
    form.value = { last: p.last_name, first: p.first_name, position: p.position, area: p.area, active: p.active, profileId: p.profile_id }
    profiles.value = await admin.fetchProfiles().catch(() => [])
  },
)

const roles = (Object.keys(ROLE_LABEL) as Position[]).map((value) => ({ value, title: ROLE_LABEL[value] }))
const areas = (Object.keys(AREA_LABEL) as Area[]).map((value) => ({ value, title: AREA_LABEL[value] }))
const accounts = computed(() => [{ value: null, title: 'Not linked' }, ...profiles.value.map((p) => ({ value: p.id, title: p.full_name ? `${p.full_name} · ${p.email}` : p.email }))])

const valid = computed(() => cleanName(form.value.last) && cleanName(form.value.first))

async function save() {
  if (!props.person || !valid.value) return
  const last = cleanName(form.value.last)
  const first = cleanName(form.value.first)
  try {
    await admin.updatePerson(props.person.id, {
      last_name: last,
      first_name: first,
      name_key: nameKey(last, first),
      position: form.value.position,
      area: form.value.area,
      active: form.value.active,
      profile_id: form.value.profileId,
    })
    emit('saved')
    emit('close')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save.')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="rounded-overlay">
      <v-card-title>Edit {{ person?.first_name }} {{ person?.last_name }}</v-card-title>
      <v-card-subtitle>Past quarters keep the area and role they were uploaded with.</v-card-subtitle>
      <v-card-text class="person-form">
        <v-text-field v-model="form.last" label="Last name" />
        <v-text-field v-model="form.first" label="First name" />
        <v-select v-model="form.position" :items="roles" label="Role" />
        <v-select v-model="form.area" :items="areas" label="Current area" />
        <v-select v-model="form.profileId" :items="accounts" label="Sign-in (for their own cockpit)" class="person-form__wide" />
        <v-switch v-model="form.active" label="Active" class="person-form__wide" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" :loading="admin.busy" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.person-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.person-form__wide {
  grid-column: 1 / -1;
}
</style>
