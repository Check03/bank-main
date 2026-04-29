import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  collection, getDocs, doc, updateDoc, getDoc,
  deleteDoc, query, where, writeBatch
} from "firebase/firestore";

const currencySymbols = {
  RUB: "₽",
  USD: "$",
  EUR: "€"
};

export default function Admin() {
  const { currentUser } = useAuth();
  const [usersWithAccounts, setUsersWithAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // 1. Проверка роли админа
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!currentUser) {
        setCheckingRole(false);
        return;
      }
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          setIsAdmin(role === "admin");
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Ошибка проверки роли:", error);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    };
    checkAdminRole();
  }, [currentUser]);

  // 2. Загрузка всех пользователей и их счетов
  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsersAndAccounts = async () => {
      try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const usersWithAcc = await Promise.all(usersList.map(async (user) => {
          const accountsRef = collection(db, "users", user.id, "accounts");
          const accountsSnapshot = await getDocs(accountsRef);
          const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          return { ...user, accounts };
        }));
        
        setUsersWithAccounts(usersWithAcc);
      } catch (err) {
        console.error(err);
        setMessage("Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };
    fetchUsersAndAccounts();
  }, [isAdmin]);

  // 3. Обнуление баланса выбранного счёта
  const resetAccountBalance = async (userId, accountId, accountName, userName) => {
    if (!window.confirm(`Обнулить баланс счёта "${accountName}" пользователя ${userName}?`)) return;
    try {
      const accountRef = doc(db, "users", userId, "accounts", accountId);
      await updateDoc(accountRef, { balance: 0 });
      
      setUsersWithAccounts(prev => prev.map(u => {
        if (u.id === userId) {
          const updatedAccounts = u.accounts.map(acc => 
            acc.id === accountId ? { ...acc, balance: 0 } : acc
          );
          return { ...u, accounts: updatedAccounts };
        }
        return u;
      }));
      setMessage(`Баланс счёта "${accountName}" пользователя ${userName} обнулён`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка обнуления баланса");
    }
  };

  // 4. Пополнение выбранного счёта (с выбором суммы)
  const depositAccount = async (userId, accountId, accountName, userName) => {
    const amountStr = prompt(`Введите сумму пополнения для счёта "${accountName}" (${userName}):`, "0");
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Введите положительное число");
      return;
    }
    try {
      const accountRef = doc(db, "users", userId, "accounts", accountId);
      const accountSnap = await getDoc(accountRef);
      if (!accountSnap.exists()) throw new Error("Счёт не найден");
      const currentBalance = accountSnap.data().balance || 0;
      const newBalance = currentBalance + amount;
      await updateDoc(accountRef, { balance: newBalance });
      
      setUsersWithAccounts(prev => prev.map(u => {
        if (u.id === userId) {
          const updatedAccounts = u.accounts.map(acc => 
            acc.id === accountId ? { ...acc, balance: newBalance } : acc
          );
          return { ...u, accounts: updatedAccounts };
        }
        return u;
      }));
      setMessage(`Счёт "${accountName}" пользователя ${userName} пополнен на ${amount} ${currencySymbols[accountSnap.data().currency] || '₽'}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка пополнения счёта");
    }
  };

  // 5. Удаление пользователя и всех его данных
  const deleteUserAccount = async (userId, userName) => {
    if (userId === currentUser.uid) {
      alert("Нельзя удалить самого себя");
      return;
    }
    if (!window.confirm(`Удалить пользователя ${userName}? Это удалит все его данные (счета, транзакции, контакты).`)) return;

    try {
      // Удаляем все счета пользователя
      const accountsRef = collection(db, "users", userId, "accounts");
      const accountsSnap = await getDocs(accountsRef);
      const batch1 = writeBatch(db);
      accountsSnap.docs.forEach(docSnap => batch1.delete(docSnap.ref));
      await batch1.commit();

      // Удаляем транзакции, где он участвует
      const transactionsRef = collection(db, "transactions");
      const qFrom = query(transactionsRef, where("from", "==", userId));
      const qTo = query(transactionsRef, where("to", "==", userId));
      const [snapFrom, snapTo] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
      const batch2 = writeBatch(db);
      snapFrom.docs.forEach(docSnap => batch2.delete(docSnap.ref));
      snapTo.docs.forEach(docSnap => batch2.delete(docSnap.ref));
      await batch2.commit();

      // Удаляем контакты (друзей)
      const friendsRef = collection(db, "users", userId, "friends");
      const friendsSnap = await getDocs(friendsRef);
      const batch3 = writeBatch(db);
      friendsSnap.docs.forEach(docSnap => batch3.delete(docSnap.ref));
      await batch3.commit();

      // Удаляем документ пользователя
      await deleteDoc(doc(db, "users", userId));

      setUsersWithAccounts(prev => prev.filter(u => u.id !== userId));
      setMessage(`Пользователь ${userName} удалён`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка удаления пользователя");
    }
  };

  // 6. Изменение роли (админ/юзер)
  const changeRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsersWithAccounts(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
      setMessage(`Роль изменена на ${newRole}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка изменения роли");
    }
  };

  if (checkingRole) return <div className="loader"></div>;
  if (!currentUser) return <div className="error-message" style={{ textAlign: "center" }}>Необходимо войти в систему</div>;
  if (!isAdmin) return <div className="error-message" style={{ textAlign: "center" }}>Доступ запрещён. Только для администратора.</div>;
  if (loading) return <div className="loader"></div>;

  return (
    <div className="admin-container">
      <div className="admin-card">
        <h2>Панель администратора</h2>
        {message && <div className="success-message">{message}</div>}
        
        {usersWithAccounts.map(user => (
          <div key={user.id} className="user-admin-card" style={{ marginBottom: "2rem", background: "#1e293b", borderRadius: "20px", padding: "1rem" }}>
            <h3>{user.name || user.displayName} ({user.email})</h3>
            <p>Роль: {user.role || "user"}</p>
            <div className="user-actions" style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button onClick={() => changeRole(user.id, user.role === "admin" ? "user" : "admin")} className="btn-make-admin">
                {user.role === "admin" ? "Убрать админа" : "Сделать админом"}
              </button>
              <button onClick={() => deleteUserAccount(user.id, user.name)} className="btn-delete" disabled={user.id === currentUser.uid}>
                Удалить аккаунт
              </button>
            </div>
            
            <h4>Счета:</h4>
            {user.accounts.length === 0 ? (
              <p>Нет счетов</p>
            ) : (
              <div className="accounts-grid" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                {user.accounts.map(acc => (
                  <div key={acc.id} style={{ background: "#0f172a", borderRadius: "16px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <strong>{acc.name}</strong> ({acc.currency})
                      <div>Баланс: <span style={{ fontWeight: "bold" }}>{acc.balance?.toLocaleString()} {currencySymbols[acc.currency] || acc.currency}</span></div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => resetAccountBalance(user.id, acc.id, acc.name, user.name)} className="btn-reset" style={{ background: "#f59e0b" }}>Обнулить</button>
                      <button onClick={() => depositAccount(user.id, acc.id, acc.name, user.name)} className="btn-deposit" style={{ background: "#10b981" }}>Пополнить</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}