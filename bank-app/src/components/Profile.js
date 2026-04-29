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
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReauth, setShowReauth] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

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

  const reauthenticate = async (password) => {
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (email !== currentUser.email || newPassword) {
      setPendingAction('update');
      setShowReauth(true);
      return;
    }
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
      setError("Неверный пароль или действие отклонено");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleDeleteAccount = () => {
    setPendingAction('delete');
    setShowReauth(true);
  };

  const deleteAccountConfirmed = async () => {
    try {
      const accountsSnap = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
      for (const docSnap of accountsSnap.docs) await deleteDoc(docSnap.ref);
      const friendsSnap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
      for (const docSnap of friendsSnap.docs) await deleteDoc(docSnap.ref);
      const transactionsRef = collection(db, "transactions");
      const qFrom = query(transactionsRef, where("from", "==", currentUser.uid));
      const qTo = query(transactionsRef, where("to", "==", currentUser.uid));
      const [fromSnap, toSnap] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
      const deletePromises = [...fromSnap.docs, ...toSnap.docs].map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, "users", currentUser.uid));
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
            <p>Подтвердите текущий пароль:</p>
            <input
              type="password"
              placeholder="Пароль"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              style={{ marginBottom: "1rem", width: "100%" }}
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
            <input type="password" placeholder="Новый пароль (оставьте пустым)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="submit" disabled={loading}>{loading ? "Сохранение..." : "Сохранить изменения"}</button>
          </form>
        )}

        <hr style={{ margin: "1.5rem 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button onClick={logout} style={{ background: "#f59e0b", color: "white" }}>Выйти из аккаунта</button>
          <button onClick={handleDeleteAccount} disabled={loading} style={{ background: "#dc2626", color: "white" }}>
            {loading && pendingAction === 'delete' ? "Удаление..." : "Удалить аккаунт"}
          </button>
        </div>
      </div>
    </div>
  );
}