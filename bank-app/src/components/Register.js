import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
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

    // Сначала создаём пользователя в Auth
    let user;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      user = userCredential.user;
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("Пользователь с таким email уже существует");
      } else {
        setError("Ошибка регистрации");
      }
      setLoading(false);
      return;
    }

    // Теперь проверяем уникальность имени (пользователь уже аутентифицирован)
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("name", "==", name));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        // Имя занято – удаляем только что созданного пользователя и сообщаем ошибку
        await deleteUser(user);
        setError("Пользователь с таким именем уже существует");
        setLoading(false);
        return;
      }
    } catch (err) {
      // Если ошибка при проверке – тоже удаляем пользователя и сообщаем
      await deleteUser(user);
      setError("Ошибка проверки имени. Попробуйте ещё раз.");
      setLoading(false);
      return;
    }

    // Имя уникально – сохраняем данные в Firestore
    try {
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        role: "user",
        createdAt: new Date().toISOString()
      });

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
      // Если не удалось сохранить – удаляем пользователя
      await deleteUser(user);
      setError("Ошибка создания профиля");
      setLoading(false);
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