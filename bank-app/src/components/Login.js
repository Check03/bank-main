import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Если в URL есть ?reset=1, открываем форму восстановления пароля
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") === "1") {
      setResetMode(true);
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Неверный email или пароль");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Введите email для восстановления");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Письмо для сброса пароля отправлено. Проверьте почту (и папку Спам).");
      setTimeout(() => {
        setResetMode(false);
        setMessage("");
        setEmail("");
      }, 5000);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("Пользователь с таким email не найден");
      } else {
        setError("Ошибка отправки. Попробуйте позже.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: "400px", margin: "3rem auto" }}>
      <div className="card">
        <h2>{resetMode ? "Восстановление пароля" : "Вход в интернет-банк"}</h2>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {!resetMode ? (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? "Вход..." : "Войти"}
            </button>
            <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setResetMode(true)}
                style={{ background: "none", color: "#3b82f6", textDecoration: "underline", padding: 0 }}
              >
                Забыли пароль?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
              type="email"
              placeholder="Ваш email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? "Отправка..." : "Отправить ссылку для сброса"}
            </button>
            <button
              type="button"
              onClick={() => setResetMode(false)}
              style={{ background: "transparent", color: "#94a3b8", marginTop: "0.5rem" }}
            >
              ← Вернуться ко входу
            </button>
          </form>
        )}

        <p style={{ marginTop: "1rem", textAlign: "center" }}>
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}