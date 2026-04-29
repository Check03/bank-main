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

    // Проверка уникальности имени
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
      setError("Ошибка проверки имени");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ✅ Сохраняем имя, email и роль
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        role: "user",
        createdAt: new Date().toISOString()
      });

      // ✅ Создаём первый счёт (основной)
      const accountsRef = collection(db, "users", user.uid, "accounts");
      await setDoc(doc(accountsRef, "main"), {
        name: "Основной",
        currency: "RUB",
        balance: 10000,
        isDefault: true,
        createdAt: new Date().toISOString()
      });

      navigate("/dashboard");
    } catch (err) {
      setError("Ошибка регистрации. Возможно, email уже используется.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: "400px", margin: "3rem auto" }}>
      <div className="card">
        <h2>Регистрация</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="text" placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Пароль (минимум 6 символов)" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" />
          <button type="submit" disabled={loading} className="button-primary">{loading ? "Регистрация..." : "Зарегистрироваться"}</button>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center" }}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}