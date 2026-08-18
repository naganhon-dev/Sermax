import { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, Search, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';
import { getAll2FARecords, delete2FARecord, User2FAData } from '../lib/totp';

export default function TwoFactorAdminSection() {
  const [users, setUsers] = useState<User2FAData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const records = await getAll2FARecords();
      setUsers(records);
    } catch (err: any) {
      console.error('Error loading 2FA records:', err);
      setMsg({ type: 'error', text: 'Ошибка при загрузке данных 2FA: ' + (err.message || '') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleReset2FA = async (email: string) => {
    if (!confirm(`Вы действительно хотите сбросить 2FA для пользователя ${email}?\n\nСекрет будет удален, и пользователю потребуется отсканировать новый QR-код при следующем входе.`)) {
      return;
    }

    try {
      setLoading(true);
      const success = await delete2FARecord(email);
      if (success) {
        setMsg({ type: 'success', text: `2FA для ${email} успешно сброшен.` });
        await loadUsers();
      } else {
        setMsg({ type: 'error', text: `Запись 2FA для ${email} не найдена.` });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Ошибка при сбросе 2FA: ' + (err.message || '') });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 text-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">Управление 2FA (Восстановление доступа)</h3>
            <p className="text-xs text-slate-500">
              Если пользователь потерял телефон или доступ к Google Authenticator, сбросьте его секрет 2FA.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          title="Обновить список"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-xs flex items-center space-x-2 ${
          msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск пользователя по email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-slate-50"
        />
      </div>

      {/* Users List */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">Загрузка списка 2FA пользователей...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            {searchQuery ? 'Пользователи не найдены' : 'Нет подключенных 2FA пользователей'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {filteredUsers.map(user => (
              <div key={user.email} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{user.email}</p>
                  <p className="text-[11px] text-slate-400">
                    Подключено: {user.enrolled_at ? new Date(user.enrolled_at).toLocaleString('ru-RU') : '—'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleReset2FA(user.email)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Сбросить 2FA</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
