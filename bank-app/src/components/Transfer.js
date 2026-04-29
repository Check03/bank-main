import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, runTransaction, collection, getDocs, query, where } from "firebase/firestore";
import { convertAmount } from "../utils/currencyRates";

export default function Transfer() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [selectedFromAccount, setSelectedFromAccount] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  // Загрузка счетов отправителя
  useEffect(() => {
    if (!currentUser) return;
    const fetchAccounts = async () => {
      const accountsRef = collection(db, "users", currentUser.uid, "accounts");
      const snapshot = await getDocs(accountsRef);
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accs);
      if (accs.length > 0 && !selectedFromAccount) {
        const defaultAcc = accs.find(acc => acc.isDefault);
        setSelectedFromAccount(defaultAcc ? defaultAcc.id : accs[0].id);
      }
    };
    fetchAccounts();
  }, [currentUser]);

  // Загрузка контактов (друзей)
  useEffect(() => {
    if (!currentUser) return;
    const fetchContacts = async () => {
      try {
        const contactsRef = collection(db, "users", currentUser.uid, "friends");
        const snapshot = await getDocs(contactsRef);
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
    if (!selectedFromAccount) {
      setError("Выберите счёт списания");
      return;
    }
    if (recipientEmail === currentUser.email) {
      setError("Нельзя перевести самому себе");
      return;
    }

    setLoading(true);

    try {
      // 1. Найти получателя по email
      const usersRef = collection(db, "users");
      const qUser = query(usersRef, where("email", "==", recipientEmail));
      const userSnap = await getDocs(qUser);
      if (userSnap.empty) {
        setError("Пользователь не найден");
        setLoading(false);
        return;
      }
      const recipientUser = userSnap.docs[0];
      const recipientId = recipientUser.id;

      // 2. Найти основной счёт получателя (или любой, если основного нет)
      const recipientAccountsRef = collection(db, "users", recipientId, "accounts");
      const recAccSnap = await getDocs(recipientAccountsRef);
      if (recAccSnap.empty) {
        setError("У получателя нет счетов");
        setLoading(false);
        return;
      }
      let recipientAccount = recAccSnap.docs.find(doc => doc.data().isDefault);
      if (!recipientAccount) recipientAccount = recAccSnap.docs[0];
      const recipientAccountData = recipientAccount.data();
      const recipientAccountId = recipientAccount.id;

      // 3. Данные счёта отправителя
      const senderAccountRef = doc(db, "users", currentUser.uid, "accounts", selectedFromAccount);

      await runTransaction(db, async (transaction) => {
        const senderDocSnap = await transaction.get(senderAccountRef);
        if (!senderDocSnap.exists()) throw new Error("Счёт списания не найден");
        const senderBalance = senderDocSnap.data().balance;
        const senderCurrency = senderDocSnap.data().currency;
        if (senderBalance < amountNum) throw new Error("Недостаточно средств на счёте");

        // Конвертация суммы в валюту счёта получателя (через реальный API)
        const recipientCurrency = recipientAccountData.currency;
        let amountToRecipient = amountNum;
        if (senderCurrency !== recipientCurrency) {
          amountToRecipient = await convertAmount(amountNum, senderCurrency, recipientCurrency);
        }

        // Обновление балансов
        transaction.update(senderAccountRef, { balance: senderBalance - amountNum });
        const recipientAccountRef = doc(db, "users", recipientId, "accounts", recipientAccountId);
        const recDocSnap = await transaction.get(recipientAccountRef);
        const newRecBalance = (recDocSnap.data().balance || 0) + amountToRecipient;
        transaction.update(recipientAccountRef, { balance: newRecBalance });

        // Запись транзакции
        const transactionRef = collection(db, "transactions");
        transaction.set(doc(transactionRef), {
          from: currentUser.uid,
          to: recipientId,
          fromEmail: currentUser.email,
          toEmail: recipientEmail,
          fromAccountId: selectedFromAccount,
          fromAccountCurrency: senderCurrency,
          toAccountId: recipientAccountId,
          toAccountCurrency: recipientCurrency,
          amount: amountNum,
          amountConverted: amountToRecipient,
          description: description,
          timestamp: new Date()
        });
      });

      setSuccess(`Перевод ${amountNum} ${accounts.find(a => a.id === selectedFromAccount)?.currency} → ${recipientAccountData.currency} ${convertedAmountPreview} выполнен!`);
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

  const fromAccount = accounts.find(acc => acc.id === selectedFromAccount);

  // Для отображения примерной конвертации (необязательно)
  const [convertedAmountPreview, setConvertedAmountPreview] = useState(null);
  useEffect(() => {
    if (!fromAccount || !recipientEmail || !amount || amount <= 0) {
      setConvertedAmountPreview(null);
      return;
    }
    const fetchPreview = async () => {
      try {
        // быстро ищем получателя для preview (без транзакции)
        const usersRef = collection(db, "users");
        const qUser = query(usersRef, where("email", "==", recipientEmail));
        const userSnap = await getDocs(qUser);
        if (!userSnap.empty) {
          const recId = userSnap.docs[0].id;
          const recAccSnap = await getDocs(collection(db, "users", recId, "accounts"));
          const recAccount = recAccSnap.docs.find(d => d.data().isDefault) || recAccSnap.docs[0];
          if (recAccount && recAccount.data().currency !== fromAccount.currency) {
            const converted = await convertAmount(parseFloat(amount), fromAccount.currency, recAccount.data().currency);
            setConvertedAmountPreview(converted);
            return;
          }
        }
        setConvertedAmountPreview(null);
      } catch (err) {
        setConvertedAmountPreview(null);
      }
    };
    fetchPreview();
  }, [fromAccount, recipientEmail, amount]);

  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: "600px", width: "100%" }}>
        <h2>Перевести средства</h2>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {contacts.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <button onClick={() => setShowContacts(!showContacts)} style={{ background: "#10b981", width: "100%" }}>
              {showContacts ? "Скрыть контакты" : "Быстрый перевод из контактов"}
            </button>
            {showContacts && (
              <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem", background: "#0f172a", borderRadius: "12px" }}>
                {contacts.map(contact => (
                  <li key={contact.id} onClick={() => selectContact(contact.friendEmail)} style={{ padding: "0.5rem", borderBottom: "1px solid #334155", cursor: "pointer" }}>
                    {contact.friendName} ({contact.friendEmail})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label>Счёт списания</label>
            <select value={selectedFromAccount} onChange={(e) => setSelectedFromAccount(e.target.value)} required>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency}) — {acc.balance?.toLocaleString()} {acc.currency}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Email получателя</label>
            <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
          </div>
          <div>
            <label>Сумма в валюте счёта списания ({fromAccount?.currency})</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            {convertedAmountPreview !== null && amount > 0 && (
              <small>Получатель получит ≈ {convertedAmountPreview} (в валюте его счёта)</small>
            )}
          </div>
          <div>
            <label>Описание (необязательно)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="button-primary">
            {loading ? "Обработка..." : "Отправить перевод"}
          </button>
        </form>
      </div>
    </div>
  );
}