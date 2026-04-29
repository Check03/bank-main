import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function FriendsList({ onSelectFriend }) {
  const { currentUser } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    if (!currentUser) return;
    try {
      const friendsRef = collection(db, "users", currentUser.uid, "friends");
      const snapshot = await getDocs(friendsRef);
      setFriends(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [currentUser]);

  const removeFriend = async (friendId) => {
    if (window.confirm("Удалить из друзей?")) {
      await deleteDoc(doc(db, "users", currentUser.uid, "friends", friendId));
      fetchFriends();
    }
  };

  if (loading) return <div className="loader"></div>;
  if (friends.length === 0) return <p>Друзей пока нет. Найдите пользователей через поиск.</p>;

  return (
    <div className="friends-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {friends.map(friend => (
        <div key={friend.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: "0.75rem", borderRadius: "12px" }}>
          <div>
            <strong>{friend.friendName}</strong> <span style={{ color: "#94a3b8" }}>({friend.friendEmail})</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => onSelectFriend(friend)} style={{ background: "#3b82f6" }}>Перевести</button>
            <button onClick={() => removeFriend(friend.id)} style={{ background: "#6b7280" }}>Удалить</button>
          </div>
        </div>
      ))}
    </div>
  );
}