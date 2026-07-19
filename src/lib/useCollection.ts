import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, QueryConstraint, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useCollection<T = any>(colName: string, ...constraints: QueryConstraint[]) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, colName), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching " + colName, err);
      setLoading(false);
    });
    return unsub;
  }, [colName]); // ignoring constraints for simplicity if they don't change often

  return { data, loading };
}

export async function updateRecord(colName: string, id: string, data: any) {
  await updateDoc(doc(db, colName, id), data);
}

export async function createRecord(colName: string, data: any) {
  const id = data.id || crypto.randomUUID();
  await setDoc(doc(db, colName, id), { ...data, id });
}

export async function deleteRecord(colName: string, id: string, originalData: any) {
  // move to trash
  await setDoc(doc(db, 'trash', crypto.randomUUID()), {
    deletedAt: new Date().toISOString(),
    originalCollection: colName,
    originalId: id,
    data: originalData
  });
  await deleteDoc(doc(db, colName, id));
}
