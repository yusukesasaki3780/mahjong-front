import dayjs from 'dayjs';

export type Half = 'first' | 'second';

export interface HalfMonthRange {
  startDate: string;
  endDate: string;
}

export const getHalfMonthRange = (month: string, half: Half): HalfMonthRange => {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(m)) {
    throw new Error(`Invalid month format: ${month}`);
  }
  const paddedMonth = String(m).padStart(2, '0');
  if (half === 'first') {
    return {
      startDate: `${year}-${paddedMonth}-01`,
      endDate: `${year}-${paddedMonth}-15`,
    };
  }
  const lastDay = dayjs(`${year}-${paddedMonth}-01`).endOf('month').date();
  return {
    startDate: `${year}-${paddedMonth}-16`,
    endDate: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
  };
};

