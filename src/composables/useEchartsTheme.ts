import { computed } from 'vue';
import { useOsTheme, useThemeVars } from 'naive-ui';
import type { EChartsOption } from 'echarts';

type ThemeValues = ReturnType<typeof useThemeVars>['value'];

interface Palette {
  background: string;
  text: string;
  series: string[];
}

const lightPalette = (vars?: ThemeValues): Palette => ({
  background: vars?.cardColor ?? '#ffffff',
  text: vars?.textColor1 ?? '#0f172a',
  series: ['#2563eb', '#22c55e', '#f97316', '#ec4899'],
});

const darkPalette = (vars?: ThemeValues): Palette => ({
  background: vars?.cardColor ?? '#0f172a',
  text: vars?.textColor1 ?? '#e2e8f0',
  series: ['#60a5fa', '#34d399', '#fbbf24', '#fb7185'],
});

const mergeOptions = (palette: Palette, option: EChartsOption): EChartsOption => ({
  backgroundColor: palette.background,
  textStyle: { color: palette.text },
  color: palette.series,
  grid: {
    left: '3%',
    right: '3%',
    top: 50,
    bottom: 50,
    containLabel: true,
    ...(!option.grid || Array.isArray(option.grid) ? {} : (option.grid as object)),
  },
  ...option,
});

export const useEchartsTheme = () => {
  const osTheme = useOsTheme();
  const themeVars = useThemeVars();

  const chartTheme = computed(() => (osTheme.value === 'dark' ? 'dark' : 'light'));

  const palette = computed(() =>
    chartTheme.value === 'dark' ? darkPalette(themeVars.value) : lightPalette(themeVars.value),
  );

  const themedOption = (option: EChartsOption): EChartsOption => mergeOptions(palette.value, option);

  const getSeriesColor = (index: number): string => {
    const colors = palette.value.series;
    if (!colors.length) {
      return '#2563eb';
    }
    return colors[index % colors.length] ?? '#2563eb';
  };

  return {
    chartTheme,
    palette,
    themedOption,
    getSeriesColor,
  };
};
