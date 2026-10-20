<script setup lang="ts">
import { ref } from 'vue'
import { XLSX_MIME } from '@/lib/excel'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ select: [file: File] }>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
// dragenter/dragleave fire for every child element; count them instead.
let depth = 0

function onEnter() {
  depth++
  dragging.value = true
}

function onLeave() {
  depth = Math.max(0, depth - 1)
  if (depth === 0) dragging.value = false
}

function onDrop(event: DragEvent) {
  depth = 0
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) emit('select', file)
}

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) emit('select', file)
  // Picking the same file again after fixing it must still fire.
  target.value = ''
}
</script>

<template>
  <div
    class="drop"
    :class="{ 'drop--active': dragging, 'drop--disabled': disabled }"
    data-testid="upload-drop-zone"
    @dragenter.prevent="onEnter"
    @dragover.prevent
    @dragleave.prevent="onLeave"
    @drop.prevent="onDrop"
  >
    <svg class="drop__glyph" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 4h17l9 9v31H12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M29 4v9h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M25 37V22m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <p class="drop__title">Drop the performance workbook here</p>
    <p class="drop__hint">Excel workbook (.xlsx), up to 10 MB. Nothing is saved until you review it.</p>
    <v-btn class="mt-4" color="primary" :disabled="disabled" @click="input?.click()">Choose file</v-btn>
    <input
      ref="input"
      type="file"
      class="drop__input"
      :accept="`.xlsx,${XLSX_MIME}`"
      aria-label="Choose a workbook to upload"
      data-testid="upload-input"
      :disabled="disabled"
      @change="onPick"
    />
  </div>
</template>

<style scoped>
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  border: 1px dashed rgb(var(--v-theme-line-strong));
  border-radius: 8px;
  background-color: rgb(var(--v-theme-surface));
}

.drop--active {
  border-style: solid;
  border-color: rgb(var(--v-theme-primary));
  background-color: rgb(var(--v-theme-surface-alt));
}

.drop--disabled {
  opacity: 0.6;
}

.drop__glyph {
  width: 40px;
  height: 40px;
  color: rgb(var(--v-theme-text-secondary));
}

.drop__title {
  margin-top: 16px;
  font-size: 1rem;
  font-weight: 600;
}

.drop__hint {
  margin-top: 4px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-text-secondary));
  max-width: 48ch;
}

.drop__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
