import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

export default function Accounts() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAccountName, setNewAccountName] = useState("");
  const [newCurrency, setNewCurrency] = useState("RUB");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    const fetchAccounts = async () => {
      try {
        const accountsRef = collection(db, "users", currentUser.uid, "accounts");
        const snapshot = await getDocs(accountsRef);
        const accountsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAccounts(accountsList);
      } catch (err) {
        setError("Ошибка загрузки счетов");
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [currentUser]);

  const createAccount = async (e) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    try {
      const accountsRef = collection(db, "users", currentUser.uid, "accounts");
      const isFirst = accounts.length === 0;
      await addDoc(accountsRef, {
        name: newAccountName.trim(),
        currency: newCurrency,
        balance: 0,
        isDefault: isFirst   // первый счёт – основной
      });
      setNewAccountName("");
      setMessage("Счёт создан");
      setTimeout(() => setMessage(""), 3000);
      const snapshot = await getDocs(accountsRef);
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError("Ошибка создания счёта");
    }
  };

  // Переключение основного счёта
  const setAsDefault = async (accountId) => {
    try {
      // Снимаем флаг isDefault со всех счетов
      const updates = accounts.map(acc =>
        updateDoc(doc(db, "users", currentUser.uid, "accounts", acc.id), { isDefault: false })
      );
      await Promise.all(updates);
      // Устанавливаем флаг на выбранном
      await updateDoc(doc(db, "users", currentUser.uid, "accounts", accountId), { isDefault: true });
      // Обновляем локальное состояние
      setAccounts(accounts.map(acc => ({ ...acc, isDefault: acc.id === accountId })));
      setMessage("Основной счёт изменён");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError("Ошибка смены основного счёта");
    }
  };

  const deleteAccount = async (accountId, balance) => {
    if (balance !== 0) {
      setError("Можно удалить только счёт с нулевым балансом");
      return;
    }
    if (!window.confirm("Удалить счёт?")) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "accounts", accountId));
      setAccounts(accounts.filter(acc => acc.id !== accountId));
      setMessage("Счёт удалён");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError("Ошибка удаления счёта");
    }
  };

  const renameAccount = async (accountId, newName) => {
    if (!newName.trim()) return;
    try {
      await updateDoc(doc(db, "users", currentUser.uid, "accounts", accountId), { name: newName.trim() });
      setAccounts(accounts.map(acc => acc.id === accountId ? { ...acc, name: newName.trim() } : acc));
      setMessage("Название изменено");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError("Ошибка переименования");
    }
  };

  if (loading) return <div className="loader"></div>;

  return (
    <div className="container accounts-page">
      <div className="card">
        <h2>Мои счета</h2>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={createAccount} className="create-account-form">
          <input
            type="text"
            placeholder="Название счёта"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            required
          />
          <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}>
            <option value="RUB">Рубли (RUB)</option>
            <option value="USD">Доллары (USD)</option>
            <option value="EUR">Евро (EUR)</option>
          </select>
          <button type="submit">Создать счёт</button>
        </form>

        {accounts.length === 0 ? (
          <p>У вас пока нет счетов. Создайте первый!</p>
        ) : (
          <div className="accounts-list">
            {accounts.map(account => (
              <div key={account.id} className="account-card">
                <div className="account-header">
                  <div>
                    <h3>{account.name}</h3>
                    <p className="account-details">
                      {account.currency} • {account.isDefault && <span className="main-badge">Основной</span>}
                    </p>
                  </div>
                  <div className="account-balance">
                    {account.balance?.toLocaleString()} {account.currency}
                  </div>
                </div>
                <div className="account-actions">
                  <button
                    onClick={() => {
                      const newName = prompt("Новое название счёта", account.name);
                      if (newName) renameAccount(account.id, newName);
                    }}
                    className="btn-rename"
                  >
                    Переименовать
                  </button>
                  {!account.isDefault && (
                    <button onClick={() => setAsDefault(account.id)} className="btn-make-main">
                      Сделать основным
                    </button>
                  )}
                  <button
                    onClick={() => deleteAccount(account.id, account.balance)}
                    className="btn-delete"
                    disabled={account.balance !== 0}
                  >
                    Удалить {account.balance !== 0 && "(сначала обнулите)"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}