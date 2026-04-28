import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Неверный email или пароль");
    }
  };

  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <h2>Вход в интернет-банк</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="button-primary">Войти</button>
        </form>
        <p style={{ textAlign: "center", marginTop: "1rem" }}>
          Нет аккаунта? <Link to="/register" style={{ color: "#60a5fa" }}>Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}