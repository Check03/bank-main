import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, runTransaction, collection, getDocs, query, where } from "firebase/firestore";
import { convertAmount } from "../utils/currencyRates";

export default function Transfer() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [transferType, setTransferType] = useState("email");
  const [accounts, setAccounts] = useState([]);
  const [selectedFromAccount, setSelectedFromAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Для перевода по email
  const [recipientEmail, setRecipientEmail] = useState("");
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);
  const [convertedPreview, setConvertedPreview] = useState(null);
  
  // Для внутреннего перевода
  const [toAccountId, setToAccountId] = useState("");
  const [internalConverted, setInternalConverted] = useState(null);
  
  // Загрузка счетов
  useEffect(() => {
    if (!currentUser) return;
    const fetchAccounts = async () => {
      const snapshot = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accs);
    };
    fetchAccounts();
  }, [currentUser]);
  
  // Установка счёта по умолчанию
  useEffect(() => {
    if (accounts.length > 0 && !selectedFromAccount) {
      const defaultAcc = accounts.find(acc => acc.isDefault);
      setSelectedFromAccount(defaultAcc ? defaultAcc.id : accounts[0].id);
    }
  }, [accounts, selectedFromAccount]);
  
  // Загрузка контактов (друзей)
  useEffect(() => {
    if (!currentUser) return;
    const fetchContacts = async () => {
      try {
        const contactsRef = collection(db, "users", currentUser.uid, "friends");
        const snapshot = await getDocs(contactsRef);
        setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    fetchContacts();
  }, [currentUser]);
  
  // Предпросмотр конвертации для перевода по email
  useEffect(() => {
    if (transferType !== "email" || !selectedFromAccount || !recipientEmail || !amount || amount <= 0) {
      setConvertedPreview(null);
      return;
    }
    const fetchPreview = async () => {
      try {
        const fromAcc = accounts.find(a => a.id === selectedFromAccount);
        if (!fromAcc) return;
        const usersRef = collection(db, "users");
        const qUser = query(usersRef, where("email", "==", recipientEmail));
        const userSnap = await getDocs(qUser);
        if (!userSnap.empty) {
          const recId = userSnap.docs[0].id;
          const recAccSnap = await getDocs(collection(db, "users", recId, "accounts"));
          const recAccount = recAccSnap.docs.find(d => d.data().isDefault) || recAccSnap.docs[0];
          if (recAccount && recAccount.data().currency !== fromAcc.currency) {
            const converted = await convertAmount(parseFloat(amount), fromAcc.currency, recAccount.data().currency);
            setConvertedPreview(converted);
            return;
          }
        }
        setConvertedPreview(null);
      } catch (err) {
        setConvertedPreview(null);
      }
    };
    fetchPreview();
  }, [transferType, selectedFromAccount, recipientEmail, amount, accounts]);
  
  // Предпросмотр для внутреннего перевода
  useEffect(() => {
    if (transferType !== "internal" || !selectedFromAccount || !toAccountId || !amount || amount <= 0) {
      setInternalConverted(null);
      return;
    }
    const fromAcc = accounts.find(a => a.id === selectedFromAccount);
    const toAcc = accounts.find(a => a.id === toAccountId);
    if (fromAcc && toAcc) {
      if (fromAcc.currency !== toAcc.currency) {
        convertAmount(parseFloat(amount), fromAcc.currency, toAcc.currency)
          .then(res => setInternalConverted(res))
          .catch(() => setInternalConverted(null));
      } else {
        setInternalConverted(parseFloat(amount));
      }
    } else {
      setInternalConverted(null);
    }
  }, [transferType, selectedFromAccount, toAccountId, amount, accounts]);
  
  const fromAccount = accounts.find(acc => acc.id === selectedFromAccount);
  
  // Обработчик перевода по email
  const handleEmailTransfer = async (amountNum, recipientId, recipientAccountData, recipientAccountId) => {
    const senderAccountRef = doc(db, "users", currentUser.uid, "accounts", selectedFromAccount);
    await runTransaction(db, async (transaction) => {
      const senderDocSnap = await transaction.get(senderAccountRef);
      if (!senderDocSnap.exists()) throw new Error("Счёт списания не найден");
      const senderBalance = senderDocSnap.data().balance;
      const senderCurrency = senderDocSnap.data().currency;
      if (senderBalance < amountNum) throw new Error("Недостаточно средств");
      
      let amountToRecipient = amountNum;
      if (senderCurrency !== recipientAccountData.currency) {
        amountToRecipient = await convertAmount(amountNum, senderCurrency, recipientAccountData.currency);
      }
      
      transaction.update(senderAccountRef, { balance: senderBalance - amountNum });
      const recipientAccountRef = doc(db, "users", recipientId, "accounts", recipientAccountId);
      const recDocSnap = await transaction.get(recipientAccountRef);
      transaction.update(recipientAccountRef, { balance: (recDocSnap.data().balance || 0) + amountToRecipient });
      
      const transactionRef = collection(db, "transactions");
      transaction.set(doc(transactionRef), {
        from: currentUser.uid, to: recipientId,
        fromEmail: currentUser.email, toEmail: recipientEmail,
        fromAccountId: selectedFromAccount, fromAccountCurrency: senderCurrency,
        toAccountId: recipientAccountId, toAccountCurrency: recipientAccountData.currency,
        amount: amountNum, amountConverted: amountToRecipient,
        description, timestamp: new Date()
      });
    });
    return `Перевод ${amountNum} ${fromAccount?.currency} → ${recipientAccountData.currency} ${convertedPreview?.toFixed(2)} выполнен!`;
  };
  
  // Обработчик внутреннего перевода
  const handleInternalTransfer = async (amountNum, toAcc) => {
    let finalToAmount = amountNum;
    if (fromAccount.currency !== toAcc.currency) {
      finalToAmount = await convertAmount(amountNum, fromAccount.currency, toAcc.currency);
    }
    await runTransaction(db, async (transaction) => {
      const fromRef = doc(db, "users", currentUser.uid, "accounts", selectedFromAccount);
      const toRef = doc(db, "users", currentUser.uid, "accounts", toAccountId);
      const fromSnap = await transaction.get(fromRef);
      if (fromSnap.data().balance < amountNum) throw new Error("Недостаточно средств");
      transaction.update(fromRef, { balance: fromSnap.data().balance - amountNum });
      const toSnap = await transaction.get(toRef);
      transaction.update(toRef, { balance: toSnap.data().balance + finalToAmount });
    });
    return `Переведено ${amountNum} ${fromAccount.currency} → ${finalToAmount} ${toAcc.currency}`;
  };
  
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
    
    setLoading(true);
    try {
      let successMessage = "";
      if (transferType === "email") {
        if (!recipientEmail) {
          setError("Введите email получателя");
          setLoading(false);
          return;
        }
        if (recipientEmail === currentUser.email) {
          setError("Нельзя перевести самому себе");
          setLoading(false);
          return;
        }
        const usersRef = collection(db, "users");
        const qUser = query(usersRef, where("email", "==", recipientEmail));
        const userSnap = await getDocs(qUser);
        if (userSnap.empty) throw new Error("Пользователь не найден");
        const recipientUser = userSnap.docs[0];
        const recipientId = recipientUser.id;
        
        const recipientAccountsRef = collection(db, "users", recipientId, "accounts");
        const recAccSnap = await getDocs(recipientAccountsRef);
        if (recAccSnap.empty) throw new Error("У получателя нет счетов");
        let recipientAccount = recAccSnap.docs.find(doc => doc.data().isDefault);
        if (!recipientAccount) recipientAccount = recAccSnap.docs[0];
        const recipientAccountData = recipientAccount.data();
        const recipientAccountId = recipientAccount.id;
        
        successMessage = await handleEmailTransfer(amountNum, recipientId, recipientAccountData, recipientAccountId);
        setRecipientEmail("");
      } else {
        if (!toAccountId) {
          setError("Выберите счёт зачисления");
          setLoading(false);
          return;
        }
        if (selectedFromAccount === toAccountId) {
          setError("Нельзя перевести на тот же счёт");
          setLoading(false);
          return;
        }
        const toAcc = accounts.find(a => a.id === toAccountId);
        if (!toAcc) throw new Error("Счёт получателя не найден");
        successMessage = await handleInternalTransfer(amountNum, toAcc);
        setToAccountId("");
      }
      
      setSuccess(successMessage);
      setAmount("");
      setDescription("");
      
      // Обновить балансы счетов
      const snapshot = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
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
    <div className="container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: "650px", width: "100%" }}>
        <h2>Перевод средств</h2>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", justifyContent: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="radio" value="email" checked={transferType === "email"} onChange={() => setTransferType("email")} />
            Перевод по email
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="radio" value="internal" checked={transferType === "internal"} onChange={() => setTransferType("internal")} />
            Между своими счетами
          </label>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label>Счёт списания</label>
            <select value={selectedFromAccount} onChange={(e) => setSelectedFromAccount(e.target.value)} required>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency}) — {acc.balance?.toLocaleString()} {acc.currency}</option>
              ))}
            </select>
          </div>
          
          {transferType === "email" ? (
            <>
              {contacts.length > 0 && (
                <div>
                  <button type="button" onClick={() => setShowContacts(!showContacts)} style={{ background: "#10b981", width: "100%" }}>
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
              <div>
                <label>Email получателя</label>
                <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
              </div>
            </>
          ) : (
            <div>
              <label>Счёт зачисления</label>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} required>
                <option value="">Выберите счёт</option>
                {accounts.filter(acc => acc.id !== selectedFromAccount).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency}) — {acc.balance?.toLocaleString()} {acc.currency}</option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label>Сумма в валюте счёта списания ({fromAccount?.currency})</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            {transferType === "email" && convertedPreview !== null && amount > 0 && (
              <small>Получатель получит ≈ {convertedPreview.toFixed(2)} (в валюте его счёта)</small>
            )}
            {transferType === "internal" && internalConverted !== null && amount > 0 && (
              <small>Счёт зачисления получит ≈ {internalConverted.toFixed(2)} {accounts.find(a => a.id === toAccountId)?.currency}</small>
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