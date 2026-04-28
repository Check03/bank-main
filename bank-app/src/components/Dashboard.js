import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

const currencySymbols = {
  RUB: "₽",
  USD: "$",
  EUR: "€"
};

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const fetchAccounts = async () => {
      try {
        const accountsRef = collection(db, "users", currentUser.uid, "accounts");
        const snapshot = await getDocs(accountsRef);
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setError("Ошибка загрузки счетов");
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [currentUser]);

  const setDefaultAccount = async (accountId) => {
    try {
      const updates = accounts.map(acc => {
        const ref = doc(db, "users", currentUser.uid, "accounts", acc.id);
        return updateDoc(ref, { isDefault: acc.id === accountId });
      });
      await Promise.all(updates);
      setAccounts(accounts.map(acc => ({ ...acc, isDefault: acc.id === accountId })));
    } catch (err) {
      setError("Не удалось сменить основной счёт");
    }
  };

  if (loading) return <div className="loader"></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Ваши счета</h2>
        {accounts.length === 0 && <p>Счетов пока нет. Создайте первый в разделе «Счета».</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ background: "#0f172a", borderRadius: "16px", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  {acc.name} {acc.isDefault && <span style={{ fontSize: "0.8rem", background: "#3b82f6", padding: "0.2rem 0.5rem", borderRadius: "20px" }}>Основной</span>}
                </h3>
                <p style={{ color: "#94a3b8" }}>{acc.currency}</p>
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", background: "linear-gradient(135deg, #60a5fa, #a855f7)", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
                {acc.balance?.toLocaleString()} {currencySymbols[acc.currency] || acc.currency}
              </div>
              {!acc.isDefault && (
                <button onClick={() => setDefaultAccount(acc.id)} style={{ background: "#334155" }}>Сделать основным</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}