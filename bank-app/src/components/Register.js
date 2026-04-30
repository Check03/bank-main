import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, getDoc, getDocs } from "firebase/firestore";
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

    try {
      // Попытка создания нового пользователя
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Сохраняем данные в Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        role: "user",
        createdAt: new Date().toISOString()
      });

      // Создаём первый счёт
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
      if (err.code === "auth/email-already-in-use") {
        // Email уже существует в Auth, пробуем войти с введённым паролем
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          const userDoc = await getDoc(doc(db, "users", user.uid));

          if (!userDoc.exists()) {
            // Восстанавливаем документ пользователя
            await setDoc(doc(db, "users", user.uid), {
              name: name,
              email: email,
              role: "user",
              createdAt: new Date().toISOString()
            });
          }

          // Проверяем наличие счетов
          const accountsRef = collection(db, "users", user.uid, "accounts");
          const accountsSnap = await getDocs(accountsRef);
          if (accountsSnap.empty) {
            await setDoc(doc(accountsRef, "main"), {
              name: "Основной",
              currency: "RUB",
              balance: 10000,
              isDefault: true,
              createdAt: new Date().toISOString()
            });
          }

          navigate("/dashboard");
        } catch (signInErr) {
          // Пароль неверный – предложить восстановление пароля
          setError(
            <div>
              Этот email уже зарегистрирован. Если вы забыли пароль, перейдите на страницу{" "}
              <Link to="/login?reset=1">восстановления пароля</Link>. Или{" "}
              <Link to="/login">войдите</Link> с правильным паролем.
            </div>
          );
        }
      } else {
        setError("Ошибка регистрации. Попробуйте ещё раз.");
      }
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
          <input
            type="text"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Пароль (минимум 6 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
          />
          <button type="submit" disabled={loading} className="button-primary">
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center" }}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}