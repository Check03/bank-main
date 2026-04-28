import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

const currencySymbols = {
  RUB: "₽",
  USD: "$",
  EUR: "€"
};

function ExchangeRates() {
  const [rates, setRates] = useState({ usd: null, eur: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchRates = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/RUB');
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      setRates({ usd: data.rates.USD, eur: data.rates.EUR });
      setLastUpdate(new Date());
    } catch (err) {
      setError('Не удалось загрузить курсы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 600000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loader" style={{ width: "24px", height: "24px", margin: "0 auto" }}></div>;
  if (error) return <div className="error-message" style={{ fontSize: "0.8rem", textAlign: "center" }}>{error}</div>;

  const rubPerUsd = rates.usd ? (1 / rates.usd).toFixed(2) : '—';
  const rubPerEur = rates.eur ? (1 / rates.eur).toFixed(2) : '—';
  const eurPerUsd = rates.usd && rates.eur ? (rates.eur / rates.usd).toFixed(4) : '—';

  return (
    <div style={{
      background: "#0f172a",
      padding: "0.75rem 1rem",
      borderRadius: "12px",
      marginBottom: "1.5rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "1rem",
      flexWrap: "wrap",
      fontSize: "0.9rem"
    }}>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <div><span style={{ color: "#94a3b8" }}>USD/RUB:</span> <strong style={{ color: "#60a5fa" }}>{rubPerUsd}</strong></div>
        <div><span style={{ color: "#94a3b8" }}>EUR/RUB:</span> <strong style={{ color: "#60a5fa" }}>{rubPerEur}</strong></div>
        <div><span style={{ color: "#94a3b8" }}>EUR/USD:</span> <strong style={{ color: "#60a5fa" }}>{eurPerUsd}</strong></div>
      </div>
      {lastUpdate && (
        <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
          Обновлено: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

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
        <ExchangeRates />

        {accounts.length === 0 && <p>Счетов пока нет. Создайте первый в разделе «Счета».</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ background: "#0f172a", borderRadius: "16px", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ flex: "1", textAlign: "left" }}>
                <h3 style={{ margin: 0 }}>
                  {acc.name} {acc.isDefault && <span style={{ fontSize: "0.8rem", background: "#3b82f6", padding: "0.2rem 0.5rem", borderRadius: "20px" }}>Основной</span>}
                </h3>
                <p style={{ color: "#94a3b8", margin: "0.25rem 0 0 0" }}>{acc.currency}</p>
              </div>
              <div style={{ flex: "2", textAlign: "center", fontSize: "1.8rem", fontWeight: "bold", background: "linear-gradient(135deg, #60a5fa, #a855f7)", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent", wordBreak: "break-word" }}>
                {acc.balance?.toLocaleString()} {currencySymbols[acc.currency] || acc.currency}
              </div>
              {!acc.isDefault && (
                <div style={{ flex: "1", textAlign: "right" }}>
                  <button onClick={() => setDefaultAccount(acc.id)} style={{ background: "#334155" }}>Сделать основным</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}