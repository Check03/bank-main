import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Register() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 1. Создаём документ пользователя (без balance)
      await setDoc(doc(db, "users", user.uid), {
        displayName: displayName,
        email: email,
        createdAt: new Date().toISOString()
      });

      // 2. Создаём первый счёт в подколлекции accounts
      const accountsRef = collection(db, "users", user.uid, "accounts");
      await addDoc(accountsRef, {
        name: "Основной",
        currency: "RUB",
        balance: 10000,
        isDefault: true
      });

      navigate("/dashboard");
    } catch (err) {
      setError("Ошибка регистрации. Возможно, email уже используется.");
    }
  };

  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <h2>Регистрация</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="text" placeholder="Ваше имя" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="button-primary">Зарегистрироваться</button>
        </form>
        <p style={{ textAlign: "center", marginTop: "1rem" }}>
          Уже есть аккаунт? <Link to="/login" style={{ color: "#60a5fa" }}>Войти</Link>
        </p>
      </div>
    </div>
  );
}