import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

const currencySymbols = { RUB: "₽", USD: "$", EUR: "€" };

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загрузка счетов
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(
      collection(db, "users", currentUser.uid, "accounts"),
      (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Загрузка транзакций (отправленные и полученные)
  useEffect(() => {
    if (!currentUser) return;
    const transactionsRef = collection(db, "transactions");
    const qFrom = query(transactionsRef, where("from", "==", currentUser.uid), orderBy("timestamp", "desc"));
    const qTo = query(transactionsRef, where("to", "==", currentUser.uid), orderBy("timestamp", "desc"));

    let fromTransactions = [];
    let toTransactions = [];

    const combineAndSet = () => {
      const all = [...fromTransactions, ...toTransactions];
      all.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
      setTransactions(all);
    };

    const unsubscribeFrom = onSnapshot(qFrom, (snapshot) => {
      fromTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      combineAndSet();
    });
    const unsubscribeTo = onSnapshot(qTo, (snapshot) => {
      toTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      combineAndSet();
    });

    return () => {
      unsubscribeFrom();
      unsubscribeTo();
    };
  }, [currentUser]);

  // Основной счёт (для отображения баланса)
  const mainAccount = accounts.find(acc => acc.isDefault) || accounts[0];

  if (loading) return <div className="loader"></div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Ваши счета</h2>
        {accounts.length === 0 && <p>Счетов пока нет. Создайте первый в разделе «Профиль».</p>}
        {mainAccount && (
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "1rem", color: "#6b7280" }}>Основной счёт: {mainAccount.name}</p>
            <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e3a8a" }}>
              {mainAccount.balance?.toLocaleString()} {currencySymbols[mainAccount.currency] || mainAccount.currency}
            </p>
          </div>
        )}
      </div>

      {/* История операций */}
      <div className="card">
        <h3>История переводов</h3>
        {transactions.length === 0 ? (
          <p>Нет транзакций</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {transactions.map((tx) => (
              <div key={tx.id} style={{ borderBottom: "1px solid #e5e7eb", padding: "0.75rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong>{tx.from === currentUser.uid ? "→ Перевод отправлен" : "← Перевод получен"}</strong>
                  <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                    {tx.from === currentUser.uid ? `Получатель: ${tx.toEmail}` : `Отправитель: ${tx.fromEmail}`}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{tx.description || "Без описания"}</div>
                  <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
                    {tx.timestamp?.toDate?.().toLocaleString()}
                  </div>
                </div>
                <div style={{ fontWeight: "bold", color: tx.from === currentUser.uid ? "#dc2626" : "#16a34a" }}>
                  {tx.from === currentUser.uid ? "-" : "+"}{tx.amount.toLocaleString()} {tx.fromAccountCurrency}
                  {tx.fromAccountCurrency !== tx.toAccountCurrency && (
                    <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                      → {tx.amountConverted?.toLocaleString()} {tx.toAccountCurrency}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}