import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, updateDoc, collection, getDocs, addDoc, deleteDoc, getDoc } from "firebase/firestore";
import { updateEmail, updatePassword } from "firebase/auth";

export default function ProfileAndAccounts() {
  const { currentUser } = useAuth();
  
  // --- Данные профиля ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // --- Данные счетов ---
  const [accounts, setAccounts] = useState([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [newCurrency, setNewCurrency] = useState("RUB");
  const [accountsMessage, setAccountsMessage] = useState("");
  const [accountsError, setAccountsError] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Загрузка профиля при монтировании
  useEffect(() => {
    if (!currentUser) return;
    const fetchUserData = async () => {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setName(userDoc.data().name || "");
      }
      setEmail(currentUser.email);
    };
    fetchUserData();
  }, [currentUser]);

  // Загрузка счетов
  useEffect(() => {
    if (!currentUser) return;
    const fetchAccounts = async () => {
      try {
        const snapshot = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setAccountsError("Ошибка загрузки счетов");
      } finally {
        setAccountsLoading(false);
      }
    };
    fetchAccounts();
  }, [currentUser]);

  // --- Обработчики профиля ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setProfileLoading(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { name });
      if (email !== currentUser.email) {
        await updateEmail(currentUser, email);
      }
      if (newPassword.length >= 6) {
        await updatePassword(currentUser, newPassword);
        setNewPassword("");
      }
      setProfileMessage("Профиль обновлён!");
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // --- Обработчики счетов ---
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
        isDefault: isFirst
      });
      setNewAccountName("");
      setAccountsMessage("Счёт создан");
      setTimeout(() => setAccountsMessage(""), 3000);
      // Обновить список
      const snapshot = await getDocs(accountsRef);
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setAccountsError("Ошибка создания счёта");
    }
  };

  const setDefaultAccount = async (accountId) => {
    try {
      const updates = accounts.map(acc =>
        updateDoc(doc(db, "users", currentUser.uid, "accounts", acc.id), { isDefault: acc.id === accountId })
      );
      await Promise.all(updates);
      setAccounts(accounts.map(acc => ({ ...acc, isDefault: acc.id === accountId })));
      setAccountsMessage("Основной счёт изменён");
      setTimeout(() => setAccountsMessage(""), 3000);
    } catch (err) {
      setAccountsError("Не удалось сменить основной счёт");
    }
  };

  const deleteAccount = async (accountId, balance) => {
    if (balance !== 0) {
      setAccountsError("Можно удалить только счёт с нулевым балансом");
      return;
    }
    if (!window.confirm("Удалить счёт?")) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "accounts", accountId));
      setAccounts(accounts.filter(acc => acc.id !== accountId));
      setAccountsMessage("Счёт удалён");
      setTimeout(() => setAccountsMessage(""), 3000);
    } catch (err) {
      setAccountsError("Ошибка удаления счёта");
    }
  };

  const renameAccount = async (accountId, currentName) => {
    const newName = prompt("Новое название счёта", currentName);
    if (!newName?.trim()) return;
    try {
      await updateDoc(doc(db, "users", currentUser.uid, "accounts", accountId), { name: newName.trim() });
      setAccounts(accounts.map(acc => acc.id === accountId ? { ...acc, name: newName.trim() } : acc));
      setAccountsMessage("Название изменено");
      setTimeout(() => setAccountsMessage(""), 3000);
    } catch (err) {
      setAccountsError("Ошибка переименования");
    }
  };

  const currencySymbols = { RUB: "₽", USD: "$", EUR: "€" };

  return (
    <div className="container" style={{ maxWidth: "800px", margin: "2rem auto" }}>
      {/* Раздел профиля */}
      <div className="card">
        <h2>Профиль</h2>
        {profileMessage && <div className="success-message">{profileMessage}</div>}
        {profileError && <div className="error-message">{profileError}</div>}
        <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="text" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Новый пароль (оставьте пустым, чтобы не менять)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <button type="submit" disabled={profileLoading}>{profileLoading ? "Сохранение..." : "Сохранить профиль"}</button>
        </form>
      </div>

      {/* Раздел счетов */}
      <div className="card">
        <h2>Мои счета</h2>
        {accountsMessage && <div className="success-message">{accountsMessage}</div>}
        {accountsError && <div className="error-message">{accountsError}</div>}
        
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

        {accountsLoading ? (
          <div className="loader"></div>
        ) : accounts.length === 0 ? (
          <p>У вас пока нет счетов. Создайте первый!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{ background: "#0f172a", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{acc.name}</h3>
                    <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
                      {acc.currency} • {acc.isDefault && <span className="main-badge" style={{ background: "#3b82f6", padding: "0.2rem 0.5rem", borderRadius: "20px", fontSize: "0.7rem", marginLeft: "0.5rem" }}>Основной</span>}
                    </p>
                  </div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#60a5fa" }}>
                    {acc.balance?.toLocaleString()} {currencySymbols[acc.currency] || acc.currency}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
                  <button onClick={() => renameAccount(acc.id, acc.name)} style={{ background: "#3b82f6" }}>Переименовать</button>
                  {!acc.isDefault && (
                    <button onClick={() => setDefaultAccount(acc.id)} style={{ background: "#f59e0b" }}>Сделать основным</button>
                  )}
                  <button onClick={() => deleteAccount(acc.id, acc.balance)} style={{ background: "#6b7280" }} disabled={acc.balance !== 0}>
                    Удалить {acc.balance !== 0 && "(сначала обнулите)"}
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