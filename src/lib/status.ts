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

export const ACTIVE_MENTORS = [
  "Герчик",
  "АМГ",
];

export function canonMentor(v: any): string {
  if (v === undefined || v === null) return "";
  const trimmed = String(v).trim();
  if (!trimmed) return "";

  const match = ACTIVE_MENTORS.find(
    (m) => m.toLowerCase() === trimmed.toLowerCase()
  );
  if (match) {
    return match;
  }

  return trimmed;
}
