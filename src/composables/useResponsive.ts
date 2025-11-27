import { onBeforeUnmount, onMounted, ref } from 'vue';

export type ResponsiveState = 'mobile' | 'tablet' | 'desktop';

export const useResponsive = () => {
  const current = ref<ResponsiveState>('desktop');

  const update = () => {
    const width = window.innerWidth;
    if (width < 600) {
      current.value = 'mobile';
    } else if (width < 1024) {
      current.value = 'tablet';
    } else {
      current.value = 'desktop';
    }
  };

  onMounted(() => {
    update();
    window.addEventListener('resize', update);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update);
  });

  return { current };
};
