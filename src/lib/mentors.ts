export const ACTIVE_MENTORS = [
  "Герчик",
  "Носков",
  "Степченко",
  "Кирш",
  "Щеглов",
  "Чорный",
  "Кравченко"
];

const MENTOR_ALIASES: Record<string, string> = {
  'паша': 'Носков',
  'павел': 'Носков',
  'носков': 'Носков',
  'паша носков': 'Носков',
  'павел носков': 'Носков',
  'егор': 'Степченко',
  'степченко': 'Степченко',
  'егор степченко': 'Степченко',
  'юра': 'Кирш',
  'юрий': 'Кирш',
  'кирш': 'Кирш',
  'юра кирш': 'Кирш',
  'юрий кирш': 'Кирш',
  'герчик': 'Герчик',
  'амг': 'Герчик',
  'александр герчик': 'Герчик',
  'рома': 'Щеглов',
  'роман': 'Щеглов',
  'рома щеглов': 'Щеглов',
  'роман щеглов': 'Щеглов',
  'свят': 'Чорный',
  'святослав': 'Чорный',
  'свят чорный': 'Чорный',
  'святослав чорный': 'Чорный',
  'чорный': 'Чорный',
  'черный': 'Чорный',
  'кравченко': 'Кравченко',
  'краснова': 'Краснова'
};

export function canonMentor(v: any): string {
  if (v === undefined || v === null) return "";
  const trimmed = String(v).trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (MENTOR_ALIASES[lower]) {
    return MENTOR_ALIASES[lower];
  }

  const ALL_KNOWN_MENTORS = [...ACTIVE_MENTORS, "Краснова"];
  for (const mentor of ALL_KNOWN_MENTORS) {
    if (lower.includes(mentor.toLowerCase())) {
      return mentor;
    }
  }

  return trimmed;
}
