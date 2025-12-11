import { apiClient } from './axios';

export interface StoreMaster {
  id: number;
  storeName: string;
}

export const getStoreMasters = async (): Promise<StoreMaster[]> => {
  const { data } = await apiClient.get<StoreMaster[]>('/stores');
  return data;
};
