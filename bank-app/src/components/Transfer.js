import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, runTransaction, collection, getDocs, query, orderBy } from "firebase/firestore";
import { collection, getDocs, query, orderBy, where, doc, runTransaction } from "firebase/firestore";

export default function Transfer() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  // Загрузка контактов пользователя
  useEffect(() => {
    if (!currentUser) return;
    const fetchContacts = async () => {
      try {
        const contactsRef = collection(db, "users", currentUser.uid, "contacts");
        const q = query(contactsRef, orderBy("contactName", "asc"));
        const snapshot = await getDocs(q);
        const contactsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContacts(contactsList);
      } catch (err) {
        console.error(err);
      }
    };
    fetchContacts();
  }, [currentUser]);

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
      setError("Нельзя перевести самому себе");
      return;
    }
    setLoading(true);

    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(query(usersRef, where("email", "==", recipientEmail)));
      if (querySnapshot.empty) {
        setError("Пользователь не найден");
        setLoading(false);
        return;
      }
      const recipientDoc = querySnapshot.docs[0];
      const recipientId = recipientDoc.id;

      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, "users", currentUser.uid);
        const senderSnap = await transaction.get(senderRef);
        const senderBalance = senderSnap.data().balance;
        if (senderBalance < amountNum) throw new Error("Недостаточно средств");

        const recipientRef = doc(db, "users", recipientId);
        const recipientSnap = await transaction.get(recipientRef);
        transaction.update(senderRef, { balance: senderBalance - amountNum });
        transaction.update(recipientRef, { balance: recipientSnap.data().balance + amountNum });

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

      setSuccess(`Перевод ${amountNum} ₽ выполнен!`);
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

  const selectContact = (email) => {
    setRecipientEmail(email);
    setShowContacts(false);
  };

  return (
    <div style={styles.container}>
      <div className="card" style={styles.card}>
        <h2 style={styles.title}>Перевести средства</h2>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* Кнопка показа контактов */}
        {contacts.length > 0 && (
          <div>
            <button onClick={() => setShowContacts(!showContacts)} style={styles.contactsToggle}>
              {showContacts ? "Скрыть контакты" : "Быстрый перевод из контактов"}
            </button>
            {showContacts && (
              <ul style={styles.contactsList}>
                {contacts.map(contact => (
                  <li key={contact.id} onClick={() => selectContact(contact.contactEmail)} style={styles.contactItem}>
                    {contact.contactName} ({contact.contactEmail})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
            placeholder="Описание"
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

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "1rem" },
  card: { backgroundColor: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", width: "100%", maxWidth: "500px" },
  title: { textAlign: "center", marginBottom: "1rem", color: "#1e3a8a" },
  error: { backgroundColor: "#fee2e2", color: "#dc2626", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem" },
  success: { backgroundColor: "#dcfce7", color: "#16a34a", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  input: { padding: "0.75rem", border: "1px solid #ccc", borderRadius: "4px", fontSize: "1rem", width: "100%" },
  button: { backgroundColor: "#1e3a8a", color: "white", padding: "0.75rem", border: "none", borderRadius: "4px", fontSize: "1rem", cursor: "pointer", width: "100%" },
  contactsToggle: { backgroundColor: "#10b981", color: "white", padding: "0.5rem", border: "none", borderRadius: "4px", cursor: "pointer", width: "100%", marginBottom: "1rem" },
  contactsList: { listStyle: "none", padding: 0, marginBottom: "1rem", backgroundColor: "#f9fafb", borderRadius: "4px" },
  contactItem: { padding: "0.5rem", borderBottom: "1px solid #ddd", cursor: "pointer", "&:hover": { backgroundColor: "#e5e7eb" } }
};
// чтобы стиль hover работал, лучше добавить глобальный CSS, но для простоты оставляем как есть