import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface User2FAData {
  email: string;
  uid: string;
  secret: string;
  enrolled_at: string;
}

export const get2FARecord = async (email: string): Promise<User2FAData | null> => {
  if (!db || !email) return null;
  const docRef = doc(db, 'user_2fa', email.toLowerCase().trim());
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as User2FAData;
  }
  return null;
};

export const save2FARecord = async (email: string, uid: string, secretBase32: string): Promise<void> => {
  if (!db || !email) return;
  const docRef = doc(db, 'user_2fa', email.toLowerCase().trim());
  await setDoc(docRef, {
    email: email.trim(),
    uid,
    secret: secretBase32,
    enrolled_at: new Date().toISOString(),
  });
};

export const delete2FARecord = async (email: string): Promise<boolean> => {
  if (!db || !email) return false;
  const docRef = doc(db, 'user_2fa', email.toLowerCase().trim());
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await deleteDoc(docRef);
    return true;
  }
  return false;
};

export const getAll2FARecords = async (): Promise<User2FAData[]> => {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'user_2fa'));
  return snap.docs.map(d => d.data() as User2FAData);
};

export const createNewSecret = (): OTPAuth.Secret => {
  return new OTPAuth.Secret({ size: 20 });
};

export const generateTOTPUri = (email: string, secret: OTPAuth.Secret | string): string => {
  const secretObj = typeof secret === 'string' ? OTPAuth.Secret.fromBase32(secret) : secret;
  const totp = new OTPAuth.TOTP({
    issuer: 'Sermax',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secretObj,
  });
  return totp.toString();
};

export const generateQRCodeDataUrl = async (uri: string): Promise<string> => {
  return await QRCode.toDataURL(uri, { margin: 2, width: 220 });
};

export const verifyTOTPCode = (secretBase32: string, email: string, code: string): boolean => {
  try {
    const cleanCode = code.replace(/\s+/g, '').trim();
    if (cleanCode.length !== 6) return false;

    const totp = new OTPAuth.TOTP({
      issuer: 'Sermax',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });

    const delta = totp.validate({ token: cleanCode, window: 1 });
    return delta !== null && typeof delta === 'number';
  } catch (err) {
    console.error('TOTP verification error:', err);
    return false;
  }
};
