import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from "firebase/firestore";

export default function Contacts() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Загрузка списка контактов и всех пользователей
  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      // Загружаем контакты текущего пользователя
      const contactsSnapshot = await getDocs(collection(db, "users", currentUser.uid, "friends"));
      setContacts(contactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Загружаем всех пользователей (для поиска)
      const usersSnapshot = await getDocs(collection(db, "users"));
      setAllUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, [currentUser]);

  // Поиск среди всех пользователей (фильтрация на клиенте, без индексов)
  const searchResults = allUsers.filter(user =>
    user.id !== currentUser?.uid &&
    !contacts.some(c => c.friendId === user.id) &&
    (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Добавление в контакты
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
      // Обновить список контактов
      const snapshot = await getDocs(collection(db, "users", currentUser.uid, "friends"));
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setMessage("Ошибка добавления контакта");
    }
  };

  // Удаление контакта
  const removeContact = async (contactId) => {
    if (!window.confirm("Удалить контакт?")) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "friends", contactId));
      setContacts(contacts.filter(c => c.id !== contactId));
      setMessage("Контакт удалён");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Ошибка удаления");
    }
  };

  // Переход к переводу
  const transferToContact = (email) => {
    navigate("/transfer", { state: { email } });
  };

  return (
    <div className="container" style={{ maxWidth: "800px", margin: "2rem auto" }}>
      <div className="card">
        <h2>Контакты</h2>
        {message && <div className="success-message">{message}</div>}

        {/* Поиск (работает без индексов) */}
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
          {searchTerm.length >= 2 && searchResults.length === 0 && !loading && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#6b7280" }}>Ничего не найдено</p>
          )}
        </div>

        {/* Список контактов */}
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