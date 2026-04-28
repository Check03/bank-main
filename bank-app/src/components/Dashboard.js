// src/components/Dashboard.js

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

// Символы валют для красивого отображения
const currencySymbols = {
  RUB: "₽",
  USD: "$",
  EUR: "€"
};

// Компонент для отображения курсов валют
function ExchangeRates() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Запрашиваем курсы USD и EUR к рублю (RUB)
        const response = await fetch('https://api.exchangerate.host/latest?base=RUB&symbols=USD,EUR');
        if (!response.ok) throw new Error('Ошибка загрузки курсов');
        const data = await response.json();
        setRates(data.rates);
      } catch (err) {
        console.error(err);
        setError('Не удалось загрузить курсы валют');
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    // Обновляем курсы каждые 10 минут (600000 миллисекунд)
    const interval = setInterval(fetchRates, 600000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loader" style={{ width: "20px", height: "20px", margin: "0" }}></div>;
  if (error) return <div className="error-message" style={{ fontSize: "0.8rem", margin: "0" }}>{error}</div>;

  return (
    <div style={{
      background: "#0f172a",
      padding: "0.75rem 1rem",
      borderRadius: "12px",
      marginBottom: "1.5rem",
      display: "flex",
      justifyContent: "space-around",
      textAlign: "center",
      gap: "1rem",
      flexWrap: "wrap"
    }}>
      <div>
        <span style={{ color: "#94a3b8" }}>USD/RUB:</span>
        <strong style={{ marginLeft: "0.5rem", color: "#60a5fa" }}>
          {rates ? (1 / rates.USD).toFixed(2) : "—"}
        </strong>
      </div>
      <div>
        <span style={{ color: "#94a3b8" }}>EUR/RUB:</span>
        <strong style={{ marginLeft: "0.5rem", color: "#60a5fa" }}>
          {rates ? (1 / rates.EUR).toFixed(2) : "—"}
        </strong>
      </div>
      <div>
        <span style={{ color: "#94a3b8" }}>EUR/USD:</span>
        <strong style={{ marginLeft: "0.5rem", color: "#60a5fa" }}>
          {rates ? ((1 / rates.EUR) / (1 / rates.USD)).toFixed(4) : "—"}
        </strong>
      </div>
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
        {/* 👇 Виджет курсов валют */}
        <ExchangeRates />

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