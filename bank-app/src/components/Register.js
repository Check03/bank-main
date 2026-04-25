import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // Создаём документ пользователя с начальным балансом 10000
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        balance: 10000,
        createdAt: new Date().toISOString()
      });
      navigate("/dashboard");
    } catch (err) {
      setError("Ошибка регистрации. Возможно, email уже используется.");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Регистрация</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.button}>Зарегистрироваться</button>
        </form>
        <p style={styles.linkText}>
          Уже есть аккаунт? <Link to="/login" style={styles.link}>Войти</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" },
  card: { backgroundColor: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", width: "100%", maxWidth: "400px" },
  title: { textAlign: "center", marginBottom: "1.5rem", color: "#1e3a8a" },
  error: { backgroundColor: "#fee2e2", color: "#dc2626", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem", textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  input: { padding: "0.75rem", border: "1px solid #ccc", borderRadius: "4px", fontSize: "1rem" },
  button: { backgroundColor: "#1e3a8a", color: "white", padding: "0.75rem", border: "none", borderRadius: "4px", fontSize: "1rem", cursor: "pointer" },
  linkText: { textAlign: "center", marginTop: "1rem" },
  link: { color: "#1e3a8a", textDecoration: "none" }
};