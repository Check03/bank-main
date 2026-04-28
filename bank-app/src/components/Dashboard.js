import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const fetchAccounts = async () => {
      try {
        const accountsRef = collection(db, "users", currentUser.uid, "accounts");
        const snapshot = await getDocs(accountsRef);
        const accountsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAccounts(accountsList);
        setLoading(false);
      } catch (err) {
        console.error("Ошибка загрузки счетов:", err);
        setError("Не удалось загрузить счета");
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [currentUser]);

  const setDefaultAccount = async (accountId) => {
    try {
      const batch = [];
      for (const acc of accounts) {
        const accRef = doc(db, "users", currentUser.uid, "accounts", acc.id);
        if (acc.id === accountId) {
          batch.push(updateDoc(accRef, { isDefault: true }));
        } else if (acc.isDefault) {
          batch.push(updateDoc(accRef, { isDefault: false }));
        }
      }
      await Promise.all(batch);
      setAccounts(accounts.map(acc => ({
        ...acc,
        isDefault: acc.id === accountId
      })));
    } catch (err) {
      setError("Ошибка установки основного счета");
    }
  };

  if (loading) return <div className="loader"></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Ваши счета</h2>
        {accounts.length === 0 ? (
          <p>У вас пока нет счетов. Создайте первый в разделе «Счета».</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {accounts.map(account => (
              <div key={account.id} style={{ background: "#0f172a", borderRadius: "16px", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0 }}>{account.name} {account.isDefault && <span style={{ fontSize: "0.8rem", background: "#3b82f6", padding: "0.2rem 0.5rem", borderRadius: "20px" }}>Основной</span>}</h3>
                  <p style={{ color: "#94a3b8" }}>{account.currency}</p>
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: "bold", background: "linear-gradient(135deg, #60a5fa, #a855f7)", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
                  {account.balance?.toLocaleString()} {account.currency}
                </div>
                {!account.isDefault && (
                  <button onClick={() => setDefaultAccount(account.id)} style={{ background: "#334155" }}>Сделать основным</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}