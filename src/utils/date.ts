export function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthBounds(date: Date): [string, string] {
  const y = date.getFullYear();
  const m = date.getMonth();
  
  const currentMonthStart = new Date(y, m, 1);
  const nextMonthStart = new Date(y, m + 1, 1);
  
  return [toLocalYMD(currentMonthStart), toLocalYMD(nextMonthStart)];
}
