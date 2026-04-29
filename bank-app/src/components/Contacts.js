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

        <div className="search-section">
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm.length >= 2 && (
            <div className="search-results">
              {searchResults.length > 0 ? (
                <ul className="search-results-list">
                  {searchResults.map(user => (
                    <li key={user.id} className="search-result-item">
                      <div className="search-result-info">
                        <strong>{user.name}</strong>
                        <span className="search-result-email">{user.email}</span>
                      </div>
                      <button onClick={() => addContact(user)} className="btn-add-contact">
                        Добавить
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="search-no-results">Ничего не найдено</div>
              )}
            </div>
          )}
        </div>

        <h3>Мои контакты</h3>
        {contacts.length === 0 ? (
          <p>Контактов пока нет. Найдите пользователей через поиск.</p>
        ) : (
          <div className="contacts-list">
            {contacts.map(contact => (
              <div key={contact.id} className="contact-card">
                <div>
                  <strong>{contact.friendName}</strong>
                  <div className="contact-email">{contact.friendEmail}</div>
                </div>
                <div className="contact-actions">
                  <button onClick={() => transferToContact(contact.friendEmail)} className="btn-transfer">
                    Перевести
                  </button>
                  <button onClick={() => removeContact(contact.id)} className="btn-remove">
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
);
}