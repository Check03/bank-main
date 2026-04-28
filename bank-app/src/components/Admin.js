import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  collection, getDocs, doc, updateDoc, getDoc,
  deleteDoc, query, where, writeBatch
} from "firebase/firestore";

export default function Admin() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // Проверка роли текущего пользователя
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

  // Загрузка всех пользователей
  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersList);
      } catch (err) {
        console.error(err);
        setMessage("Ошибка загрузки пользователей");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [isAdmin]);

  // Функция обнуления баланса
  const resetBalance = async (userId, userName) => {
    if (!window.confirm(`Обнулить баланс пользователя ${userName}?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { balance: 0 });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: 0 } : u));
      setMessage(`Баланс ${userName} обнулён`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка обнуления баланса");
    }
  };

  // Удаление пользователя (все данные из Firestore)
  const deleteUserAccount = async (userId, userName) => {
    if (userId === currentUser.uid) {
      alert("Нельзя удалить самого себя");
      return;
    }
    if (!window.confirm(`Удалить пользователя ${userName}? Это удалит все его данные (транзакции, контакты).`)) return;

    try {
      // 1. Удаляем все транзакции, где пользователь участвует (from или to)
      const transactionsRef = collection(db, "transactions");
      const qFrom = query(transactionsRef, where("from", "==", userId));
      const qTo = query(transactionsRef, where("to", "==", userId));
      const [snapFrom, snapTo] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
      const batch = writeBatch(db);
      snapFrom.docs.forEach(docSnap => batch.delete(docSnap.ref));
      snapTo.docs.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();

      // 2. Удаляем все контакты пользователя (его подколлекцию contacts)
      const contactsRef = collection(db, "users", userId, "contacts");
      const contactsSnap = await getDocs(contactsRef);
      const batch2 = writeBatch(db);
      contactsSnap.docs.forEach(docSnap => batch2.delete(docSnap.ref));
      await batch2.commit();

      // 3. Удаляем документ пользователя
      await deleteDoc(doc(db, "users", userId));

      // 4. Обновляем список пользователей
      setUsers(prev => prev.filter(u => u.id !== userId));
      setMessage(`Пользователь ${userName} удалён из Firestore`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка удаления пользователя");
    }
  };

  // Смена роли
  const changeRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMessage(`Роль изменена на ${newRole}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка изменения роли");
    }
  };

  if (checkingRole) {
    return <div className="admin-loading">Проверка прав доступа...</div>;
  }
  if (!currentUser) {
    return <div className="admin-error">Необходимо войти в систему</div>;
  }
  if (!isAdmin) {
    return <div className="admin-error">Доступ запрещён. Только для администратора.</div>;
  }
  if (loading) {
    return <div className="admin-loading">Загрузка пользователей...</div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-card">
        <h2>Панель администратора</h2>
        {message && <div className="admin-success">{message}</div>}
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Имя</th>
                <th>Баланс (₽)</th>
                <th>Роль</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Имя">{user.name}</td>
                  <td data-label="Баланс">{user.balance?.toLocaleString()}</td>
                  <td data-label="Роль">{user.role || "user"}</td>
                  <td data-label="Действия" className="actions-cell">
                    <button
                      onClick={() => resetBalance(user.id, user.name)}
                      className="btn-reset"
                    >
                      Обнулить баланс
                    </button>
                    {user.role !== "admin" && (
                      <button
                        onClick={() => changeRole(user.id, "admin")}
                        className="btn-make-admin"
                      >
                        Сделать админом
                      </button>
                    )}
                    {user.role === "admin" && user.id !== currentUser.uid && (
                      <button
                        onClick={() => changeRole(user.id, "user")}
                        className="btn-remove-admin"
                      >
                        Убрать админа
                      </button>
                    )}
                    <button
                      onClick={() => deleteUserAccount(user.id, user.name)}
                      className="btn-delete"
                      disabled={user.id === currentUser.uid}
                    >
                      Удалить аккаунт
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}