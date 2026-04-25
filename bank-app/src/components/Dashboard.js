import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // Загрузка данных пользователя
    const userDocRef = doc(db, "users", currentUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    });

    // Загрузка транзакций (где пользователь отправитель или получатель)
    const transactionsRef = collection(db, "transactions");
    const q = query(
      transactionsRef,
      where("from", "in", [currentUser.uid, "dummy"]), // Firestore требует массив, но нам нужно OR, поэтому два запроса
      orderBy("timestamp", "desc")
    );
    // Лучше сделать два запроса и объединить, но для простоты сделаем один с условием
    // Используем два запроса
    const qFrom = query(transactionsRef, where("from", "==", currentUser.uid), orderBy("timestamp", "desc"));
    const qTo = query(transactionsRef, where("to", "==", currentUser.uid), orderBy("timestamp", "desc"));

    const unsubscribeFrom = onSnapshot(qFrom, (snapshot) => {
      const fromTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const unsubscribeTo = onSnapshot(qTo, (snapshotTo) => {
        const toTransactions = snapshotTo.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const all = [...fromTransactions, ...toTransactions];
        all.sort((a, b) => b.timestamp?.toDate?.() - a.timestamp?.toDate?.());
        setTransactions(all);
        setLoading(false);
      });
      return () => unsubscribeTo();
    });

    return () => {
      unsubscribeUser();
      unsubscribeFrom();
    };
  }, [currentUser]);

  if (loading) return <div style={styles.loading}>Загрузка...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Добро пожаловать, {userData?.name}!</h2>
        <div style={styles.balanceCard}>
          <p style={styles.balanceLabel}>Ваш баланс</p>
          <p style={styles.balanceAmount}>{userData?.balance?.toLocaleString()} ₽</p>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>История операций</h3>
        {transactions.length === 0 ? (
          <p>Нет транзакций</p>
        ) : (
          <div style={styles.transactionsList}>
            {transactions.map((tx) => (
              <div key={tx.id} style={styles.transactionItem}>
                <div style={styles.transactionInfo}>
                  <strong>
                    {tx.from === currentUser.uid ? "→ Перевод отправлен" : "← Перевод получен"}
                  </strong>
                  <div style={styles.transactionDetails}>
                    {tx.from === currentUser.uid ? `Получатель: ${tx.toEmail}` : `Отправитель: ${tx.fromEmail}`}
                  </div>
                  <div style={styles.transactionDesc}>{tx.description || "Без описания"}</div>
                  <div style={styles.transactionDate}>
                    {tx.timestamp?.toDate?.().toLocaleString()}
                  </div>
                </div>
                <div style={{
                  ...styles.transactionAmount,
                  color: tx.from === currentUser.uid ? "#dc2626" : "#16a34a"
                }}>
                  {tx.from === currentUser.uid ? "-" : "+"}{tx.amount.toLocaleString()} ₽
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: "1000px", margin: "2rem auto", padding: "0 1rem" },
  card: { backgroundColor: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", padding: "1.5rem", marginBottom: "2rem" },
  balanceCard: { textAlign: "center", marginTop: "1rem" },
  balanceLabel: { fontSize: "1rem", color: "#6b7280" },
  balanceAmount: { fontSize: "2.5rem", fontWeight: "bold", color: "#1e3a8a" },
  sectionTitle: { marginBottom: "1rem", color: "#1e3a8a" },
  transactionsList: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  transactionItem: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", padding: "0.75rem 0" },
  transactionInfo: { flex: 1 },
  transactionDetails: { fontSize: "0.875rem", color: "#4b5563" },
  transactionDesc: { fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" },
  transactionDate: { fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.25rem" },
  transactionAmount: { fontSize: "1.1rem", fontWeight: "bold" },
  loading: { textAlign: "center", marginTop: "3rem", fontSize: "1.2rem" }
};