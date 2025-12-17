<script setup lang="ts">
// 任意の戻り先へナビゲートする共通バックボタンです。
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NIcon } from 'naive-ui';
import { ArrowBackOutline } from '@vicons/ionicons5';

interface BackButtonProps {
  to: string;
  label?: string;
}

type BackButtonEmits = (event: 'click', payload: { preventNavigate: () => void }) => void;

const props = defineProps<BackButtonProps>();
const emit = defineEmits<BackButtonEmits>();

const router = useRouter();

// ラベル未指定の場合のデフォルト文言を用意する
const buttonLabel = computed(() => props.label ?? '戻る');

// クリック時に外部へ通知しつつ、遷移が許可されたら指定ルートへ移動する
const handleClick = async () => {
  let shouldNavigate = true;
  emit('click', {
    preventNavigate: () => {
      shouldNavigate = false;
    },
  });
  if (shouldNavigate && props.to) {
    await router.push(props.to);
  }
};
</script>

<template>
  <div class="app-back-button">
    <n-button quaternary size="small" @click="handleClick">
      <n-icon size="18">
        <ArrowBackOutline />
      </n-icon>
      <span>{{ buttonLabel }}</span>
    </n-button>
  </div>
</template>

<style scoped>
.app-back-button {
  display: inline-flex;
  align-items: center;
}

.app-back-button :global(.n-button) {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  gap: 6px;
}

.app-back-button span {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
</style>
