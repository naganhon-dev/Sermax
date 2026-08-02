import { canonMentor } from './mentors';
import { canonStatus } from './status';

export interface StudentPlan {
  product: string;
  planMentor: number;
  blackVersion: boolean;
  planGerchik: number;

  // Russian aliases for convenience
  продукт: string;
  планМентор: number;
  blackВерсия: boolean;
  планГерчик: number;
}

export function getStudentPlan(student: any): StudentPlan | null {
  if (!student) return null;

  const pkg = String(
    student['Пакет обучения'] || student['Пакет'] || student.package || ''
  ).trim();
  const prog = String(
    student['Программа'] || student['program'] || ''
  ).trim();

  if (!pkg && !prog) {
    return null;
  }

  const lowerPkg = pkg.toLowerCase();

  // 1. Если "Пакет обучения" начинается со слова "Наставничество"
  if (lowerPkg.startsWith('наставничество')) {
    const isBlack = lowerPkg.includes('герчик');
    return {
      product: 'Наставничество',
      planMentor: 12,
      blackVersion: isBlack,
      planGerchik: 0,
      продукт: 'Наставничество',
      планМентор: 12,
      blackВерсия: isBlack,
      планГерчик: 0,
    };
  }

  // 2. Иначе (program = "ГП" или "Эволюция")
  const isBlack = lowerPkg.includes('black') || lowerPkg.includes('блэк');
  return {
    product: 'Эволюция',
    planMentor: 4,
    blackVersion: isBlack,
    planGerchik: 18,
    продукт: 'Эволюция',
    планМентор: 4,
    blackВерсия: isBlack,
    планГерчик: 18,
  };
}

export function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    const d = val.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Try YYYY-MM-DD or ISO string
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // Try DD.MM.YYYY or D.M.YYYY
  const matchRu = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (matchRu) {
    const day = parseInt(matchRu[1], 10);
    const month = parseInt(matchRu[2], 10) - 1;
    const year = parseInt(matchRu[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const fallbackDate = new Date(str);
  if (!isNaN(fallbackDate.getTime())) return fallbackDate;

  return null;
}

export function getStartDate(student: any): Date | null {
  if (!student) return null;

  // 1. Check "Дата \nстарта курса" or variations
  const rawDirect =
    student['Дата \nстарта курса'] ??
    student['Дата\nстарта курса'] ??
    student['Дата старта курса'] ??
    student['Дата старта'];

  let parsed = parseDate(rawDirect);
  if (parsed) return parsed;

  // 2. Fallback by product
  const plan = getStudentPlan(student);
  if (plan) {
    if (plan.product === 'Эволюция') {
      const rawEvo = student['Старт Эво 2.0'] ?? student['Старт Эво'];
      parsed = parseDate(rawEvo);
      if (parsed) return parsed;
    } else if (plan.product === 'Наставничество') {
      const rawNast = student['Старт Наставничество'];
      parsed = parseDate(rawNast);
      if (parsed) return parsed;
    }
  }

  return null;
}

export function getCurrentMonth(student: any, nowInput?: Date): number | null {
  const startDate = getStartDate(student);
  if (!startDate) return null;

  const now = nowInput || new Date();

  // Midnight comparison
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (today < startDay) {
    return 0;
  }

  const diffYears = today.getFullYear() - startDay.getFullYear();
  const diffMonths = today.getMonth() - startDay.getMonth();
  let totalMonths = diffYears * 12 + diffMonths;

  if (today.getDate() < startDay.getDate()) {
    totalMonths -= 1;
  }

  return totalMonths + 1;
}

export function isGroupCallType(type: string): boolean {
  if (!type) return false;
  const t = String(type).trim().toLowerCase();
  return (
    t.includes('групповой') ||
    t.includes('выпускной') ||
    t.includes('торговый день') ||
    t.includes('вебинар')
  );
}

export function isCallForPrimaryStudent(call: any, student: any): boolean {
  if (!call || !student) return false;

  // Check student ID if both have it
  const studentId = student.id ? String(student.id) : '';
  const callStudentId = (call.student_id || call.studentId) ? String(call.student_id || call.studentId) : '';

  if (studentId && callStudentId) {
    if (studentId === callStudentId) return true;
    return false; // Different student IDs
  }

  // Check Email if both have it
  const studentEmail = String(student['Почта'] || student.email || student.Почта || '').trim().toLowerCase();
  const callEmail = String(call['Почта'] || call.email || call.student_email || call.Почта || '').trim().toLowerCase();

  if (studentEmail && callEmail) {
    if (studentEmail === callEmail) return true;
    return false; // Different emails
  }

  // Fallback to FIO only if email is missing on either call or student
  const studentFio = String(student['ФИО'] || student.fio || student.ФИО || '').trim().toLowerCase();
  const callFio = String(call['ФИО'] || call.fio || call.ФИО || '').trim().toLowerCase();

  if (studentFio && callFio && studentFio === callFio) {
    return true;
  }

  return false;
}

export const INDIVIDUAL_CALL_TYPES = [
  'Блэк+Наставничество',
  'Созвоны Эво',
  'Созвоны ТЭ',
  'Созвоны ТП',
];

export function isIndividualCall(call: any): boolean {
  if (!call) return false;

  // 1. Must NOT be a lead call
  if (call.is_lead === true || call.is_lead_contact === true || call.isLead === true) {
    return false;
  }

  // 2. Must NOT be a group event / call
  if (
    call.is_group === true ||
    call.isGroup === true ||
    (Array.isArray(call.participants) && call.participants.length > 0)
  ) {
    return false;
  }

  // 3. Must match whitelist of individual call types
  const callType = String(call.Тип || call.type || '').trim();
  if (!INDIVIDUAL_CALL_TYPES.some(t => t.toLowerCase() === callType.toLowerCase())) {
    return false;
  }

  return true;
}

export function isCallCounted(call: any): boolean {
  if (!call) return false;
  if (call.counted === false || call.counted === 'false' || call.counted === 0) {
    return false;
  }
  return true;
}

export interface CountedCallInfo {
  id: string;
  mentor: string;
  is_group: boolean;
  counted: boolean;
  type?: string;
  date?: string;
}

export function countUsedCalls(student: any, calls: any[] = []) {
  let usedMentor = 0;
  let usedGerchik = 0;
  const countedCallsList: CountedCallInfo[] = [];

  if (!student || !Array.isArray(calls)) {
    return { usedMentor, usedGerchik, countedCallsList };
  }

  calls.forEach((c: any) => {
    // 1. Check primary student attachment
    if (!isCallForPrimaryStudent(c, student)) return;

    // 2. Check individual call (not group, not lead, not bonus)
    if (!isIndividualCall(c)) return;

    // 3. Check counted !== false
    if (!isCallCounted(c)) return;

    // Determine mentor
    const mentorRaw = c['Ментор'] || c.mentor || c['ментор'] || '';
    const canonical = canonMentor(mentorRaw);

    if (canonical === 'Герчик') {
      usedGerchik += 1;
    } else {
      usedMentor += 1;
    }

    countedCallsList.push({
      id: String(c.id || ''),
      mentor: canonical,
      is_group: Boolean(c.is_group || c.isGroup),
      counted: c.counted !== false && c.counted !== 'false' && c.counted !== 0,
      type: c.Тип || c.type,
      date: c.Дата || c.date
    });
  });

  return { usedMentor, usedGerchik, countedCallsList };
}

export function getMonthlyPlan(student: any, month: number): { mentorPlan: number; gerchikPlan: number } {
  const plan = getStudentPlan(student);
  if (!plan) return { mentorPlan: 0, gerchikPlan: 0 };

  if (plan.product === 'Наставничество') {
    const mentorPlan = (month >= 1 && month <= 6) ? 2 : 0;
    return { mentorPlan, gerchikPlan: 0 };
  } else {
    // Эволюция
    const mentorPlan = (month === 1 || month === 6 || month === 7 || month === 12) ? 1 : 0;
    let gerchikPlan = 0;
    if (plan.blackVersion) {
      if (month >= 1 && month <= 6) {
        gerchikPlan = 1;
      } else if (month >= 7 && month <= 12) {
        gerchikPlan = 2;
      }
    }
    return { mentorPlan, gerchikPlan };
  }
}

export function getCallStudyMonth(call: any, student: any): number | null {
  if (!call || !student) return null;
  const rawDate = call.Дата || call.date || call.created_at || call.createdAt;
  const callDate = parseDate(rawDate);
  if (!callDate) return null;
  return getCurrentMonth(student, callDate);
}

export interface StudentDebt {
  id: string;
  month: number;
  type: 'mentor' | 'gerchik';
  slotIndex: number;
  reason: string;
  createdAt: string;
  createdBy?: string;
}

export interface MissedCallSlot {
  slotIndex: number;
  debt?: StudentDebt;
}

export interface MissedCallItem {
  month: number;
  type: 'mentor' | 'gerchik';
  count: number;
  slots: MissedCallSlot[];
}

export interface MissedCallsResult {
  missedMentorTotal: number;
  missedGerchikTotal: number;
  missedList: MissedCallItem[];
}

export function getMissedCalls(student: any, calls: any[] = []): MissedCallsResult {
  const emptyResult: MissedCallsResult = {
    missedMentorTotal: 0,
    missedGerchikTotal: 0,
    missedList: [],
  };

  if (!student || !Array.isArray(calls)) {
    return emptyResult;
  }

  // 1. Works ONLY if student status === "Учится"
  const statusStr = canonStatus(student['Статус'] || student.status);
  if (statusStr !== 'Учится') {
    return emptyResult;
  }

  // 2. Plan
  const plan = getStudentPlan(student);
  if (!plan) return emptyResult;

  // 3. Current Month
  const currentMonth = getCurrentMonth(student);
  if (currentMonth === null || currentMonth <= 1) {
    return emptyResult;
  }

  const studentDebts: StudentDebt[] = Array.isArray(student.debts) ? student.debts : [];

  // Filter valid student calls
  const validCalls = calls.filter((c: any) => {
    return (
      isCallForPrimaryStudent(c, student) &&
      isIndividualCall(c) &&
      isCallCounted(c)
    );
  });

  const maxMonth = plan.product === 'Наставничество' ? 6 : 12;
  const lastPastMonth = Math.min(currentMonth - 1, maxMonth);
  const missedList: MissedCallItem[] = [];

  for (let m = 1; m <= lastPastMonth; m++) {
    const { mentorPlan, gerchikPlan } = getMonthlyPlan(student, m);

    if (mentorPlan > 0) {
      const actualMentor = validCalls.filter((c: any) => {
        const cMonth = getCallStudyMonth(c, student);
        if (cMonth !== m) return false;
        const mentor = c['Ментор'] || c.mentor || c['ментор'] || '';
        return canonMentor(mentor) !== 'Герчик';
      }).length;

      const missedMentor = Math.max(0, mentorPlan - actualMentor);
      if (missedMentor > 0) {
        const slots: MissedCallSlot[] = [];
        for (let s = 0; s < missedMentor; s++) {
          const debt = studentDebts.find(
            (d: any) => d.month === m && d.type === 'mentor' && (d.slotIndex ?? 0) === s
          );
          slots.push({ slotIndex: s, debt });
        }
        missedList.push({
          month: m,
          type: 'mentor',
          count: missedMentor,
          slots,
        });
      }
    }

    if (plan.blackVersion && gerchikPlan > 0) {
      const actualGerchik = validCalls.filter((c: any) => {
        const cMonth = getCallStudyMonth(c, student);
        if (cMonth !== m) return false;
        const mentor = c['Ментор'] || c.mentor || c['ментор'] || '';
        return canonMentor(mentor) === 'Герчик';
      }).length;

      const missedGerchik = Math.max(0, gerchikPlan - actualGerchik);
      if (missedGerchik > 0) {
        const slots: MissedCallSlot[] = [];
        for (let s = 0; s < missedGerchik; s++) {
          const debt = studentDebts.find(
            (d: any) => d.month === m && d.type === 'gerchik' && (d.slotIndex ?? 0) === s
          );
          slots.push({ slotIndex: s, debt });
        }
        missedList.push({
          month: m,
          type: 'gerchik',
          count: missedGerchik,
          slots,
        });
      }
    }
  }

  const missedMentorTotal = missedList
    .filter(item => item.type === 'mentor')
    .reduce((sum, item) => sum + item.count, 0);

  const missedGerchikTotal = missedList
    .filter(item => item.type === 'gerchik')
    .reduce((sum, item) => sum + item.count, 0);

  return { missedMentorTotal, missedGerchikTotal, missedList };
}

