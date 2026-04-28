import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";

export default function Accounts() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAccountName, setNewAccountName] = useState("");
  const [newCurrency, setNewCurrency] = useState("RUB");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Загрузка счетов
  useEffect(() => {
    if (!currentUser) return;
    const fetchAccounts = async () => {
      try {
        const accountsRef = collection(db, "users", currentUser.uid, "accounts");
        const snapshot = await getDocs(accountsRef);
        const accountsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAccounts(accountsList);
      } catch (err) {
        console.error(err);
        setError("Ошибка загрузки счетов");
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [currentUser]);

  // Создание нового счёта
  const createAccount = async (e) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    try {
      const accountsRef = collection(db, "users", currentUser.uid, "accounts");
      await addDoc(accountsRef, {
        name: newAccountName.trim(),
        currency: newCurrency,
        balance: 0,
        isDefault: accounts.length === 0 // первый счёт делаем основным
      });
      setNewAccountName("");
      setMessage("Счёт создан");
      setTimeout(() => setMessage(""), 3000);
      // Обновляем список
      const snapshot = await getDocs(accountsRef);
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError("Ошибка создания счёта");
    }
  };

  // Удаление счёта
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

  // Переименование счёта
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
    <div className="container">
      <div className="card">
        <h2>Мои счета</h2>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {/* Форма создания счёта */}
        <form onSubmit={createAccount} style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Название счёта"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            required
            style={{ flex: 2 }}
          />
          <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} style={{ flex: 1 }}>
            <option value="RUB">Рубли (RUB)</option>
            <option value="USD">Доллары (USD)</option>
            <option value="EUR">Евро (EUR)</option>
          </select>
          <button type="submit">Создать счёт</button>
        </form>

        {/* Список счетов */}
        {accounts.length === 0 ? (
          <p>У вас пока нет счетов. Создайте первый!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {accounts.map(account => (
              <div key={account.id} style={{ background: "#0f172a", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{account.name}</h3>
                    <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
                      {account.currency} • {account.isDefault && "(Основной)"}
                    </p>
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#60a5fa" }}>
                    {account.balance?.toLocaleString()} {account.currency}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button
                    onClick={() => {
                      const newName = prompt("Новое название счёта", account.name);
                      if (newName) renameAccount(account.id, newName);
                    }}
                    style={{ background: "#3b82f6" }}
                  >
                    Переименовать
                  </button>
                  <button
                    onClick={() => deleteAccount(account.id, account.balance)}
                    style={{ background: "#6b7280" }}
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