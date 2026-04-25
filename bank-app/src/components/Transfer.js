import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc, runTransaction, collection, addDoc } from "firebase/firestore";

export default function Transfer() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Введите корректную сумму");
      return;
    }

    if (recipientEmail === currentUser.email) {
      setError("Нельзя перевести средства самому себе");
      return;
    }

    setLoading(true);

    try {
      // Ищем получателя по email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", recipientEmail));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("Пользователь с таким email не найден");
        setLoading(false);
        return;
      }

      const recipientDoc = querySnapshot.docs[0];
      const recipientData = recipientDoc.data();
      const recipientId = recipientDoc.id;

      // Выполняем транзакцию для перевода
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, "users", currentUser.uid);
        const senderSnap = await transaction.get(senderRef);
        if (!senderSnap.exists()) {
          throw new Error("Данные отправителя не найдены");
        }
        const senderBalance = senderSnap.data().balance;
        if (senderBalance < amountNum) {
          throw new Error("Недостаточно средств");
        }

        const recipientRef = doc(db, "users", recipientId);
        const recipientSnap = await transaction.get(recipientRef);
        if (!recipientSnap.exists()) {
          throw new Error("Данные получателя не найдены");
        }

        // Обновляем балансы
        transaction.update(senderRef, { balance: senderBalance - amountNum });
        transaction.update(recipientRef, { balance: recipientSnap.data().balance + amountNum });

        // Добавляем запись о транзакции
        const transactionRef = collection(db, "transactions");
        transaction.set(doc(transactionRef), {
          from: currentUser.uid,
          to: recipientId,
          fromEmail: currentUser.email,
          toEmail: recipientEmail,
          amount: amountNum,
          description: description,
          timestamp: new Date()
        });
      });

      setSuccess(`Перевод ${amountNum} ₽ успешно выполнен!`);
      setRecipientEmail("");
      setAmount("");
      setDescription("");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Перевести средства</h2>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email получателя"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="number"
            placeholder="Сумма (₽)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
            required
            min="0.01"
            step="0.01"
          />
          <input
            type="text"
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Обработка..." : "Отправить перевод"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Добавляем недостающий импорт
import { query, where, getDocs } from "firebase/firestore";

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" },
  card: { backgroundColor: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", width: "100%", maxWidth: "500px" },
  title: { textAlign: "center", marginBottom: "1.5rem", color: "#1e3a8a" },
  error: { backgroundColor: "#fee2e2", color: "#dc2626", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem", textAlign: "center" },
  success: { backgroundColor: "#dcfce7", color: "#16a34a", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem", textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  input: { padding: "0.75rem", border: "1px solid #ccc", borderRadius: "4px", fontSize: "1rem" },
  button: { backgroundColor: "#1e3a8a", color: "white", padding: "0.75rem", border: "none", borderRadius: "4px", fontSize: "1rem", cursor: "pointer" }
};