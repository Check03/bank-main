import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, orderBy } from "firebase/firestore";

export default function Contacts() {
  const { currentUser } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [newContactEmail, setNewContactEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Загрузка контактов
  useEffect(() => {
    if (!currentUser) return;
    const fetchContacts = async () => {
      try {
        const contactsRef = collection(db, "users", currentUser.uid, "contacts");
        const q = query(contactsRef, orderBy("contactName", "asc"));
        const snapshot = await getDocs(q);
        const contactsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContacts(contactsList);
      } catch (err) {
        console.error(err);
        setError("Ошибка загрузки контактов");
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, [currentUser]);

  // Добавление контакта
  const addContact = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!newContactEmail.trim()) return;
    if (newContactEmail === currentUser.email) {
      setError("Нельзя добавить самого себя");
      return;
    }
    try {
      // Проверяем, есть ли пользователь с таким email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", newContactEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("Пользователь с таким email не найден");
        return;
      }
      const contactUser = snap.docs[0];
      const contactData = contactUser.data();
      const contactId = contactUser.id;

      // Проверяем, не добавлен ли уже контакт
      const contactsRef = collection(db, "users", currentUser.uid, "contacts");
      const checkQuery = query(contactsRef, where("contactId", "==", contactId));
      const existing = await getDocs(checkQuery);
      if (!existing.empty) {
        setError("Этот контакт уже добавлен");
        return;
      }

      // Добавляем документ в подколлекцию
      await addDoc(contactsRef, {
        contactId: contactId,
        contactEmail: contactData.email,
        contactName: contactData.displayName || contactData.name,
        createdAt: new Date()
      });

      setNewContactEmail("");
      setMessage("Контакт добавлен");
      // Обновляем список
      const newSnap = await getDocs(query(contactsRef, orderBy("contactName", "asc")));
      setContacts(newSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      setError("Ошибка добавления контакта");
    }
  };

  // Удаление контакта
  const deleteContact = async (contactDocId) => {
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "contacts", contactDocId));
      setContacts(contacts.filter(c => c.id !== contactDocId));
      setMessage("Контакт удалён");
    } catch (err) {
      console.error(err);
      setError("Не удалось удалить");
    }
  };

  if (loading) return <div className="loader"></div>;

  return (
  <div className="container">
    <div className="card">
      <h2>Мои контакты</h2>
        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={addContact} style={styles.form}>
          <input
            type="email"
            placeholder="Email контакта"
            value={newContactEmail}
            onChange={(e) => setNewContactEmail(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.button}>Добавить контакт</button>
        </form>
        {contacts.length === 0 ? (
          <p>Нет контактов. Добавьте первый!</p>
        ) : (
          <ul style={styles.list}>
            {contacts.map(contact => (
              <li key={contact.id} style={styles.listItem}>
                <span><strong>{contact.contactName}</strong> ({contact.contactEmail})</span>
                <button onClick={() => deleteContact(contact.id)} style={styles.deleteBtn}>Удалить</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: "800px", margin: "2rem auto", padding: "0 1rem" },
  card: { backgroundColor: "white", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", padding: "1.5rem" },
  form: { display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" },
  input: { padding: "0.75rem", border: "1px solid #ccc", borderRadius: "4px", fontSize: "1rem", width: "100%" },
  button: { backgroundColor: "#1e3a8a", color: "white", padding: "0.75rem", border: "none", borderRadius: "4px", cursor: "pointer", width: "100%" },
  list: { listStyle: "none", padding: 0 },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", padding: "0.75rem 0" },
  deleteBtn: { backgroundColor: "#dc2626", color: "white", border: "none", padding: "0.3rem 0.8rem", borderRadius: "4px", cursor: "pointer" },
  error: { backgroundColor: "#fee2e2", color: "#dc2626", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem" },
  success: { backgroundColor: "#dcfce7", color: "#16a34a", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem" },
  loading: { textAlign: "center", marginTop: "3rem" }
};