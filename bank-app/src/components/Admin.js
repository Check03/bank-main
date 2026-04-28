import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

export default function Admin() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Проверка, является ли текущий пользователь админом
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!currentUser) return;
      const userDoc = await getDocs(doc(db, "users", currentUser.uid));
      const role = userDoc.data()?.role;
      setIsAdmin(role === "admin");
    };
    checkAdmin();
  }, [currentUser]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersList);
      } catch (err) {
        console.error(err);
        setMessage("Ошибка загрузки пользователей");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [isAdmin]);

  const changeRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMessage(`Роль изменена на ${newRole}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка изменения роли");
    }
  };

  if (!isAdmin) {
    return <div style={styles.error}>Доступ запрещён. Только для администратора.</div>;
  }

  if (loading) return <div style={styles.loading}>Загрузка...</div>;

  return (
    <div style={styles.container}>
      <div className="card" style={styles.card}>
        <h2>Панель администратора</h2>
        {message && <div style={styles.success}>{message}</div>}
        <table style={styles.table}>
          <thead>
            <tr><th>Email</th><th>Имя</th><th>Баланс</th><th>Роль</th><th>Действие</th></tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name}</td>
                <td>{user.balance?.toLocaleString()} ₽</td>
                <td>{user.role || "user"}</td>
                <td>
                  {user.role !== "admin" ? (
                    <button onClick={() => changeRole(user.id, "admin")} style={styles.adminBtn}>Сделать админом</button>
                  ) : (
                    <button onClick={() => changeRole(user.id, "user")} style={styles.userBtn}>Убрать админа</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: "1200px", margin: "2rem auto", padding: "0 1rem" },
  card: { backgroundColor: "white", borderRadius: "8px", padding: "1.5rem", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "0.75rem", borderBottom: "1px solid #e5e7eb" },
  adminBtn: { backgroundColor: "#10b981", color: "white", border: "none", padding: "0.25rem 0.5rem", borderRadius: "4px", cursor: "pointer" },
  userBtn: { backgroundColor: "#f59e0b", color: "white", border: "none", padding: "0.25rem 0.5rem", borderRadius: "4px", cursor: "pointer" },
  error: { textAlign: "center", color: "#dc2626", marginTop: "3rem" },
  loading: { textAlign: "center", marginTop: "3rem" },
  success: { backgroundColor: "#dcfce7", color: "#16a34a", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem" }
};