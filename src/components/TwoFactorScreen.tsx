import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  ShieldCheck, 
  QrCode, 
  Key, 
  Copy, 
  Check, 
  LogOut, 
  AlertCircle, 
  Smartphone, 
  Lock,
  ArrowRight
} from 'lucide-react';
import { 
  get2FARecord, 
  save2FARecord, 
  createNewSecret, 
  generateTOTPUri, 
  generateQRCodeDataUrl, 
  verifyTOTPCode, 
  User2FAData 
} from '../lib/totp';

interface TwoFactorScreenProps {
  user: User;
  onSuccess: () => void;
  onLogout: () => void;
}

export default function TwoFactorScreen({ user, onSuccess, onLogout }: TwoFactorScreenProps) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<User2FAData | null>(null);
  
  // Setup state
  const [setupSecret, setSetupSecret] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Verification code input state
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function check2FA() {
      if (!user.email) {
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const rec = await get2FARecord(user.email);
        if (!isMounted) return;

        if (rec && rec.secret) {
          setRecord(rec);
        } else {
          // No 2FA setup yet - prepare new secret and QR code
          const newSec = createNewSecret();
          const base32 = newSec.base32;
          setSetupSecret(base32);

          const uri = generateTOTPUri(user.email, newSec);
          const qrUrl = await generateQRCodeDataUrl(uri);
          if (!isMounted) return;
          setQrCodeUrl(qrUrl);
        }
      } catch (err: any) {
        console.error('2FA check error:', err);
        setError('Не удалось загрузить данные 2FA: ' + (err.message || 'Ошибка сети'));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    check2FA();

    return () => {
      isMounted = false;
    };
  }, [user.email]);

  const handleCopySecret = () => {
    if (!setupSecret) return;
    navigator.clipboard.writeText(setupSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    setError(null);
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Введите 6-значный код из приложения');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const isValid = verifyTOTPCode(setupSecret, user.email || '', code);
      if (isValid) {
        // Save to Firestore
        await save2FARecord(user.email || '', user.uid, setupSecret);
        // Save session flag
        sessionStorage.setItem(`2fa_verified_${user.uid}`, 'true');
        onSuccess();
      } else {
        setError('Неверный код. Проверьте время на телефоне и введите актуальный код из приложения.');
      }
    } catch (err: any) {
      setError('Ошибка при проверке кода: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    if (code.length !== 6) {
      setError('Введите 6-значный код из приложения');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const isValid = verifyTOTPCode(record.secret, user.email || '', code);
      if (isValid) {
        sessionStorage.setItem(`2fa_verified_${user.uid}`, 'true');
        onSuccess();
      } else {
        setError('Неверный код 2FA. Попробуйте еще раз.');
      }
    } catch (err: any) {
      setError('Ошибка при проверке кода: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-6">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium text-sm">Проверка настроек безопасности (2FA)...</p>
        </div>
      </div>
    );
  }

  // Formatting secret for display with spaces
  const formattedSecret = setupSecret ? setupSecret.match(/.{1,4}/g)?.join(' ') || setupSecret : '';

  // Mode 1: SETUP 2FA
  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 text-center relative">
            <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Настройка 2FA безопасности</h2>
            <p className="text-xs text-slate-400 mt-1">Привязка Google Authenticator / Authy</p>
          </div>

          <div className="p-6">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-5 text-xs text-slate-600 flex items-start space-x-2">
              <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Откройте приложение <strong>Google Authenticator</strong> или <strong>Authy</strong> на вашем смартфоне и отсканируйте этот QR-код.
              </span>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-slate-200 shadow-inner mb-5">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-lg shadow-sm" />
              ) : (
                <div className="w-48 h-48 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs">
                  Генерация QR-кода...
                </div>
              )}

              {/* Text secret key */}
              <div className="w-full mt-4 pt-3 border-t border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    Ключ настройки (если QR не сканируется):
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <code className="bg-slate-100 px-3 py-1.5 rounded text-xs font-mono font-bold text-slate-800 flex-1 text-center tracking-wider overflow-x-auto select-all">
                    {formattedSecret}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    title="Скопировать ключ"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors text-xs flex items-center shrink-0 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleVerifySetup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                  Введите 6-значный код из приложения для подтверждения:
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="000000"
                  autoFocus
                  className="w-full text-center text-2xl font-mono tracking-[0.4em] py-2.5 px-4 rounded-lg border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer"
              >
                {verifying ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Подтвердить и включить 2FA</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate max-w-[200px]" title={user.email || ''}>
                {user.email}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="text-slate-600 hover:text-red-600 flex items-center space-x-1 font-medium transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode 2: VERIFY EXISTING 2FA
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-200">
        <div className="bg-slate-900 text-white p-6 text-center">
          <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Вход в систему</h2>
          <p className="text-xs text-slate-400 mt-1">Двухфакторная аутентификация</p>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-xs text-slate-500 mb-1">Вы вошли как:</p>
            <p className="text-sm font-semibold text-slate-800 break-all bg-slate-100 px-3 py-1.5 rounded-lg inline-block border border-slate-200">
              {user.email}
            </p>
          </div>

          <form onSubmit={handleVerifyChallenge} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">
                Введите 6-значный код из Google Authenticator:
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                autoFocus
                className="w-full text-center text-2xl font-mono tracking-[0.4em] py-3 px-4 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer"
            >
              {verifying ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Подтвердить вход</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center space-x-1.5 font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Сменить аккаунт / Выйти</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
