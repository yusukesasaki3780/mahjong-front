<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NButtonGroup } from 'naive-ui';
import type { ShiftBoardHalf } from '../../../api/shiftBoard';

const props = defineProps<{
  modelValue: ShiftBoardHalf;
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: ShiftBoardHalf): void }>();

const options: { label: string; value: ShiftBoardHalf }[] = [
  { label: '前半 (1日〜15日)', value: 'first' },
  { label: '後半 (16日〜末日)', value: 'second' },
];

const currentValue = computed({
  get: () => props.modelValue,
  set: (value: ShiftBoardHalf) => emit('update:modelValue', value),
});
</script>

<template>
  <div class="half-selector">
    <n-button-group size="small">
      <n-button
        v-for="option in options"
        :key="option.value"
        :type="currentValue === option.value ? 'primary' : 'default'"
        :ghost="currentValue !== option.value"
        :disabled="disabled"
        @click="currentValue = option.value"
      >
        {{ option.label }}
      </n-button>
    </n-button-group>
  </div>
</template>

<style scoped>
.half-selector {
  display: flex;
  justify-content: flex-start;
}
</style>
