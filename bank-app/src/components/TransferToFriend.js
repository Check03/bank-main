import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, doc, runTransaction, query, where } from "firebase/firestore";
import { convertAmount } from "../utils/currencyRates";

export default function TransferToFriendWithConversion() {
  const { currentUser } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    const fetchFriendsAndAccounts = async () => {
      const friendsSnap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
      setFriends(friendsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const accSnap = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchFriendsAndAccounts();
  }, [currentUser]);

  const getFriendMainAccount = async (friendUserId) => {
    const accSnap = await getDocs(query(collection(db, "users", friendUserId, "accounts"), where("isDefault", "==", true)));
    if (!accSnap.empty) return { id: accSnap.docs[0].id, ...accSnap.docs[0].data() };
    // если нет основного, возьмём любой первый счёт
    const allSnap = await getDocs(collection(db, "users", friendUserId, "accounts"));
    if (allSnap.empty) throw new Error("У получателя нет счетов");
    return { id: allSnap.docs[0].id, ...allSnap.docs[0].data() };
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!selectedFriend) return setError("Выберите друга");
    if (!fromAccountId) return setError("Выберите счёт списания");
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return setError("Введите сумму");

    const fromAcc = accounts.find(a => a.id === fromAccountId);
    if (!fromAcc) return;
    if (fromAcc.balance < amountNum) return setError("Недостаточно средств");

    setLoading(true);
    try {
      const friendMainAccount = await getFriendMainAccount(selectedFriend.friendId);
      let finalAmount = amountNum;
      if (fromAcc.currency !== friendMainAccount.currency) {
        finalAmount = await convertAmount(amountNum, fromAcc.currency, friendMainAccount.currency);
      }
      await runTransaction(db, async (transaction) => {
        const fromRef = doc(db, "users", currentUser.uid, "accounts", fromAccountId);
        const fromSnap = await transaction.get(fromRef);
        if (fromSnap.data().balance < amountNum) throw new Error("Недостаточно средств");
        transaction.update(fromRef, { balance: fromSnap.data().balance - amountNum });
        const toRef = doc(db, "users", selectedFriend.friendId, "accounts", friendMainAccount.id);
        const toSnap = await transaction.get(toRef);
        transaction.update(toRef, { balance: toSnap.data().balance + finalAmount });
        // запись транзакции (опционально)
      });
      setMessage(`Переведено ${amountNum} ${fromAcc.currency} другу ${selectedFriend.friendName}. Получил: ${finalAmount} ${friendMainAccount.currency}`);
      setAmount("");
      setSelectedFriend(null);
      setFromAccountId("");
      // обновить балансы на UI
      const accSnap = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Перевод другу</h2>
      <div style={{ marginBottom: "1rem" }}>
        <label>Друг:</label>
        <select value={selectedFriend?.id || ""} onChange={e => setSelectedFriend(friends.find(f => f.id === e.target.value))} required>
          <option value="">Выберите друга</option>
          {friends.map(f => <option key={f.id} value={f.id}>{f.friendName} ({f.friendEmail})</option>)}
        </select>
      </div>
      {selectedFriend && (
        <form onSubmit={handleTransfer} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} required>
            <option value="">Счёт списания</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency}) – {acc.balance} {acc.currency}</option>)}
          </select>
          <input type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" />
          <button type="submit" disabled={loading}>{loading ? "Перевод..." : "Перевести"}</button>
        </form>
      )}
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}