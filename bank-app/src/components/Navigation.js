import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import "./Navigation.css";

export default function Navigation() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Ошибка выхода:", error);
    }
  };

  if (!currentUser) return null;

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/dashboard" className="logo">
          Банк "Надёжный"
        </Link>
        <button className="menu-icon" onClick={() => setIsOpen(!isOpen)}>
          ☰
        </button>
        <div className={`nav-links ${isOpen ? "open" : ""}`}>
          <Link to="/dashboard" className="link" onClick={() => setIsOpen(false)}>Главная</Link>
          <Link to="/transfer" className="link" onClick={() => setIsOpen(false)}>Перевод</Link>
          <button onClick={handleLogout} className="logout-btn">Выйти</button>
        </div>
      </div>
    </nav>
  );
}