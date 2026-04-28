import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db, storage } from "../firebase";
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { signOut, deleteUser } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Account() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Загрузка данных пользователя
  useEffect(() => {
    if (!currentUser) return;
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setDisplayName(data.displayName || data.name || "");
          setAvatarUrl(data.avatarUrl || "");
        }
      } catch (err) {
        console.error(err);
        setError("Ошибка загрузки профиля");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [currentUser]);

  // Обновление отображаемого имени
  const updateDisplayName = async () => {
    if (!displayName.trim()) return;
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { displayName: displayName.trim() });
      setMessage("Имя обновлено");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError("Ошибка обновления имени");
    }
  };

  // Загрузка аватарки
  const uploadAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const avatarRef = ref(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(avatarRef, file);
      const url = await getDownloadURL(avatarRef);
      await updateDoc(doc(db, "users", currentUser.uid), { avatarUrl: url });
      setAvatarUrl(url);
      setMessage("Аватар загружен");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setError("Ошибка загрузки аватара");
    } finally {
      setUploading(false);
    }
  };

  // Удаление аккаунта (все данные + аватар + выход)
  const deleteAccount = async () => {
    if (!window.confirm("Удалить аккаунт навсегда? Все данные будут потеряны!")) return;
    try {
      // 1. Удаляем аватар из Storage (если есть)
      if (avatarUrl) {
        const avatarRef = ref(storage, `avatars/${currentUser.uid}`);
        await deleteObject(avatarRef).catch(() => {});
      }

      // 2. Удаляем все транзакции пользователя (where from или to)
      const transactionsRef = collection(db, "transactions");
      const qFrom = query(transactionsRef, where("from", "==", currentUser.uid));
      const qTo = query(transactionsRef, where("to", "==", currentUser.uid));
      const [snapFrom, snapTo] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
      const batch = writeBatch(db);
      snapFrom.docs.forEach(d => batch.delete(d.ref));
      snapTo.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      // 3. Удаляем все контакты пользователя (подколлекция contacts)
      const contactsRef = collection(db, "users", currentUser.uid, "contacts");
      const contactsSnap = await getDocs(contactsRef);
      const batch2 = writeBatch(db);
      contactsSnap.docs.forEach(d => batch2.delete(d.ref));
      await batch2.commit();

      // 4. Удаляем документ пользователя
      await deleteDoc(doc(db, "users", currentUser.uid));

      // 5. Удаляем учётную запись из Authentication
      await deleteUser(currentUser);

      // 6. Выход
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/requires-recent-login") {
        setError("Для удаления аккаунта необходимо войти снова. Пожалуйста, выйдите и зайдите заново.");
      } else {
        setError("Ошибка удаления аккаунта. Попробуйте позже.");
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (loading) return <div className="loader"></div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Мой аккаунт</h2>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Аватар */}
          <div style={{ textAlign: "center" }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover", border: "3px solid #3b82f6" }} />
            ) : (
              <div style={{ width: "120px", height: "120px", borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "3rem", color: "#94a3b8" }}>👤</div>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => e.target.files && uploadAvatar(e.target.files[0])} />
            <button onClick={() => fileInputRef.current.click()} style={{ marginTop: "0.5rem" }} disabled={uploading}>
              {uploading ? "Загрузка..." : "Загрузить аватар"}
            </button>
          </div>

          {/* Отображаемое имя */}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Отображаемое имя</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Как вас будут видеть другие" />
            <button onClick={updateDisplayName} style={{ marginTop: "0.5rem" }}>Сохранить имя</button>
          </div>

          {/* Email (только для чтения) */}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Email</label>
            <input type="email" value={currentUser?.email || ""} disabled />
          </div>

          {/* Кнопки выхода и удаления аккаунта */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <button onClick={handleLogout} style={{ background: "#dc2626" }}>Выйти</button>
            <button onClick={deleteAccount} style={{ background: "#6b7280" }}>Удалить аккаунт</button>
          </div>
        </div>
      </div>
    </div>
  );
}