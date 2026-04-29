import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, updateDoc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { updateEmail, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";

export default function Profile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState(""); // для повторного входа
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReauth, setShowReauth] = useState(false); // показывать форму повторного входа
  const [pendingAction, setPendingAction] = useState(null); // 'update' или 'delete'

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

  // Повторная аутентификация
  const reauthenticate = async (password) => {
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
  };

  // Обработчик сохранения профиля (смена email/пароля)
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    
    // Если меняется email или пароль, требуем подтверждение пароля
    if (email !== currentUser.email || newPassword) {
      setPendingAction('update');
      setShowReauth(true);
      return;
    }
    
    // Если меняется только имя – можно без повторного входа
    setLoading(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { name });
      setMessage("Имя обновлено!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmReauth = async (password) => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await reauthenticate(password);
      // После успешной повторной аутентификации выполняем отложенное действие
      if (pendingAction === 'update') {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, { name });
        if (email !== currentUser.email) {
          await updateEmail(currentUser, email);
        }
        if (newPassword && newPassword.length >= 6) {
          await updatePassword(currentUser, newPassword);
        }
        setMessage("Профиль обновлён!");
        setNewPassword("");
        setPasswordConfirm("");
      } else if (pendingAction === 'delete') {
        await deleteAccountConfirmed();
      }
      setShowReauth(false);
      setPendingAction(null);
    } catch (err) {
      setError("Ошибка: неверный пароль или действие отклонено");
    } finally {
      setLoading(false);
    }
  };

  // Выход
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Удаление аккаунта (запрашивает повторный вход)
  const handleDeleteAccount = () => {
    setPendingAction('delete');
    setShowReauth(true);
  };

  const deleteAccountConfirmed = async () => {
    try {
      // 1. Удаляем подколлекции
      const accountsSnap = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      for (const docSnap of accountsSnap.docs) {
        await deleteDoc(docSnap.ref);
      }
      const friendsSnap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
      for (const docSnap of friendsSnap.docs) {
        await deleteDoc(docSnap.ref);
      }
      // 2. Удаляем транзакции пользователя
      const transactionsRef = collection(db, "transactions");
      const qFrom = query(transactionsRef, where("from", "==", currentUser.uid));
      const qTo = query(transactionsRef, where("to", "==", currentUser.uid));
      const [fromSnap, toSnap] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
      const deletePromises = [...fromSnap.docs, ...toSnap.docs].map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      // 3. Удаляем документ пользователя
      await deleteDoc(doc(db, "users", currentUser.uid));
      // 4. Удаляем пользователя из Auth
      await deleteUser(currentUser);
      navigate("/login");
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <div className="container" style={{ maxWidth: "500px", margin: "2rem auto" }}>
      <div className="card">
        <h2>Профиль</h2>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        {showReauth ? (
          <div>
            <p>Для безопасности подтвердите ваш текущий пароль:</p>
            <input
              type="password"
              placeholder="Текущий пароль"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />
            <button onClick={() => confirmReauth(passwordConfirm)} disabled={loading} className="button-primary">
              Подтвердить
            </button>
            <button onClick={() => { setShowReauth(false); setPendingAction(null); }} style={{ marginLeft: "0.5rem" }}>
              Отмена
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="text" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Новый пароль (оставьте пустым, чтобы не менять)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="submit" disabled={loading}>{loading ? "Сохранение..." : "Сохранить изменения"}</button>
          </form>
        )}

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