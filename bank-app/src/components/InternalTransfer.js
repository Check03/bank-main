import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, doc, runTransaction } from "firebase/firestore";
import { convertAmount } from "../utils/currencyRates";

export default function InternalTransfer() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    const fetchAccounts = async () => {
      const snapshot = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchAccounts();
  }, [currentUser]);

  useEffect(() => {
    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      setConvertedAmount(null);
      return;
    }
    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);
    if (fromAcc && toAcc && fromAcc.currency !== toAcc.currency) {
      convertAmount(parseFloat(amount), fromAcc.currency, toAcc.currency)
        .then(res => setConvertedAmount(res))
        .catch(() => setConvertedAmount(null));
    } else {
      setConvertedAmount(parseFloat(amount));
    }
  }, [fromAccountId, toAccountId, amount, accounts]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (fromAccountId === toAccountId) {
      setError("Нельзя перевести на тот же счёт");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Введите сумму");
      return;
    }
    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);
    if (!fromAcc || !toAcc) return;

    let finalToAmount = amountNum;
    if (fromAcc.currency !== toAcc.currency) {
      finalToAmount = await convertAmount(amountNum, fromAcc.currency, toAcc.currency);
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const fromRef = doc(db, "users", currentUser.uid, "accounts", fromAccountId);
        const toRef = doc(db, "users", currentUser.uid, "accounts", toAccountId);
        const fromSnap = await transaction.get(fromRef);
        if (!fromSnap.exists()) throw new Error("Счёт отправителя не найден");
        if (fromSnap.data().balance < amountNum) throw new Error("Недостаточно средств");
        transaction.update(fromRef, { balance: fromSnap.data().balance - amountNum });
        const toSnap = await transaction.get(toRef);
        transaction.update(toRef, { balance: toSnap.data().balance + finalToAmount });
      });
      setMessage(`Переведено ${amountNum} ${fromAcc.currency} → ${finalToAmount} ${toAcc.currency}`);
      setAmount("");
      setFromAccountId("");
      setToAccountId("");
      // обновим счета
      const snapshot = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (accounts.length < 2) return <p>Для перевода между счетами нужно минимум 2 счёта.</p>;

  return (
    <div className="card">
      <h2>Перевод между своими счетами</h2>
      <form onSubmit={handleTransfer} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} required>
          <option value="">Счёт списания</option>
          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency}) – {acc.balance?.toLocaleString()} {acc.currency}</option>)}
        </select>
        <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} required>
          <option value="">Счёт зачисления</option>
          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency}) – {acc.balance?.toLocaleString()} {acc.currency}</option>)}
        </select>
        <input type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" />
        {convertedAmount !== null && amount > 0 && (
          <div>Получатель получит: {convertedAmount} {accounts.find(a => a.id === toAccountId)?.currency}</div>
        )}
        <button type="submit" disabled={loading}>{loading ? "Перевод..." : "Перевести"}</button>
      </form>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}