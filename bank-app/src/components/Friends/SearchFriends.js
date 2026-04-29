import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

export default function SearchFriends({ onFriendAdded }) {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const nameQuery = query(usersRef, where("name", ">=", searchTerm), where("name", "<=", searchTerm + "\uf8ff"));
        const emailQuery = query(usersRef, where("email", ">=", searchTerm), where("email", "<=", searchTerm + "\uf8ff"));
        const [nameSnap, emailSnap] = await Promise.all([getDocs(nameQuery), getDocs(emailQuery)]);
        const docsMap = new Map();
        [...nameSnap.docs, ...emailSnap.docs].forEach(docSnap => {
          if (!docsMap.has(docSnap.id) && docSnap.id !== currentUser.uid) {
            docsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          }
        });
        setResults(Array.from(docsMap.values()));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, currentUser]);

  const addFriend = async (friendUser) => {
    try {
      const friendRef = doc(db, "users", friendUser.id);
      const friendSnap = await getDoc(friendRef);
      if (!friendSnap.exists()) throw new Error("Пользователь не найден");
      const friendData = friendSnap.data();
      await addDoc(collection(db, "users", currentUser.uid, "friends"), {
        friendId: friendUser.id,
        friendName: friendData.name,
        friendEmail: friendData.email,
        addedAt: serverTimestamp()
      });
      setMessage(`Пользователь ${friendData.name} добавлен в друзья`);
      setTimeout(() => setMessage(""), 3000);
      setSearchTerm("");
      setResults([]);
      if (onFriendAdded) onFriendAdded();
    } catch (err) {
      setMessage("Ошибка добавления друга");
    }
  };

  return (
    <div className="search-friends">
      <input
        type="text"
        placeholder="Поиск по имени или email..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #ccc" }}
      />
      {loading && <div className="loader" style={{ margin: "1rem auto" }}></div>}
      {results.length > 0 && (
        <ul style={{ listStyle: "none", background: "white", borderRadius: "8px", marginTop: "0.5rem", padding: "0.5rem" }}>
          {results.map(user => (
            <li key={user.id} style={{ padding: "0.5rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
              <span><strong>{user.name}</strong> ({user.email})</span>
              <button onClick={() => addFriend(user)} style={{ background: "#3b82f6", padding: "0.25rem 0.75rem" }}>Добавить</button>
            </li>
          ))}
        </ul>
      )}
      {message && <div className="success-message" style={{ marginTop: "0.5rem" }}>{message}</div>}
    </div>
  );
}