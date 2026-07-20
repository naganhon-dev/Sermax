import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useResizableColumns(
  tableKey: string,
  defaultWidths: Record<string, number>,
  userEmail?: string
) {
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths);
  const [loadingWidths, setLoadingWidths] = useState(true);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  // Load from Firestore if userEmail is provided
  useEffect(() => {
    if (!userEmail) {
      setLoadingWidths(false);
      return;
    }
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'ui_settings', userEmail);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data[tableKey]) {
            setWidths((prev) => ({ ...prev, ...data[tableKey] }));
          }
        }
      } catch (err) {
        console.error('Error loading column widths:', err);
      } finally {
        setLoadingWidths(false);
      }
    };
    loadSettings();
  }, [tableKey, userEmail]);

  // Save to Firestore
  const saveWidths = async (newWidths: Record<string, number>) => {
    if (!userEmail) return;
    try {
      const docRef = doc(db, 'ui_settings', userEmail);
      await setDoc(docRef, { [tableKey]: newWidths }, { merge: true });
    } catch (err) {
      console.error('Error saving column widths:', err);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widthsRef.current[colId] || defaultWidths[colId] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      setWidths((prev) => ({ ...prev, [colId]: newWidth }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveWidths(widthsRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const resetWidths = async () => {
    setWidths(defaultWidths);
    if (userEmail) {
      try {
        const docRef = doc(db, 'ui_settings', userEmail);
        await setDoc(docRef, { [tableKey]: defaultWidths }, { merge: true });
      } catch (err) {
        console.error('Error resetting column widths:', err);
      }
    }
  };

  return { widths, handleResizeStart, resetWidths, loadingWidths };
}
