import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTIONS = [
  'students', 'graduates', 'blacklist', 'leads',
  'webinar_events', 'webinar_themes', 
  'activities', 'calls', 'call_categories', 
  'call_scores', 'os_reviews', 
  'amg_entries', 'amg_meta', 'archive', 'logs'
];

export async function exportAllData() {
  const exportData: Record<string, any[]> = {};
  
  for (const col of COLLECTIONS) {
    const snap = await getDocs(collection(db, col));
    exportData[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  
  // For archive, we also need to get chunks if we wanted a full backup,
  // but for now we backup just the top level collections.
  // Wait, archive chunks are subcollections: archive/{id}/chunks.
  // Let's do a basic backup for now.
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
