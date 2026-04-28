import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import "./Navigation.css";

export default function Navigation() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const fetchRole = async () => {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        setIsAdmin(userDoc.data().role === "admin");
      }
    };
    fetchRole();
  }, [currentUser]);

  if (!currentUser) return null;

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/dashboard" className="logo">Банк "Надёжный"</Link>
        <button className="menu-icon" onClick={() => setIsOpen(!isOpen)}>☰</button>
        <div className={`nav-links ${isOpen ? "open" : ""}`}>
          <Link to="/dashboard" className="link" onClick={() => setIsOpen(false)}>Главная</Link>
          <Link to="/accounts" className="link" onClick={() => setIsOpen(false)}>Счета</Link>
          <Link to="/transfer" className="link" onClick={() => setIsOpen(false)}>Перевод</Link>
          <Link to="/contacts" className="link" onClick={() => setIsOpen(false)}>Контакты</Link>
          <Link to="/account" className="link" onClick={() => setIsOpen(false)}>Аккаунт</Link>
          {isAdmin && <Link to="/admin" className="link" onClick={() => setIsOpen(false)}>Админка</Link>}
          
        </div>
      </div>
    </nav>
  );
}