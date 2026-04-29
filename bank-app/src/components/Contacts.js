import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, deleteDoc, onSnapshot } from "firebase/firestore";

export default function Contacts() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Подписка на список всех пользователей (в реальном времени)
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(users);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Подписка на контакты пользователя
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(
      collection(db, "users", currentUser.uid, "friends"),
      (snapshot) => {
        setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Поиск (фильтрация на клиенте)
  const searchResults = allUsers.filter(user =>
    user.id !== currentUser?.uid &&
    !contacts.some(c => c.friendId === user.id) &&
    (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addContact = async (user) => {
    try {
      const friendRef = doc(db, "users", user.id);
      const friendSnap = await getDoc(friendRef);
      if (!friendSnap.exists()) throw new Error("Пользователь не найден");
      const friendData = friendSnap.data();
      await addDoc(collection(db, "users", currentUser.uid, "friends"), {
        friendId: user.id,
        friendName: friendData.name,
        friendEmail: friendData.email,
        addedAt: serverTimestamp()
      });
      setMessage(`Контакт ${friendData.name} добавлен`);
      setTimeout(() => setMessage(""), 3000);
      setSearchTerm("");
    } catch (err) {
      setMessage("Ошибка добавления контакта");
    }
  };

  const removeContact = async (contactId) => {
    if (!window.confirm("Удалить контакт?")) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "friends", contactId));
      setMessage("Контакт удалён");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Ошибка удаления");
    }
  };

  const transferToContact = (email) => {
    navigate("/transfer", { state: { email } });
  };

  if (loading) return <div className="loader"></div>;

  return (
    <div className="container" style={{ maxWidth: "800px", margin: "2rem auto" }}>
      <div className="card">
        <h2>Контакты</h2>
        {message && <div className="success-message">{message}</div>}

        <div style={{ marginBottom: "2rem" }}>
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #ccc" }}
          />
          {searchTerm.length >= 2 && searchResults.length > 0 && (
            <ul style={{ listStyle: "none", background: "#f8fafc", borderRadius: "8px", marginTop: "0.5rem", padding: "0.5rem" }}>
              {searchResults.map(user => (
                <li key={user.id} style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span><strong>{user.name}</strong> ({user.email})</span>
                  <button onClick={() => addContact(user)} style={{ background: "#3b82f6", color: "white", border: "none", padding: "0.25rem 0.75rem", borderRadius: "6px" }}>Добавить</button>
                </li>
              ))}
            </ul>
          )}
          {searchTerm.length >= 2 && searchResults.length === 0 && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#6b7280" }}>Ничего не найдено</p>
          )}
        </div>

        <h3>Мои контакты</h3>
        {contacts.length === 0 ? (
          <p>Контактов пока нет. Найдите пользователей через поиск.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {contacts.map(contact => (
              <div key={contact.id} style={{ background: "#1e293b", borderRadius: "12px", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <strong>{contact.friendName}</strong>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{contact.friendEmail}</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => transferToContact(contact.friendEmail)} style={{ background: "#10b981", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px" }}>Перевести</button>
                  <button onClick={() => removeContact(contact.id)} style={{ background: "#6b7280", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px" }}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}