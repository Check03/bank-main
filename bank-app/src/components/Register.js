import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Проверка уникальности имени
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("name", "==", name));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setError("Пользователь с таким именем уже существует");
        setLoading(false);
        return;
      }
    } catch (err) {
      setError("Ошибка проверки уникальности имени");
      setLoading(false);
      return;
    }

    // 2. Создание пользователя в Authentication
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Создание документа пользователя в Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        role: "user",
        createdAt: new Date().toISOString()
      });

      // 4. Создание первого счёта (основной, рублёвый)
      const accountsRef = collection(db, "users", user.uid, "accounts");
      await setDoc(doc(accountsRef, "main"), {
        name: "Основной",
        currency: "RUB",
        balance: 10000,
        isDefault: true,
        createdAt: new Date().toISOString()
      });

      // 5. Перенаправление на дашборд
      navigate("/dashboard");
    } catch (err) {
      setError("Ошибка регистрации. Возможно, email уже используется.");
      console.error(err);
    } finally {
      setLoading(false);
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
            placeholder="Ваше имя (будет отображаться другим пользователям)"
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
            placeholder="Пароль (не менее 6 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            minLength="6"
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </form>
        <p style={styles.linkText}>
          Уже есть аккаунт? <Link to="/login" style={styles.link}>Войти</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "80vh",
    padding: "1rem"
  },
  card: {
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "400px"
  },
  title: {
    textAlign: "center",
    marginBottom: "1.5rem",
    color: "#1e3a8a"
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    padding: "0.5rem",
    borderRadius: "4px",
    marginBottom: "1rem",
    textAlign: "center"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem"
  },
  input: {
    padding: "0.75rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "1rem",
    width: "100%"
  },
  button: {
    backgroundColor: "#1e3a8a",
    color: "white",
    padding: "0.75rem",
    border: "none",
    borderRadius: "4px",
    fontSize: "1rem",
    cursor: "pointer",
    width: "100%"
  },
  linkText: {
    textAlign: "center",
    marginTop: "1rem"
  },
  link: {
    color: "#1e3a8a",
    textDecoration: "none"
  }
};