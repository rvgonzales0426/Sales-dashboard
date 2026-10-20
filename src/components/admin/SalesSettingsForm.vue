<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import { useSalesStore } from '@/stores/sales'
import { useToast } from '@/composables/useToast'
import type { SalesSettings } from '@/types'

/** The tunables behind the open questions, with the brief's defaults. */
const sales = useSalesStore()
const toast = useToast()
const saving = ref(false)

const form = ref({ onPace: 100, atRisk: 70, callsLow: 70, agent: false, combi: 'sum' as 'sum' | 'none', calls: 'quarter' as 'quarter' | 'month', rankRequiresTarget: true, wall: 20 })

function fill(row: SalesSettings | null) {
  if (!row) return
  form.value = {
    onPace: Math.round(Number(row.on_pace_threshold) * 100),
    atRisk: Math.round(Number(row.at_risk_threshold) * 100),
    callsLow: Math.round(Number(row.calls_low_threshold) * 100),
    agent: row.agent_access_enabled,
    combi: row.combi_target_fallback,
    calls: row.file_calls_target_basis,
    rankRequiresTarget: row.rank_requires_target,
    wall: row.wall_rotate_seconds,
  }
}

onMounted(async () => {
  await sales.fetchSettings().catch(() => null)
  fill(sales.settingsRow)
})
watch(() => sales.settingsRow, fill)

const problem = computed(() => {
  const f = form.value
  if (!(f.atRisk > 0 && f.atRisk < f.onPace)) return 'The at-risk line must be above 0% and below the on-pace line.'
  if (f.callsLow <= 0) return 'The calls-low line must be above 0%.'
  if (!(f.wall >= 5 && f.wall <= 600)) return 'Wall rotation must be between 5 and 600 seconds.'
  return null
})

async function save() {
  if (problem.value) return
  saving.value = true
  try {
    const f = form.value
    await sales.updateSettings({
      on_pace_threshold: f.onPace / 100,
      at_risk_threshold: f.atRisk / 100,
      calls_low_threshold: f.callsLow / 100,
      agent_access_enabled: f.agent,
      combi_target_fallback: f.combi,
      file_calls_target_basis: f.calls,
      rank_requires_target: f.rankRequiresTarget,
      wall_rotate_seconds: f.wall,
    })
    toast.success('Settings saved. Every cockpit has been recalculated.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save the settings.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="settings">
    <SectionCard title="Pace" description="Against expected-to-date: quarter target × months elapsed ÷ 3.">
      <div class="settings__grid">
        <v-text-field v-model.number="form.onPace" type="number" label="On pace at or above" suffix="%" />
        <v-text-field v-model.number="form.atRisk" type="number" label="At risk at or above" suffix="%" hint="Below this is behind." persistent-hint />
        <v-text-field v-model.number="form.callsLow" type="number" label="“Calls low” lamp below" suffix="%" />
      </div>
    </SectionCard>

    <SectionCard title="Targets" description="How the workbook's targets are read.">
      <div class="settings__grid">
        <v-select
          v-model="form.combi"
          label="No combi target, but in-house and ethical set"
          :items="[{ value: 'sum', title: 'Use in-house + ethical' }, { value: 'none', title: 'Leave combi unset' }]"
        />
        <v-select
          v-model="form.calls"
          label="The workbook's CALLS target is"
          :items="[{ value: 'quarter', title: 'For the quarter (480 = 160 a month)' }, { value: 'month', title: 'For one month (160)' }]"
        />
        <v-switch v-model="form.rankRequiresTarget" label="Leave people without a target out of attainment and rankings" class="settings__wide" />
      </div>
    </SectionCard>

    <SectionCard title="Access and display">
      <div class="settings__grid">
        <v-switch v-model="form.agent" label="Agents can open their own cockpit" hint="Link each agent's sign-in on the People page." persistent-hint class="settings__wide" />
        <v-text-field v-model.number="form.wall" type="number" label="Wall display: next area every" suffix="seconds" />
      </div>
    </SectionCard>

    <div class="settings__actions">
      <p v-if="problem" class="settings__problem" role="alert">{{ problem }}</p>
      <v-btn color="primary" :loading="saving" :disabled="!!problem" @click="save">Save settings</v-btn>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: grid;
  gap: 16px;
  max-width: 880px;
}

.settings__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.settings__wide {
  grid-column: 1 / -1;
}

.settings__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.settings__problem {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-critical-ink));
}

@media (max-width: 760px) {
  .settings__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
