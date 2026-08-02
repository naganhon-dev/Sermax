export const STANDARD_STATUSES = [
  "Учится",
  "Не приступал",
  "Заморозка",
  "Блокировка",
  "Выпустился",
  "Возврат",
  "Бронь"
];

export function canonStatus(v: any): string {
  if (v === undefined || v === null) return "";
  const trimmed = String(v).trim();
  if (!trimmed) return "";

  const standardMatch = STANDARD_STATUSES.find(
    (st) => st.toLowerCase() === trimmed.toLowerCase()
  );
  if (standardMatch) {
    return standardMatch;
  }

  return trimmed;
}

export { ACTIVE_MENTORS, canonMentor } from './mentors';
