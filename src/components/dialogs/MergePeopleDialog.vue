<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAdminStore, type PersonWithLinks } from '@/stores/admin'
import { useToast } from '@/composables/useToast'
import { nameKeySimilarity } from '@/lib/excel/names'

/**
 * Merge a duplicate INTO this person. The duplicate's quarters, targets and
 * spellings move over; the database refuses if both appear in the same
 * upload, because then they really are two people.
 */
const props = defineProps<{ person: PersonWithLinks | null; people: PersonWithLinks[] }>()
const emit = defineEmits<{ close: []; merged: [] }>()

const admin = useAdminStore()
const toast = useToast()
const open = computed({ get: () => props.person !== null, set: (v) => (v ? null : emit('close')) })
const duplicateId = ref<string | null>(null)
const error = ref<string | null>(null)

watch(() => props.person, () => {
  duplicateId.value = null
  error.value = null
})

/** Likeliest duplicates first. */
const candidates = computed(() => {
  const keep = props.person
  if (!keep) return []
  return props.people
    .filter((p) => p.id !== keep.id && !p.merged_into)
    .map((p) => ({ value: p.id, title: `${p.last_name}, ${p.first_name}`, score: nameKeySimilarity(keep.name_key, p.name_key) }))
    .sort((a, b) => b.score - a.score)
})

const duplicate = computed(() => props.people.find((p) => p.id === duplicateId.value) ?? null)

async function merge() {
  if (!props.person || !duplicateId.value) return
  error.value = null
  try {
    await admin.mergePeople(props.person.id, duplicateId.value)
    emit('merged')
    emit('close')
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not merge.'
    toast.error(error.value)
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="rounded-overlay">
      <v-card-title>Merge into {{ person?.first_name }} {{ person?.last_name }}</v-card-title>
      <v-card-text class="merge">
        <v-autocomplete v-model="duplicateId" :items="candidates" label="The duplicate" placeholder="Who is really this person?" />
        <p v-if="duplicate" class="merge__what">
          Everything recorded for <strong>{{ duplicate.last_name }}, {{ duplicate.first_name }}</strong> — every quarter, target
          and spelling — moves to <strong>{{ person?.last_name }}, {{ person?.first_name }}</strong>. The duplicate is kept as an
          alias, so next quarter's workbook maps here automatically. This is recorded in the audit log.
        </p>
        <p v-if="error" class="merge__error" role="alert">{{ error }}</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">Cancel</v-btn>
        <v-btn color="primary" :disabled="!duplicateId" :loading="admin.busy" @click="merge">Merge</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.merge {
  display: grid;
  gap: 12px;
}

.merge__what {
  font-size: 0.875rem;
}

.merge__error {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-critical-ink));
}
</style>
