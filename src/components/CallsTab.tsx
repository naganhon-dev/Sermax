import { useState, useMemo, Fragment, FormEvent } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, X, ChevronRight, ChevronDown, ChevronUp, Search, Calendar, Clock, UserPlus, Phone, Mail, User, BookOpen, AlertCircle, XCircle, Users, Award, Eye } from 'lucide-react';
import { canonStatus, ACTIVE_MENTORS, canonMentor } from '../lib/status';
import { auth } from '../firebase';
import CreateGroupEventModal, { GROUP_EVENT_TYPES } from './CreateGroupEventModal';
import GroupEventCardModal from './GroupEventCardModal';
import GroupAnalyticsSection from './GroupAnalyticsSection';

const isGroupCallType = (type: string) => {
  if (!type) return false;
  return GROUP_EVENT_TYPES.includes(type) || type.toLowerCase().includes('групповой') || type.toLowerCase().includes('выпускной') || type.toLowerCase().includes('торговый день');
};

function toText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (Array.isArray(v)) {
    return v.map(toText).join(', ');
  }
  if (typeof v === 'object') {
    return v.label ?? v.name ?? v.title ?? JSON.stringify(v);
  }
  return String(v);
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const toDateInput = (d: string) => {
  if (!d) return '';
  if (d.includes('.')) return d.split('.').reverse().join('-');
  return d;
};

const fromDateInput = (d: string) => {
  if (!d) return '';
  if (d.includes('-')) return d.split('-').reverse().join('.');
  return d;
};

const formatCallText = (c: any) => {
  const mentor = toText(c.Ментор) || 'Не указан';
  const duration = c['Длительность мин'] != null ? `${c['Длительность мин']} мин` : '';
  
  let dateStr = '';
  if (c.Дата) {
    const d = toText(c.Дата);
    if (d.includes('-')) {
      const parts = d.split('-');
      if (parts.length === 3) {
        dateStr = `${parts[2]}.${parts[1]}`;
      } else {
        dateStr = d;
      }
    } else if (d.includes('.')) {
      const parts = d.split('.');
      if (parts.length >= 2) {
        dateStr = `${parts[0]}.${parts[1]}`;
      } else {
        dateStr = d;
      }
    } else {
      dateStr = d;
    }
  }
  
  const timeStr = c.Время ? toText(c.Время) : '';
  
  const parts = [
    mentor,
    [dateStr, timeStr].filter(Boolean).join(' '),
    duration
  ].filter(Boolean);
  
  return parts.join(' · ');
};

export default function CallsTab({ onSelectStudent }: { onSelectStudent?: (student: any) => void } = {}) {
  const { data: calls } = useCollection('calls');
  const { data: students } = useCollection('students');
  const { data: leads } = useCollection('leads');

  const [activeType, setActiveType] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [leadProgramFilter, setLeadProgramFilter] = useState('Все');
  const [selectedCell, setSelectedCell] = useState<{ student: any; month: number } | null>(null);

  // Modals for Lead Management
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<any>(null);

  // Short form state for Lead creation
  const [leadForm, setLeadForm] = useState({
    fio: '',
    email: '',
    phone: '',
    program: 'ГП',
    mentor: '',
    date: '',
    time: '',
    note: ''
  });

  // Short form state for adding extra call to lead
  const [addCallForm, setAddCallForm] = useState({
    mentor: '',
    date: '',
    time: '',
    note: ''
  });

  // Modal state for "Не засчитывать созвон"
  const [uncountModalCall, setUncountModalCall] = useState<any>(null);
  const [uncountReason, setUncountReason] = useState('');
  const [uncountConvertToBonus, setUncountConvertToBonus] = useState(false);
  const [uncountError, setUncountError] = useState('');

  // Modal state for editing newly converted student
  const [editingStudentModal, setEditingStudentModal] = useState<any>(null);

  // Group Events state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [selectedGroupEventCall, setSelectedGroupEventCall] = useState<any>(null);
  const [showGroupAnalytics, setShowGroupAnalytics] = useState(false);

  const handleOpenUncountModal = (call: any) => {
    setUncountModalCall(call);
    setUncountReason(call.uncounted_reason || '');
    setUncountConvertToBonus(call.Тип === 'Бонусный');
    setUncountError('');
  };

  const handleApplyUncount = async (e: FormEvent) => {
    e.preventDefault();
    if (!uncountReason.trim()) {
      setUncountError('Пожалуйста, укажите причину (обязательное поле)');
      return;
    }
    if (!uncountModalCall) return;

    const updates: any = {
      counted: false,
      uncounted_reason: uncountReason.trim(),
      uncounted_by: auth?.currentUser?.email || auth?.currentUser?.displayName || 'Администратор',
      uncounted_at: new Date().toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    };

    if (uncountConvertToBonus) {
      updates.Тип = 'Бонусный';
    }

    await updateRecord('calls', uncountModalCall.id, updates);

    setUncountModalCall(null);
    setUncountReason('');
    setUncountConvertToBonus(false);
    setUncountError('');
  };

  const handleRestoreCounted = async (call: any) => {
    if (confirm('Вернуть этот созвон в плановые (засчитать)?')) {
      await updateRecord('calls', call.id, {
        counted: true,
        uncounted_reason: null,
        uncounted_by: null,
        uncounted_at: null
      });
    }
  };

  // Sidebar categories = unique values of 'Тип' field + 'Созвоны для дожатия' + GROUP_EVENT_TYPES
  const uniqueTypes = useMemo(() => {
    const typesSet = new Set<string>();
    calls.forEach(c => {
      const val = toText(c.Тип).trim();
      if (val) typesSet.add(val);
    });
    GROUP_EVENT_TYPES.forEach(t => typesSet.add(t));
    typesSet.add('Созвоны для дожатия');
    const list = Array.from(typesSet).sort();
    return list;
  }, [calls]);

  const currentType = activeType || uniqueTypes[0] || 'Созвоны для дожатия';

  // Map of student statuses for highlighting
  const studentStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach((s: any) => {
      const email = toText(s['Почта']).trim().toLowerCase();
      if (email) {
        map[email] = canonStatus(s['Статус']);
      }
    });
    return map;
  }, [students]);

  const getRowBgClass = (email: string) => {
    const status = studentStatuses[email.toLowerCase().trim()] || '';
    if (['Выпустился', 'Заморозка', 'Блокировка'].includes(status)) {
      return 'bg-amber-50/60 text-gray-500 hover:bg-amber-100/60 transition-colors';
    }
    return 'hover:bg-gray-50 transition-colors';
  };

  // Active mentors and student attributes for datalists
  const allMentorsList = ACTIVE_MENTORS;

  const uniquePackages = useMemo(() => {
    const arr = Array.from(
      new Set(
        (students || [])
          .map((s: any) => s['Пакет обучения'] || s['Пакет'] || s['программа'] || s['Программа'])
          .filter(Boolean)
      )
    ).sort();
    console.log('[CallsTab] uniquePackages count:', arr.length, arr);
    return arr;
  }, [students]);

  const uniqueGroups = useMemo(() => {
    const arr = Array.from(
      new Set(
        (students || [])
          .map((s: any) => s['Группа'] || s['группа'])
          .filter(Boolean)
      )
    ).sort();
    console.log('[CallsTab] uniqueGroups count:', arr.length, arr);
    return arr;
  }, [students]);

  // Aggregated Leads for "Созвоны для дожатия"
  const leadList = useMemo(() => {
    if (currentType !== 'Созвоны для дожатия') return [];

    const map = new Map<string, any>();

    // 1. Populate from leads collection
    leads.forEach((ld: any) => {
      const fio = toText(ld.ФИО || ld['ФИО']).trim();
      const email = toText(ld.Почта || ld['Почта']).trim().toLowerCase();
      const phone = toText(ld.Телефон || ld['Телефон']).trim();
      const prog = toText(ld.Программа || ld.program || ld['Программа']).trim();
      const mentor = toText(ld.Ментор || ld['Ментор']).trim();

      const key = ld.id || `${email || 'no-email'}::${fio || 'no-fio'}`;
      map.set(key, {
        id: ld.id,
        ФИО: fio || 'Без имени',
        Почта: email,
        Телефон: phone,
        Программа: prog || 'ГП',
        Ментор: mentor,
        calls: []
      });
    });

    // 2. Attach calls with Тип === 'Созвоны для дожатия'
    calls.forEach((c: any) => {
      const cType = toText(c.Тип).trim();
      if (cType !== 'Созвоны для дожатия') return;

      const fio = toText(c.ФИО).trim();
      const email = toText(c.Почта).trim().toLowerCase();
      const phone = toText(c.Телефон).trim();
      const prog = toText(c.Программа || c.program).trim();
      const mentor = toText(c.Ментор).trim();

      let existingKey = Array.from(map.keys()).find(k => {
        const item = map.get(k);
        if (c.lead_id && item.id === c.lead_id) return true;
        if (email && item.Почта === email) return true;
        if (fio && item.ФИО.toLowerCase() === fio.toLowerCase()) return true;
        return false;
      });

      if (!existingKey) {
        existingKey = `call-lead::${email || 'no-email'}::${fio || 'no-fio'}`;
        map.set(existingKey, {
          id: null,
          ФИО: fio || 'Без имени',
          Почта: email,
          Телефон: phone,
          Программа: prog || 'ГП',
          Ментор: mentor,
          calls: []
        });
      }

      const item = map.get(existingKey)!;
      item.calls.push(c);
      if (!item.Программа && prog) item.Программа = prog;
      if (!item.Ментор && mentor) item.Ментор = mentor;
      if (!item.Телефон && phone) item.Телефон = phone;
    });

    let result = Array.from(map.values());

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(l => 
        l.ФИО.toLowerCase().includes(q) ||
        l.Почта.toLowerCase().includes(q) ||
        l.Телефон.toLowerCase().includes(q) ||
        l.Ментор.toLowerCase().includes(q) ||
        l.Программа.toLowerCase().includes(q)
      );
    }

    // Program filter
    if (leadProgramFilter !== 'Все') {
      result = result.filter(l => l.Программа === leadProgramFilter);
    }

    return result;
  }, [leads, calls, currentType, search, leadProgramFilter]);

  // Grouping regular students under active category
  const studentsInType = useMemo(() => {
    if (currentType === 'Созвоны для дожатия') return [];

    const studentMap = new Map<string, { 
      ФИО: string; 
      Почта: string; 
      Группа: string; 
      Секция: string; 
      Программа?: string;
      Пакет?: string;
      Статус?: string;
      calls: any[] 
    }>();
    
    students.forEach((s: any) => {
      if (s.is_lead || s.isLead || s.is_lead_contact) return;
      const fio = toText(s['ФИО']).trim();
      const email = toText(s['Почта']).trim().toLowerCase();
      if (!fio && !email) return;
      const key = `${email || 'no-email'}::${fio || 'no-fio'}`;
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          ФИО: fio || 'Не указано',
          Почта: email,
          Группа: toText(s['Группа'] || s['группа']),
          Секция: toText(s['Секция'] || s['секция']),
          Программа: toText(s['Программа'] || s['Пакет'] || s['программа'] || s['пакет']),
          Пакет: toText(s['Пакет'] || s['пакет'] || s['Программа'] || s['программа']),
          Статус: canonStatus(s['Статус'] || s['статус'] || 'Учится'),
          calls: []
        });
      }
    });

    calls.forEach(c => {
      const cType = toText(c.Тип).trim() || 'Не указан';
      const isGroup = c.is_group === true || Array.isArray(c.participants);

      if (c.is_lead) return; // Skip lead calls from student view

      if (isGroup) {
        // Group calls processing
        if (cType !== currentType && !isGroupCallType(currentType)) return;

        const participants: any[] = c.participants || [];
        participants.forEach(p => {
          if (p.present === true) {
            const pEmail = toText(p.email).trim().toLowerCase();
            const pFio = toText(p.fio).trim();
            const key = `${pEmail || 'no-email'}::${pFio || 'no-fio'}`;

            if (!studentMap.has(key)) {
              // Try finding by email or fio
              let foundKey = '';
              for (const [k, st] of studentMap.entries()) {
                if ((pEmail && st.Почта && st.Почта.toLowerCase() === pEmail) || (pFio && st.ФИО && st.ФИО.toLowerCase() === pFio.toLowerCase())) {
                  foundKey = k;
                  break;
                }
              }
              if (foundKey) {
                const student = studentMap.get(foundKey)!;
                const currentGroup = toText(student.Группа).trim();
                const initialGroup = toText(p.initial_group).trim();
                const initialPackage = toText(p.initial_package).trim();
                const currentPackage = toText(student.Программа || student.Пакет).trim();

                const hasChangedStream = Boolean(
                  (initialGroup && currentGroup && initialGroup.toLowerCase() !== currentGroup.toLowerCase()) ||
                  (initialPackage && currentPackage && initialPackage.toLowerCase() !== currentPackage.toLowerCase())
                );

                student.calls.push({
                  ...c,
                  id: `${c.id}_${pEmail || pFio}`,
                  group_call_id: c.id,
                  is_group: true,
                  participant: p,
                  is_uncounted_stream_change: hasChangedStream,
                  uncounted_reason: hasChangedStream ? 'Сменил поток, не засчитано' : undefined
                });
                return;
              }
              studentMap.set(key, {
                ФИО: pFio || 'Не указано',
                Почта: pEmail,
                Группа: toText(p.initial_group),
                Секция: toText(p.initial_package),
                calls: []
              });
            }

            const student = studentMap.get(key)!;
            const currentGroup = toText(student.Группа).trim();
            const initialGroup = toText(p.initial_group).trim();
            const initialPackage = toText(p.initial_package).trim();
            const currentPackage = toText(student.Программа || student.Пакет).trim();

            const hasChangedStream = Boolean(
              (initialGroup && currentGroup && initialGroup.toLowerCase() !== currentGroup.toLowerCase()) ||
              (initialPackage && currentPackage && initialPackage.toLowerCase() !== currentPackage.toLowerCase())
            );

            student.calls.push({
              ...c,
              id: `${c.id}_${pEmail || pFio}`,
              group_call_id: c.id,
              is_group: true,
              participant: p,
              is_uncounted_stream_change: hasChangedStream,
              uncounted_reason: hasChangedStream ? 'Сменил поток, не засчитано' : undefined
            });
          }
        });

      } else {
        // Regular 1-on-1 call processing
        if (cType !== currentType) return;
        
        const fio = toText(c.ФИО).trim();
        const email = toText(c.Почта).trim().toLowerCase();
        const key = `${email || 'no-email'}::${fio || 'no-fio'}`;
        
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            ФИО: fio || 'Не указано',
            Почта: email,
            Группа: toText(c.Группа || c.группа),
            Секция: toText(c.Секция || c.секция),
            calls: []
          });
        }
        
        const student = studentMap.get(key)!;
        student.calls.push(c);
        if (c.Группа && !student.Группа) student.Группа = toText(c.Группа);
        if (c.Секция && !student.Секция) student.Секция = toText(c.Секция);
      }
    });
    
    return Array.from(studentMap.values());
  }, [students, calls, currentType]);

  const filteredStudents = useMemo(() => {
    let list = studentsInType;
    if (!showAll) {
      list = list.filter(st => st.calls.length > 0);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(st => 
        st.ФИО.toLowerCase().includes(q) || 
        st.Почта.toLowerCase().includes(q) ||
        st.Группа.toLowerCase().includes(q) ||
        st.Секция.toLowerCase().includes(q)
      );
    }
    return list;
  }, [studentsInType, showAll, search]);

  const groupedStudents = useMemo(() => {
    const groups: Record<string, typeof filteredStudents> = {};
    filteredStudents.forEach(st => {
      const gr = (st.Группа || st.Секция || 'Без группы').trim() || 'Без группы';
      if (!groups[gr]) groups[gr] = [];
      groups[gr].push(st);
    });
    Object.keys(groups).forEach(grKey => {
      groups[grKey].sort((a, b) => a.ФИО.localeCompare(b.ФИО, 'ru'));
    });
    return groups;
  }, [filteredStudents]);

  const groupKeys = useMemo(() => {
    return Object.keys(groupedStudents).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [groupedStudents]);

  const visibleCalls = useMemo(() => {
    const list: any[] = [];
    filteredStudents.forEach(st => {
      list.push(...st.calls);
    });
    return list;
  }, [filteredStudents]);

  const mentorStats = useMemo(() => {
    const stats: Record<string, {
      totalCount: number;
      totalDuration: number;
      monthly: Record<number, { count: number; duration: number }>
    }> = {};
    
    visibleCalls.forEach(c => {
      if (c.counted === false || c.counted === 'false') return;
      const mentor = toText(c.Ментор).trim() || 'Не указан';
      const month = Number(c.Месяц) || 0;
      const duration = Number(c['Длительность мин']) || 0;
      
      if (!stats[mentor]) {
        stats[mentor] = {
          totalCount: 0,
          totalDuration: 0,
          monthly: {}
        };
        for (let m = 1; m <= 12; m++) {
          stats[mentor].monthly[m] = { count: 0, duration: 0 };
        }
      }
      
      stats[mentor].totalCount += 1;
      stats[mentor].totalDuration += duration;
      
      if (month >= 1 && month <= 12) {
        stats[mentor].monthly[month].count += 1;
        stats[mentor].monthly[month].duration += duration;
      }
    });
    
    return stats;
  }, [visibleCalls]);

  const sortedMentors = useMemo(() => Object.keys(mentorStats).sort(), [mentorStats]);

  const averageDuration = (duration: number, count: number) => {
    if (!count) return '—';
    return `${Math.round(duration / count)} мин`;
  };

  // Submit Handler for "Добавить лида на дожатие"
  const handleCreateLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!leadForm.fio.trim()) {
      alert("Пожалуйста, укажите ФИО лида");
      return;
    }

    const leadId = crypto.randomUUID();
    const leadData = {
      id: leadId,
      ФИО: leadForm.fio.trim(),
      Почта: leadForm.email.trim(),
      Телефон: leadForm.phone.trim(),
      Программа: leadForm.program.trim(),
      Ментор: canonMentor(leadForm.mentor.trim()),
      is_lead: true,
      created_at: new Date().toISOString()
    };

    await createRecord('leads', leadData);

    if (leadForm.date || leadForm.mentor || leadForm.time) {
      const callData = {
        Тип: 'Созвоны для дожатия',
        ФИО: leadForm.fio.trim(),
        Почта: leadForm.email.trim(),
        Телефон: leadForm.phone.trim(),
        Программа: leadForm.program.trim(),
        Ментор: canonMentor(leadForm.mentor.trim()),
        Дата: fromDateInput(leadForm.date),
        Время: leadForm.time,
        Месяц: leadForm.date ? (new Date(leadForm.date).getMonth() + 1) : (new Date().getMonth() + 1),
        Примечание: leadForm.note.trim(),
        is_lead: true,
        lead_id: leadId,
        Источник: 'Дожатие'
      };
      await createRecord('calls', callData);
    }

    setLeadForm({
      fio: '',
      email: '',
      phone: '',
      program: 'ГП',
      mentor: '',
      date: '',
      time: '',
      note: ''
    });
    setShowAddLeadModal(false);
  };

  // Submit Handler for adding follow-up call to existing lead
  const handleAddCallForLeadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForCall) return;

    const dateStr = fromDateInput(addCallForm.date);
    const monthVal = addCallForm.date ? (new Date(addCallForm.date).getMonth() + 1) : (new Date().getMonth() + 1);

    const callObj = {
      Тип: 'Созвоны для дожатия',
      ФИО: selectedLeadForCall.ФИО,
      Почта: selectedLeadForCall.Почта,
      Телефон: selectedLeadForCall.Телефон,
      Программа: selectedLeadForCall.Программа,
      Ментор: canonMentor(addCallForm.mentor.trim() || selectedLeadForCall.Ментор || ''),
      Дата: dateStr,
      Время: addCallForm.time,
      Месяц: monthVal,
      Примечание: addCallForm.note.trim(),
      is_lead: true,
      lead_id: selectedLeadForCall.id,
      Источник: 'Дожатие'
    };

    await createRecord('calls', callObj);

    setSelectedLeadForCall(null);
    setAddCallForm({ mentor: '', date: '', time: '', note: '' });
  };

  // Convert lead to student
  const handleConvertToStudent = async (lead: any) => {
    if (!confirm(`Оформить лида "${lead.ФИО || 'Без имени'}" как постоянного студента?`)) {
      return;
    }

    const newStudentId = crypto.randomUUID();

    // 1. Создать запись в 'students' с переносом ФИО, Почта, Телефон, Программа, Ментор
    const studentData: any = {
      id: newStudentId,
      ФИО: lead.ФИО || '',
      Почта: lead.Почта || '',
      Телефон: lead.Телефон || '',
      Программа: lead.Программа || lead.program || 'ГП',
      Ментор: lead.Ментор || '',
      Статус: 'Учится',
      created_at: new Date().toISOString()
    };

    await createRecord('students', studentData);

    // 2. Снять is_lead / удалить из leads
    if (lead.id && !String(lead.id).startsWith('call-lead::')) {
      await deleteRecord('leads', lead.id, lead);
    }

    const leadEmail = (lead.Почта || '').trim().toLowerCase();
    const leadFio = (lead.ФИО || '').trim().toLowerCase();

    // Удаляем из коллекции 'leads' дублирующие записи
    for (const ld of leads) {
      if (ld.id && ld.id !== lead.id) {
        const ldEmail = (ld.Почта || ld['Почта'] || '').trim().toLowerCase();
        const ldFio = (ld.ФИО || ld['ФИО'] || '').trim().toLowerCase();
        if ((leadEmail && ldEmail === leadEmail) || (leadFio && ldFio === leadFio)) {
          await deleteRecord('leads', ld.id, ld);
        }
      }
    }

    // 3. Созвоны, привязанные к лиду, перепривязать к новому студенту (по id), чтобы история дожатия сохранилась
    const leadCalls = lead.calls || [];
    const callsToUpdate = calls.filter((c: any) => {
      if (leadCalls.some((lc: any) => lc.id === c.id)) return true;
      if (c.lead_id && lead.id && c.lead_id === lead.id) return true;
      if (c.is_lead) {
        const cEmail = (c.Почта || '').trim().toLowerCase();
        const cFio = (c.ФИО || '').trim().toLowerCase();
        if (leadEmail && cEmail === leadEmail) return true;
        if (leadFio && cFio === leadFio) return true;
      }
      return false;
    });

    for (const c of callsToUpdate) {
      await updateRecord('calls', c.id, {
        student_id: newStudentId,
        is_lead: false,
        lead_id: null,
        ФИО: lead.ФИО || c.ФИО,
        Почта: lead.Почта || c.Почта,
        Телефон: lead.Телефон || c.Телефон,
        Программа: lead.Программа || c.Программа
      });
    }

    const newStudentObj = studentData;

    // 4. Открыть полную карточку для дозаполнения
    if (onSelectStudent) {
      onSelectStudent(newStudentObj);
    } else {
      setEditingStudentModal(newStudentObj);
    }
  };

  // Delete lead and their calls
  const handleDeleteLead = async (lead: any) => {
    if (confirm(`Удалить лида "${lead.ФИО}" и все созвоны на дожатие?`)) {
      if (lead.id) {
        await deleteRecord('leads', lead.id, lead);
      }
      const leadCalls = lead.calls || [];
      for (const c of leadCalls) {
        if (c.id) {
          await deleteRecord('calls', c.id, c);
        }
      }
    }
  };

  // Delete call item
  const handleDeleteCallItem = async (c: any) => {
    if (confirm("Вы действительно хотите удалить эту запись созвона?")) {
      await deleteRecord('calls', c.id, c);
    }
  };

  return (
    <div className="flex h-full bg-white font-sans">
      {/* Left Sidebar Categories */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-100 flex justify-between items-center">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Типы созвонов</div>
        </div>
        <div className="p-2 flex flex-col gap-1">
          {uniqueTypes.map(t => {
            const isClosing = t === 'Созвоны для дожатия';
            return (
              <button
                key={t}
                onClick={() => {
                  setActiveType(t);
                  setSelectedCell(null);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-all ${
                  currentType === t 
                    ? isClosing 
                      ? 'bg-purple-700 text-white font-medium shadow-sm' 
                      : 'bg-blue-600 text-white font-medium shadow-sm' 
                    : isClosing
                      ? 'text-purple-800 bg-purple-50 hover:bg-purple-100 font-medium'
                      : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="truncate pr-2">{t}</span>
                {currentType === t && <ChevronRight className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header bar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800">{currentType}</h2>
              {currentType === 'Созвоны для дожатия' && (
                <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-purple-200">
                  Лиды
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {currentType === 'Созвоны для дожатия' 
                ? `Найдено лидов: ${leadList.length}` 
                : `Показано ${filteredStudents.length} студентов · Всего созвонов: ${visibleCalls.length}`
              }
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Кнопка "Создать групповое событие" */}
            <button
              type="button"
              onClick={() => setShowCreateGroupModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>+ Групповое событие</span>
            </button>

            {/* Кнопка "Аналитика групповых" */}
            <button
              type="button"
              onClick={() => setShowGroupAnalytics(!showGroupAnalytics)}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium flex items-center gap-1.5 transition-colors border ${
                showGroupAnalytics
                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Аналитика групповых</span>
            </button>

            {/* Кнопка "Добавить лида на дожатие" */}
            <button
              type="button"
              onClick={() => setShowAddLeadModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Добавить лида</span>
            </button>

            {currentType !== 'Созвоны для дожатия' && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showAll} 
                  onChange={e => setShowAll(e.target.checked)} 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs">Показать всех</span>
              </label>
            )}

            {currentType === 'Созвоны для дожатия' && (
              <select
                value={leadProgramFilter}
                onChange={e => setLeadProgramFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700"
              >
                <option value="Все">Все программы</option>
                <option value="ГП">ГП</option>
                <option value="Эволюция">Эволюция</option>
                <option value="Наставничество">Наставничество</option>
                <option value="Запуск">Запуск</option>
                <option value="Другое">Другое</option>
              </select>
            )}

            <div className="relative w-60">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input 
                placeholder={currentType === 'Созвоны для дожатия' ? "Поиск лидов (ФИО, почта, тел)..." : "Поиск по ФИО, почте, группе..."}
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 w-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-auto p-4 space-y-4">

          {/* Group Call Analytics Section */}
          {showGroupAnalytics && (
            <div className="mb-4">
              <GroupAnalyticsSection
                calls={calls}
                students={students}
                allMentorsList={allMentorsList}
              />
            </div>
          )}

          {/* SPECIALIZED VIEW: Group Call Events Registry */}
          {isGroupCallType(currentType) && (
            <div className="border border-indigo-200 rounded-xl overflow-hidden shadow-sm bg-white mb-4">
              <div className="p-3 bg-indigo-50/70 border-b border-indigo-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-700" />
                  <span className="font-semibold text-xs text-indigo-900 uppercase tracking-wider">
                    Реестр событий ({currentType})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1 rounded-md text-xs flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Создать событие
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Тип события</th>
                      <th className="py-2.5 px-3">Дата и время</th>
                      <th className="py-2.5 px-3">Ментор</th>
                      <th className="py-2.5 px-3">Участников</th>
                      <th className="py-2.5 px-3">Статус отметок</th>
                      <th className="py-2.5 px-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {calls.filter(c => (c.is_group === true || Array.isArray(c.participants)) && (c.Тип === currentType || isGroupCallType(c.Тип))).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-gray-400">
                          Групповых событий не найдено. Нажмите "+ Групповое событие", чтобы создать первое.
                        </td>
                      </tr>
                    ) : (
                      calls.filter(c => (c.is_group === true || Array.isArray(c.participants)) && (c.Тип === currentType || isGroupCallType(c.Тип))).map(groupCall => {
                        const parts: any[] = groupCall.participants || [];
                        const presentCount = parts.filter(p => p.present === true).length;
                        const absentCount = parts.filter(p => p.present === false).length;
                        const unmarkedCount = parts.filter(p => p.present === null).length;

                        return (
                          <tr key={groupCall.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-indigo-950">
                              {groupCall.Тип || 'Групповой созвон'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-800 font-medium">
                              {groupCall.Дата || '—'} {groupCall.Время ? `в ${groupCall.Время}` : ''}
                            </td>
                            <td className="py-2.5 px-3 text-gray-700">{groupCall.Ментор || '—'}</td>
                            <td className="py-2.5 px-3 font-bold text-gray-900">{parts.length} чел.</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-semibold text-[11px] mr-1">
                                ✓ {presentCount}
                              </span>
                              <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-semibold text-[11px] mr-1">
                                ✗ {absentCount}
                              </span>
                              {unmarkedCount > 0 && (
                                <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded text-[11px]">
                                  ? {unmarkedCount}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => setSelectedGroupEventCall(groupCall)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" /> Открыть карточку (отметки)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCallItem(groupCall)}
                                className="text-gray-400 hover:text-red-600 p-1 rounded"
                                title="Удалить созвон"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SPECIALIZED VIEW: "Созвоны для дожатия" */}
          {currentType === 'Созвоны для дожатия' ? (
            <div className="border border-purple-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="p-3 bg-purple-50/70 border-b border-purple-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-700" />
                  <span className="font-semibold text-xs text-purple-900 uppercase tracking-wider">
                    Реестр созвонов для дожатия лидов
                  </span>
                </div>
                <span className="text-xs text-purple-700 font-medium">
                  Всего записей: {leadList.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4 min-w-[220px]">Лид (ФИО / Контакты)</th>
                      <th className="py-3 px-3 min-w-[120px]">Программа</th>
                      <th className="py-3 px-3 min-w-[140px]">Ментор</th>
                      <th className="py-3 px-4 min-w-[280px]">Дата и время созвона</th>
                      <th className="py-3 px-3 text-right min-w-[140px]">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leadList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400 bg-gray-50">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <User className="w-8 h-8 text-gray-300" />
                            <p className="text-sm font-medium text-gray-600">Лидов на дожатие не найдено</p>
                            <p className="text-xs text-gray-400">Нажмите "+ Добавить лида на дожатие", чтобы добавить нового потенциального студента</p>
                            <button
                              type="button"
                              onClick={() => setShowAddLeadModal(true)}
                              className="mt-2 bg-purple-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-purple-700"
                            >
                              + Добавить лида
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      leadList.map((lead: any) => {
                        const leadCalls = lead.calls || [];

                        return (
                          <tr key={lead.id || lead.ФИО} className="hover:bg-purple-50/30 transition-colors">
                            {/* ФИО / Контакты */}
                            <td className="py-3 px-4 font-medium align-top">
                              <div className="font-bold text-gray-900">{lead.ФИО}</div>
                              <div className="flex flex-col gap-0.5 mt-1 text-xs text-gray-500 font-normal">
                                {lead.Почта && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-gray-400" /> {lead.Почта}
                                  </span>
                                )}
                                {lead.Телефон && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-gray-400" /> {lead.Телефон}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Программа */}
                            <td className="py-3 px-3 align-top">
                              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {lead.Программа || 'ГП'}
                              </span>
                            </td>

                            {/* Ментор */}
                            <td className="py-3 px-3 align-top text-gray-800 font-medium">
                              {lead.Ментор || '—'}
                            </td>

                            {/* Созвоны */}
                            <td className="py-3 px-4 align-top">
                              {leadCalls.length === 0 ? (
                                <span className="text-xs text-gray-400 italic">Созвон не запланирован</span>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {leadCalls.map((c: any) => {
                                    const isUncounted = c.counted === false || c.counted === 'false';
                                    return (
                                      <div key={c.id} className={`p-2.5 border rounded-md text-xs flex flex-col gap-1.5 ${
                                        isUncounted ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-purple-50 border-purple-100 text-purple-950'
                                      }`}>
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 font-semibold flex-wrap">
                                              <span className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-900">
                                                <Calendar className="w-3 h-3 text-purple-600" />
                                                {c.Дата || '—'}
                                              </span>
                                              {c.Время && (
                                                <span className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-900">
                                                  <Clock className="w-3 h-3 text-purple-600" />
                                                  {c.Время}
                                                </span>
                                              )}
                                              {c.Тип === 'Бонусный' && (
                                                <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 rounded px-1.5 py-0.2 font-semibold">
                                                  Бонусный
                                                </span>
                                              )}
                                              {isUncounted && (
                                                <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-200 rounded px-1.5 py-0.2 font-semibold">
                                                  Не засчитан
                                                </span>
                                              )}
                                            </div>
                                            {c.Ментор && c.Ментор !== lead.Ментор && (
                                              <span className="text-[11px] text-gray-600">Ментор: {c.Ментор}</span>
                                            )}
                                            {c.Примечание && (
                                              <span className="text-[11px] text-gray-500 italic mt-0.5">{c.Примечание}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenUncountModal(c)}
                                              className={`p-1 rounded text-xs transition-colors ${
                                                isUncounted 
                                                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200' 
                                                  : 'text-rose-600 hover:bg-rose-100 bg-white border border-rose-200'
                                              }`}
                                              title={isUncounted ? 'Редактировать статус / причину' : 'Не засчитывать созвон'}
                                            >
                                              {isUncounted ? <AlertCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteCallItem(c)}
                                              className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                              title="Удалить этот созвон"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {isUncounted && (
                                          <div className="bg-white/90 border border-rose-200 rounded p-2 text-[11px] text-rose-900 flex flex-col gap-0.5">
                                            <div className="font-semibold text-rose-700 flex items-center gap-1">
                                              <AlertCircle className="w-3 h-3 text-rose-600" /> Созвон не засчитан
                                            </div>
                                            <div><span className="font-medium text-gray-700">Причина:</span> {c.uncounted_reason || '—'}</div>
                                            <div className="text-[10px] text-gray-500 flex justify-between border-t border-rose-100 pt-1 mt-0.5">
                                              <span>Пометил: <span className="font-medium text-gray-700">{c.uncounted_by || 'Администратор'}</span></span>
                                              <span>{c.uncounted_at || '—'}</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleRestoreCounted(c)}
                                              className="mt-1 text-left text-[11px] text-blue-600 hover:underline font-medium"
                                            >
                                              ↩️ Засчитать обратно
                                            </button>
                                          </div>
                                        )}

                                        {!isUncounted && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenUncountModal(c)}
                                            className="self-start text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1"
                                          >
                                            <XCircle className="w-3 h-3" /> Не засчитывать созвон
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>

                            {/* Действия */}
                            <td className="py-3 px-3 align-top text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleConvertToStudent(lead)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                                  title="Оформить лида как постоянного студента"
                                >
                                  <UserPlus className="w-3.5 h-3.5" /> Оформить студентом
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLeadForCall(lead);
                                    setAddCallForm({ mentor: lead.Ментор || '', date: '', time: '', note: '' });
                                  }}
                                  className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-xs font-medium transition-colors flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Созвон
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLead(lead)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Удалить лида"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* STANDARD STUDENT MATRIX VIEW FOR OTHER CALL TYPES */
            <>
              {/* Collapsible Mentor Stats Summary */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button 
                  onClick={() => setShowSummary(!showSummary)}
                  className="w-full px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                    Сводка по менторам ({sortedMentors.length})
                  </span>
                  {showSummary ? <ChevronUp className="w-4 h-4 text-gray-500"/> : <ChevronDown className="w-4 h-4 text-gray-500"/>}
                </button>
                {showSummary && (
                  <div className="overflow-x-auto max-h-60">
                    {sortedMentors.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">Нет записей по менторам в этой выборке</div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                          <tr className="border-b border-gray-200">
                            <th className="py-2 px-3 border-r border-gray-200 font-semibold text-gray-600 min-w-[120px]">Ментор</th>
                            {MONTHS.map(m => (
                              <th key={m} className="py-2 px-2 text-center border-r border-gray-200 font-semibold text-gray-600 min-w-[70px]">{m}</th>
                            ))}
                            <th className="py-2 px-3 text-center font-semibold text-gray-600 bg-gray-100 min-w-[100px]">Всего (кол-во / мин)</th>
                            <th className="py-2 px-3 text-center font-semibold text-gray-600 bg-gray-100 min-w-[90px]">Ср. длит.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedMentors.map(mentor => {
                            const st = mentorStats[mentor];
                            return (
                              <tr key={mentor} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="py-2 px-3 font-medium border-r border-gray-200 sticky left-0 bg-white z-10 text-gray-800">{mentor}</td>
                                {MONTHS.map((_, idx) => {
                                  const mIdx = idx + 1;
                                  const mStat = st.monthly[mIdx];
                                  return (
                                    <td key={idx} className="py-2 px-2 text-center border-r border-gray-200 text-gray-700">
                                      {mStat.count > 0 ? (
                                        <span>
                                          <span className="font-semibold text-blue-900">{mStat.count}</span>
                                          <span className="text-gray-400 font-light mx-0.5">/</span>
                                          <span className="text-gray-600">{mStat.duration}м</span>
                                        </span>
                                      ) : <span className="text-gray-300">—</span>}
                                    </td>
                                  );
                                })}
                                <td className="py-2 px-3 text-center bg-gray-50 font-bold text-gray-800 border-r border-gray-200">
                                  {st.totalCount} <span className="text-gray-400 font-light">/</span> {st.totalDuration}м
                                </td>
                                <td className="py-2 px-3 text-center bg-gray-50 font-medium text-gray-600">
                                  {averageDuration(st.totalDuration, st.totalCount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* Student Matrix Grid Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                      <tr className="border-b border-gray-200">
                        <th className="py-3 px-4 border-r border-gray-200 font-semibold text-gray-700 min-w-[220px]">Студент (ФИО / Почта)</th>
                        {MONTHS.map(m => (
                          <th key={m} className="py-3 px-2 text-center border-r border-gray-200 font-semibold text-gray-700 min-w-[110px]">{m}</th>
                        ))}
                        <th className="py-3 px-4 text-center bg-gray-100 font-semibold text-gray-700 min-w-[100px]">Итог за год</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupKeys.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="py-12 text-center text-gray-400 bg-gray-50">
                            Нет записей по созвонам
                          </td>
                        </tr>
                      ) : (
                        groupKeys.map(groupName => {
                          const groupStudents = groupedStudents[groupName];
                          return (
                            <Fragment key={groupName}>
                              <tr className="bg-slate-100/80 border-y border-gray-200">
                                <td colSpan={14} className="py-1.5 px-4 font-bold text-xs text-slate-700 uppercase tracking-wider">
                                  Группа: {groupName} ({groupStudents.length})
                                </td>
                              </tr>
                              
                              {groupStudents.map(st => {
                                let yCount = 0;
                                let yMins = 0;
                                
                                st.calls.forEach(c => {
                                  if (c.counted === false || c.counted === 'false') return;
                                  yCount += 1;
                                  yMins += Number(c['Длительность мин']) || 0;
                                });
                                
                                return (
                                  <tr key={`${st.Почта}::${st.ФИО}`} className={`border-b border-gray-200 ${getRowBgClass(st.Почта)}`}>
                                    <td className="py-2.5 px-4 border-r border-gray-200 font-medium">
                                      <div className="font-semibold text-gray-900 leading-tight">{st.ФИО}</div>
                                      <div className="text-xs text-gray-500 font-normal mt-0.5">{st.Почта || 'Почта не указана'}</div>
                                    </td>
                                    
                                    {MONTHS.map((_, idx) => {
                                      const mIdx = idx + 1;
                                      const mCalls = st.calls.filter(c => Number(c.Месяц) === mIdx);
                                      
                                      return (
                                        <td 
                                          key={idx} 
                                          onClick={() => setSelectedCell({ student: st, month: mIdx })}
                                          className="py-2 px-2 border-r border-gray-200 text-center cursor-pointer hover:bg-blue-50/50 transition-colors align-top"
                                        >
                                          {mCalls.length > 0 ? (
                                            <div className="flex flex-col gap-1 text-[10px] text-left">
                                              {mCalls.map(c => {
                                                const isUncounted = c.counted === false || c.counted === 'false';
                                                return (
                                                  <div 
                                                    key={c.id} 
                                                    className={`rounded px-1.5 py-0.5 leading-snug break-words font-medium transition-colors border ${
                                                      isUncounted 
                                                        ? 'bg-rose-50 text-rose-800 border-rose-200 line-through opacity-80' 
                                                        : 'bg-blue-50 text-blue-900 border-blue-100 hover:bg-blue-100'
                                                    }`}
                                                    title={`Дата: ${c.Дата || '—'} · Время: ${c.Время || '—'}${isUncounted ? ` (Не засчитан: ${c.uncounted_reason || ''})` : ''}`}
                                                  >
                                                    {isUncounted ? '❌ ' : ''}{formatCallText(c)}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : <span className="text-gray-300 select-none text-xs">—</span>}
                                        </td>
                                      );
                                    })}
                                    
                                    <td className="py-2.5 px-4 bg-gray-50 text-center">
                                      {yCount > 0 ? (
                                        <div className="text-xs">
                                          <div className="font-bold text-gray-800">{yCount} созв.</div>
                                          <div className="text-gray-600 mt-0.5 font-medium">{yMins} мин</div>
                                          <div className="text-[10px] text-gray-500 italic mt-0.5">ср. {Math.round(yMins / yCount)}м</div>
                                        </div>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Right popover panel for regular cell */}
      {selectedCell && (
        <CellPopover 
          student={selectedCell.student} 
          month={selectedCell.month}
          currentType={currentType}
          calls={calls}
          onClose={() => setSelectedCell(null)}
          onOpenUncountModal={handleOpenUncountModal}
          onRestoreCounted={handleRestoreCounted}
        />
      )}

      {/* MODAL: Добавить лида на дожатие */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="px-5 py-4 bg-purple-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-200" />
                <h3 className="font-bold text-base">Добавить лида на дожатие</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLeadModal(false)}
                className="text-purple-200 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-5 flex flex-col gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">ФИО лида *</label>
                <input
                  type="text"
                  required
                  placeholder="Иванов Иван Иванович"
                  value={leadForm.fio}
                  onChange={e => setLeadForm(prev => ({ ...prev, fio: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Почта</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={leadForm.email}
                    onChange={e => setLeadForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Телефон</label>
                  <input
                    type="text"
                    placeholder="+7 (999) 000-00-00"
                    value={leadForm.phone}
                    onChange={e => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Программа</label>
                  <select
                    value={leadForm.program}
                    onChange={e => setLeadForm(prev => ({ ...prev, program: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="ГП">ГП</option>
                    <option value="Эволюция">Эволюция</option>
                    <option value="Наставничество">Наставничество</option>
                    <option value="Запуск">Запуск</option>
                    <option value="Другое">Другое</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ментор</label>
                  <input
                    type="text"
                    list="mentor-lead-list"
                    placeholder="Выберите или введите"
                    value={leadForm.mentor}
                    onChange={e => setLeadForm(prev => ({ ...prev, mentor: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <datalist id="mentor-lead-list">
                    {["Герчик","Носков","Степченко","Кирш","Щеглов","Чорный","Кравченко"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Дата созвона</label>
                  <input
                    type="date"
                    value={leadForm.date}
                    onChange={e => setLeadForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Время созвона</label>
                  <input
                    type="time"
                    value={leadForm.time}
                    onChange={e => setLeadForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Примечание / Комментарий</label>
                <textarea
                  rows={2}
                  placeholder="Заметки по лиду..."
                  value={leadForm.note}
                  onChange={e => setLeadForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-medium shadow-sm"
                >
                  Сохранить лида
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Добавить созвон лиду */}
      {selectedLeadForCall && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-gray-200">
            <div className="px-5 py-4 bg-purple-700 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">Новый созвон на дожатие</h3>
                <p className="text-xs text-purple-200 font-normal truncate max-w-[240px]">{selectedLeadForCall.ФИО}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadForCall(null)}
                className="text-purple-200 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCallForLeadSubmit} className="p-4 flex flex-col gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ментор</label>
                <input
                  type="text"
                  list="mentor-lead-call-list"
                  placeholder={selectedLeadForCall.Ментор || "Выберите ментора"}
                  value={addCallForm.mentor}
                  onChange={e => setAddCallForm(prev => ({ ...prev, mentor: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <datalist id="mentor-lead-call-list">
                  {["Герчик","Носков","Степченко","Кирш","Щеглов","Чорный","Кравченко"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Дата созвона *</label>
                  <input
                    type="date"
                    required
                    value={addCallForm.date}
                    onChange={e => setAddCallForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Время созвона</label>
                  <input
                    type="time"
                    value={addCallForm.time}
                    onChange={e => setAddCallForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Примечание</label>
                <textarea
                  rows={2}
                  placeholder="Заметка к созвону..."
                  value={addCallForm.note}
                  onChange={e => setAddCallForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setSelectedLeadForCall(null)}
                  className="px-3.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-medium shadow-sm"
                >
                  Добавить созвон
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Не засчитывать созвон */}
      {uncountModalCall && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="px-5 py-4 bg-rose-700 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Не засчитывать созвон
                </h3>
                <p className="text-xs text-rose-200 font-normal truncate max-w-[320px]">
                  {uncountModalCall.ФИО || 'Созвон'} ({uncountModalCall.Дата || 'без даты'} {uncountModalCall.Время || ''})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUncountModalCall(null)}
                className="text-rose-200 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyUncount} className="p-5 flex flex-col gap-4 text-sm">
              {uncountError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {uncountError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Причина (обязательно) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Укажите причину, почему созвон не засчитан (например: студент не явился, перенос)..."
                  value={uncountReason}
                  onChange={e => {
                    setUncountReason(e.target.value);
                    if (e.target.value.trim()) setUncountError('');
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <input
                  type="checkbox"
                  id="convert-bonus-checkbox"
                  checked={uncountConvertToBonus}
                  onChange={e => setUncountConvertToBonus(e.target.checked)}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="convert-bonus-checkbox" className="text-xs text-amber-900 cursor-pointer font-medium">
                  Перевести в "Бонусный" созвон
                  <span className="block text-[11px] text-amber-700 font-normal mt-0.5">
                    Меняет тип созвона на "Бонусный" в системе
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setUncountModalCall(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold shadow-sm"
                >
                  Применить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Карточка переведенного студента */}
      {editingStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="px-5 py-4 bg-emerald-700 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" /> Карточка нового студента
                </h3>
                <p className="text-xs text-emerald-200 font-normal">
                  Студент создан. Дозаполните информацию при необходимости:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudentModal(null)}
                className="text-emerald-200 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingStudentModal.id) {
                  const toSave = {
                    ...editingStudentModal,
                    Ментор: canonMentor(editingStudentModal.Ментор || '')
                  };
                  await updateRecord('students', editingStudentModal.id, toSave);
                }
                setEditingStudentModal(null);
              }}
              className="p-5 flex flex-col gap-3 text-sm max-h-[75vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">ФИО *</label>
                <input
                  required
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  value={editingStudentModal.ФИО || ''}
                  onChange={e => setEditingStudentModal({ ...editingStudentModal, ФИО: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Почта</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={editingStudentModal.Почта || ''}
                    onChange={e => setEditingStudentModal({ ...editingStudentModal, Почта: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Телефон</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={editingStudentModal.Телефон || ''}
                    onChange={e => setEditingStudentModal({ ...editingStudentModal, Телефон: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Программа</label>
                  <input
                    type="text"
                    list="edit-student-program-list"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    value={editingStudentModal.Программа || ''}
                    onChange={e => setEditingStudentModal({ ...editingStudentModal, Программа: e.target.value })}
                    placeholder="Выберите или введите программу"
                  />
                  <datalist id="edit-student-program-list">
                    {uniquePackages.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ментор</label>
                  <input
                    type="text"
                    list="edit-student-mentor-list"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    value={editingStudentModal.Ментор || ''}
                    onChange={e => setEditingStudentModal({ ...editingStudentModal, Ментор: e.target.value })}
                    placeholder="Выберите или введите ментора"
                  />
                  <datalist id="edit-student-mentor-list">
                    {["Герчик","Носков","Степченко","Кирш","Щеглов","Чорный","Кравченко"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Статус</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    value={editingStudentModal.Статус || 'Учится'}
                    onChange={e => setEditingStudentModal({ ...editingStudentModal, Статус: e.target.value })}
                  >
                    <option value="Учится">Учится</option>
                    <option value="Академ">Академ</option>
                    <option value="Выпуск">Выпуск</option>
                    <option value="Отчислен">Отчислен</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Группа</label>
                  <input
                    type="text"
                    list="edit-student-group-list"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    value={editingStudentModal.Группа || ''}
                    onChange={e => setEditingStudentModal({ ...editingStudentModal, Группа: e.target.value })}
                    placeholder="Выберите или введите группу"
                  />
                  <datalist id="edit-student-group-list">
                    {uniqueGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Комментарий</label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                  value={editingStudentModal.Комментарий || ''}
                  onChange={e => setEditingStudentModal({ ...editingStudentModal, Комментарий: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingStudentModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Закрыть
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Call Modals */}
      {showCreateGroupModal && (
        <CreateGroupEventModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          students={students}
          allMentorsList={allMentorsList}
          defaultType={isGroupCallType(currentType) ? currentType : 'Групповой созвон'}
        />
      )}

      {selectedGroupEventCall && (
        <GroupEventCardModal
          groupCall={selectedGroupEventCall}
          students={students}
          onClose={() => setSelectedGroupEventCall(null)}
        />
      )}

    </div>
  );
}

interface CellPopoverProps {
  student: any;
  month: number;
  currentType: string;
  calls: any[];
  onClose: () => void;
  onOpenUncountModal?: (call: any) => void;
  onRestoreCounted?: (call: any) => void;
}

function CellPopover({ student, month, currentType, calls, onClose, onOpenUncountModal, onRestoreCounted }: CellPopoverProps) {
  const monthName = MONTHS[month - 1];
  
  const studentCallsInMonth = useMemo(() => {
    return student.calls.filter((c: any) => Number(c.Месяц) === month);
  }, [student, month]);

  const [newMentor, setNewMentor] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState('15');
  const [newNote, setNewNote] = useState('');

  const allMentors = ACTIVE_MENTORS;

  const handleAddCall = async (e: FormEvent) => {
    e.preventDefault();
    const currentStatus = canonStatus(student?.Статус || student?.['Статус'] || student?.['статус'] || '');
    if (currentStatus !== 'Учится') {
      alert("Созвон можно назначить только студенту в статусе Учится");
      return;
    }
    if (!newMentor.trim()) {
      alert("Пожалуйста, укажите ментора");
      return;
    }
    
    const newRecord = {
      Почта: student.Почта,
      ФИО: student.ФИО,
      Месяц: month,
      Тип: currentType,
      Секция: student.Секция,
      Группа: student.Группа,
      Ментор: canonMentor(newMentor.trim()),
      Дата: fromDateInput(newDate),
      Время: newTime,
      "Длительность мин": Number(newDuration) || 0,
      Примечание: newNote.trim(),
      Источник: 'Вручную'
    };

    await createRecord('calls', newRecord);
    
    setNewMentor('');
    setNewDate('');
    setNewTime('');
    setNewDuration('15');
    setNewNote('');
  };

  const handleDeleteCall = async (c: any) => {
    if (confirm("Вы действительно хотите удалить это событие созвона?")) {
      await deleteRecord('calls', c.id, c);
    }
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-30 animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
        <div>
          <h3 className="font-bold text-gray-900 truncate max-w-[280px]">{student.ФИО}</h3>
          <p className="text-xs text-blue-600 font-medium mt-0.5">{monthName} (Созвоны)</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-gray-700 transition-colors focus:outline-none">
          <X className="w-5 h-5"/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            Список созвонов ({studentCallsInMonth.length})
          </h4>
          
          {studentCallsInMonth.length === 0 ? (
            <div className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-200">
              В этом месяце созвонов нет
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {studentCallsInMonth.map((c: any) => {
                const isUncounted = c.counted === false || c.counted === 'false';
                return (
                  <div key={c.id} className={`p-3 border rounded-lg flex flex-col gap-2 relative transition-colors ${
                    isUncounted ? 'bg-rose-50/70 border-rose-200' : 'bg-blue-50/50 border-blue-100 hover:bg-blue-50 hover:border-blue-200'
                  }`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-blue-900 flex items-center gap-1.5 flex-wrap">
                          <span>{toText(c.Ментор) || 'Не указан'}</span>
                          {c.Тип === 'Бонусный' && (
                            <span className="text-[9px] bg-purple-100 text-purple-800 rounded px-1.5 font-semibold select-none">
                              Бонусный
                            </span>
                          )}
                          {isUncounted && (
                            <span className="text-[9px] bg-rose-100 text-rose-800 border border-rose-200 rounded px-1.5 font-semibold select-none">
                              Не засчитан
                            </span>
                          )}
                          {c.Источник && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 rounded px-1.5 font-normal select-none">
                              {toText(c.Источник)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-2">
                          <span className="bg-white/80 border border-gray-200 px-1 py-0.5 rounded flex items-center gap-1 text-[11px]">
                            <Calendar className="w-2.5 h-2.5 text-gray-500" />
                            {c.Дата ? toText(c.Дата) : '—'}
                          </span>
                          {c.Время && (
                            <span className="bg-white/80 border border-gray-200 px-1 py-0.5 rounded flex items-center gap-1 text-[11px]">
                              <Clock className="w-2.5 h-2.5 text-gray-500" />
                              {toText(c.Zeit || c.Время)}
                            </span>
                          )}
                          {c['Длительность мин'] != null && (
                            <span className="bg-white/80 border border-gray-200 px-1 py-0.5 rounded text-[11px] font-medium text-gray-700">
                              {c['Длительность мин']} мин
                            </span>
                          )}
                        </div>
                        {c.Примечание && (
                          <div className="text-xs text-gray-500 mt-2 bg-white/60 border border-gray-100 rounded-md p-1.5 italic whitespace-pre-wrap">
                            {toText(c.Примечание)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenUncountModal?.(c)}
                          className={`p-1 rounded transition-colors ${
                            isUncounted 
                              ? 'text-amber-700 hover:bg-amber-100 bg-amber-50 border border-amber-200' 
                              : 'text-rose-600 hover:bg-rose-100 bg-white border border-rose-200'
                          }`}
                          title={isUncounted ? 'Редактировать статус / причину' : 'Не засчитывать созвон'}
                        >
                          {isUncounted ? <AlertCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => handleDeleteCall(c)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>

                    {isUncounted ? (
                      <div className="bg-white/90 border border-rose-200 rounded p-2 text-xs text-rose-900 flex flex-col gap-1 mt-1">
                        <div className="font-semibold text-rose-700 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Созвон не засчитан
                        </div>
                        <div><span className="font-medium text-gray-700">Причина:</span> {c.uncounted_reason || '—'}</div>
                        <div className="text-[10px] text-gray-500 flex justify-between border-t border-rose-100 pt-1 mt-0.5">
                          <span>Пометил: <span className="font-medium text-gray-700">{c.uncounted_by || 'Администратор'}</span></span>
                          <span>{c.uncounted_at || '—'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRestoreCounted?.(c)}
                          className="mt-1 text-left text-xs text-blue-600 hover:underline font-medium"
                        >
                          ↩️ Засчитать обратно
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenUncountModal?.(c)}
                        className="self-start text-xs font-medium text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 mt-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Не засчитывать созвон
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-150 pt-5">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Добавить новый созвон
          </h4>

          {canonStatus(student?.Статус || student?.['Статус'] || student?.['статус'] || '') !== 'Учится' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Созвон можно назначить только студенту в статусе Учится</span>
            </div>
          )}
          
          <form onSubmit={handleAddCall} className="flex flex-col gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ментор *</label>
              <input 
                type="text"
                list="popover-mentors"
                placeholder="Имя ментора"
                value={newMentor}
                onChange={e => setNewMentor(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
              <datalist id="popover-mentors">
                {["Герчик","Носков","Степченко","Кирш","Щеглов","Чорный","Кравченко"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Дата</label>
                <input 
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Время</label>
                <input 
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Длительность (мин)</label>
              <input 
                type="number"
                min="0"
                value={newDuration}
                onChange={e => setNewDuration(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Примечание / Комментарий</label>
              <textarea 
                rows={3}
                placeholder="Краткое описание созвона..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>

            <button 
              type="submit"
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm text-center text-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Добавить созвон
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
