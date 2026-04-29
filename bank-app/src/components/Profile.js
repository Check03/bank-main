import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, updateDoc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { updateEmail, updatePassword, deleteUser, signOut } from "firebase/auth";

export default function Profile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Загрузка текущего имени
  useEffect(() => {
    if (!currentUser) return;
    const fetchUserData = async () => {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setName(userDoc.data().name || "");
      }
      setEmail(currentUser.email);
    };
    fetchUserData();
  }, [currentUser]);

  // Обновление профиля
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { name });
      if (email !== currentUser.email) {
        await updateEmail(currentUser, email);
      }
      if (newPassword.length >= 6) {
        await updatePassword(currentUser, newPassword);
        setNewPassword("");
      }
      setMessage("Профиль обновлён!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Выход из аккаунта
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      setError("Ошибка выхода");
    }
  };

  // Удаление аккаунта (с подтверждением)
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "ВНИМАНИЕ! Вы уверены, что хотите удалить аккаунт? Все ваши счета, транзакции и данные будут безвозвратно удалены."
    );
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      // 1. Удаляем все подколлекции пользователя (счета, друзья, транзакции)
      // Сначала удаляем счета
      const accountsSnap = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      const deleteAccounts = accountsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteAccounts);

      // Удаляем друзей
      const friendsSnap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
      const deleteFriends = friendsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteFriends);

      // Удаляем транзакции пользователя (глобальные, где он участвует)
      const transactionsRef = collection(db, "transactions");
      const qFrom = query(transactionsRef, where("from", "==", currentUser.uid));
      const qTo = query(transactionsRef, where("to", "==", currentUser.uid));
      const [fromSnap, toSnap] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
      const deleteTransactions = [...fromSnap.docs, ...toSnap.docs].map(d => deleteDoc(d.ref));
      await Promise.all(deleteTransactions);

      // 2. Удаляем документ пользователя в Firestore
      await deleteDoc(doc(db, "users", currentUser.uid));

      // 3. Удаляем пользователя из Authentication
      await deleteUser(currentUser);

      // 4. Перенаправляем на логин
      navigate("/login");
    } catch (err) {
      setError("Ошибка удаления аккаунта. Возможно, требуется повторная аутентификация.");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: "500px", margin: "2rem auto" }}>
      <div className="card">
        <h2>Профиль</h2>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="text" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Новый пароль (оставьте пустым, чтобы не менять)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <button type="submit" disabled={loading}>{loading ? "Сохранение..." : "Сохранить изменения"}</button>
        </form>

        <hr style={{ margin: "1.5rem 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button onClick={handleLogout} style={{ background: "#f59e0b", color: "white" }}>Выйти из аккаунта</button>
          <button onClick={handleDeleteAccount} disabled={deleting} style={{ background: "#dc2626", color: "white" }}>
            {deleting ? "Удаление..." : "Удалить аккаунт"}
          </button>
        </div>
      </div>
    </div>
  );
}