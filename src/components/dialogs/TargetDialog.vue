<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCount, formatPeso, toCentavos, toPesos } from '@/lib/metrics'
import { AREA_LABEL, ROLE_LABEL } from '@/lib/cockpit/filters'
import type { TargetEdit } from '@/composables/useTargetsEditor'

/**
 * One target, in pesos and calls, for a QUARTER. A blank field inherits —
 * the placeholder says from where — so an override can change just one figure.
 */
const props = defineProps<{ edit: TargetEdit | null; saving: boolean }>()
const emit = defineEmits<{ save: [values: { inhouse: number | null; ethical: number | null; combi: number | null; calls: number | null; note: string | null }]; close: [] }>()

const open = computed({ get: () => props.edit !== null, set: (v) => (v ? null : emit('close')) })

const form = ref({ inhouse: '', ethical: '', combi: '', calls: '', note: '' })

watch(
  () => props.edit,
  (edit) => {
    const row = edit?.row
    form.value = {
      inhouse: row?.inhouse?.toString() ?? '',
      ethical: row?.ethical?.toString() ?? '',
      combi: row?.combi?.toString() ?? '',
      calls: row?.calls?.toString() ?? '',
      note: row?.note ?? '',
    }
  },
  { immediate: true },
)

const title = computed(() => {
  const edit = props.edit
  if (!edit) return ''
  if (edit.kind === 'person') return `Targets for ${edit.person.firstName} ${edit.person.lastName}`
  return `Default for ${ROLE_LABEL[edit.position]}${edit.area ? ` in ${AREA_LABEL[edit.area]}` : ', every area'}`
})

const SOURCE: Record<string, string> = {
  file: 'workbook',
  position_area: 'position + area default',
  position: 'position default',
  derived: 'in-house + ethical',
  person: 'override',
}

function placeholder(field: 'inhouse' | 'ethical' | 'combi' | 'calls') {
  const edit = props.edit
  if (!edit || edit.kind !== 'person') return 'Blank = not set'
  const value = edit.inherited.values[field]
  const source = edit.inherited.sources[field]
  if (value === null) return 'Not set anywhere'
  return `${field === 'calls' ? formatCount(value) : formatPeso(value, { whole: true })} from ${SOURCE[source ?? 'file']}`
}

const parse = (text: string) => {
  const cleaned = text.replace(/[₱,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

const values = computed(() => ({
  inhouse: parse(form.value.inhouse),
  ethical: parse(form.value.ethical),
  combi: parse(form.value.combi),
  calls: parse(form.value.calls),
}))

const invalid = computed(() => {
  const v = values.value
  if ([v.inhouse, v.ethical, v.combi, v.calls].some((x) => x !== null && (Number.isNaN(x) || x < 0))) return 'Targets must be zero or more.'
  if (v.calls !== null && !Number.isInteger(v.calls)) return 'The calls target must be a whole number.'
  return null
})

/** Open question 1: say so when the parts don't add up, but allow it. */
const mismatch = computed(() => {
  const edit = props.edit
  const inherit = edit?.kind === 'person' ? edit.inherited.values : null
  const pick = (field: 'inhouse' | 'ethical' | 'combi') =>
    values.value[field] !== null ? toCentavos(values.value[field] as number) : (inherit?.[field] ?? null)
  const [i, e, c] = [pick('inhouse'), pick('ethical'), pick('combi')]
  return i !== null && e !== null && c !== null && i + e !== c ? { i, e, c } : null
})

function submit() {
  if (invalid.value) return
  const round = (x: number | null) => (x === null ? null : toPesos(toCentavos(x)))
  emit('save', {
    inhouse: round(values.value.inhouse),
    ethical: round(values.value.ethical),
    combi: round(values.value.combi),
    calls: values.value.calls,
    note: form.value.note.trim() || null,
  })
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="rounded-overlay">
      <v-card-title>{{ title }}</v-card-title>
      <v-card-subtitle>Quarter figures. A month's target is a third. Leave a field blank to inherit.</v-card-subtitle>
      <v-card-text class="target-form">
        <v-text-field v-model="form.inhouse" label="In-house (₱)" inputmode="decimal" :placeholder="placeholder('inhouse')" persistent-placeholder />
        <v-text-field v-model="form.ethical" label="Ethical (₱)" inputmode="decimal" :placeholder="placeholder('ethical')" persistent-placeholder />
        <v-text-field v-model="form.combi" label="Combi (₱)" inputmode="decimal" :placeholder="placeholder('combi')" persistent-placeholder />
        <v-text-field v-model="form.calls" label="Calls" inputmode="numeric" :placeholder="placeholder('calls')" persistent-placeholder />
        <v-text-field v-model="form.note" label="Note (optional)" placeholder="Why this target" class="target-form__wide" />
        <p v-if="mismatch" class="target-form__warn target-form__wide" role="status">
          <v-icon icon="mdi-alert" size="16" />
          In-house {{ formatPeso(mismatch.i, { whole: true }) }} + ethical {{ formatPeso(mismatch.e, { whole: true }) }} is
          {{ formatPeso(mismatch.i + mismatch.e, { whole: true }) }}, not the combi target {{ formatPeso(mismatch.c, { whole: true }) }}. That's allowed — combi
          attainment uses the combi target as written.
        </p>
        <p v-if="invalid" class="target-form__error target-form__wide" role="alert">{{ invalid }}</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="emit('close')">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!!invalid" @click="submit">Save targets</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.target-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.target-form__wide {
  grid-column: 1 / -1;
}

.target-form__warn {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-caution-ink));
}

.target-form__error {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-critical-ink));
}
</style>
