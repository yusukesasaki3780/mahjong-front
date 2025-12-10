import { apiClient } from './axios';

export interface SpecialHourlyWage {
  id: number;
  label: string;
  hourlyWage: number;
}

export interface CreateSpecialHourlyWagePayload {
  label: string;
  hourlyWage: number;
}

const basePath = '/settings/special-wages';

export const getSpecialHourlyWages = async (): Promise<SpecialHourlyWage[]> => {
  const { data } = await apiClient.get<SpecialHourlyWage[]>(basePath);
  return data;
};

export const createSpecialHourlyWage = async (
  payload: CreateSpecialHourlyWagePayload,
): Promise<SpecialHourlyWage> => {
  const { data } = await apiClient.post<SpecialHourlyWage>(basePath, payload);
  return data;
};

export const deleteSpecialHourlyWage = async (id: number): Promise<void> => {
  await apiClient.delete(`${basePath}/${id}`);
};
