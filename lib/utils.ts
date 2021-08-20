export const dedup = <T>(arr: T[]): T[] => Array.from(new Set(arr));

export const swapArr = <T>(arr: T[], i: number, j: number): T[] => {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
  return arr;
};