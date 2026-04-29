import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";

const currencySymbols = {
  RUB: "₽",
  USD: "$",
  EUR: "€"
};

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загрузка всех счетов (onSnapshot)
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(
      collection(db, "users", currentUser.uid, "accounts"),
      (snapshot) => {
        const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAccounts(accs);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Загрузка транзакций
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

  // Переключение основного счёта
  const setDefaultAccount = async (accountId) => {
    try {
      const updates = accounts.map(acc =>
        updateDoc(doc(db, "users", currentUser.uid, "accounts", acc.id), { isDefault: acc.id === accountId })
      );
      await Promise.all(updates);
      setAccounts(accounts.map(acc => ({ ...acc, isDefault: acc.id === accountId })));
    } catch (err) {
      console.error("Не удалось сменить основной счёт", err);
    }
  };

  if (loading) return <div className="loader"></div>;

  return (
    <div className="container">
      {/* Блок всех счетов */}
      <div className="card">
        <h2>Мои счета</h2>
        {accounts.length === 0 ? (
          <p>У вас пока нет счетов. Создайте первый в разделе «Профиль».</p>
        ) : (
          <div className="accounts-list">
            {accounts.map(acc => (
              <div key={acc.id} className="account-card">
                <div className="account-header">
                  <div>
                    <h3>{acc.name}</h3>
                    <p className="account-details">
                      {acc.currency}
                      {acc.isDefault && <span className="main-badge">Основной</span>}
                    </p>
                  </div>
                  <div className="account-balance">
                    {acc.balance?.toLocaleString()} {currencySymbols[acc.currency] || acc.currency}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* История транзакций */}
      <div className="card">
        <h3>История переводов</h3>
        {transactions.length === 0 ? (
          <p>Нет транзакций</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {transactions.map((tx) => (
              <div key={tx.id} className="transaction-item" style={{ borderBottom: "1px solid #e5e7eb", padding: "0.75rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong>{tx.from === currentUser.uid ? "→ Перевод отправлен" : "← Перевод получен"}</strong>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {tx.from === currentUser.uid ? `Получатель: ${tx.toEmail}` : `Отправитель: ${tx.fromEmail}`}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{tx.description || "Без описания"}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    {tx.timestamp?.toDate?.().toLocaleString()}
                  </div>
                </div>
                <div style={{ fontWeight: "bold", color: tx.from === currentUser.uid ? "var(--danger)" : "var(--success)" }}>
                  {tx.from === currentUser.uid ? "-" : "+"}{tx.amount.toLocaleString()} {tx.fromAccountCurrency}
                  {tx.fromAccountCurrency !== tx.toAccountCurrency && (
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
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