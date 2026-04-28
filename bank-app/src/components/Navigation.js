import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import "./Navigation.css";

export default function Navigation() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error(error);
    }
  };

  if (!currentUser) return null;

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/dashboard" className="logo">Банк "Надёжный"</Link>
        <button className="menu-icon" onClick={() => setIsOpen(!isOpen)}>☰</button>
        <div className={`nav-links ${isOpen ? "open" : ""}`}>
          <Link to="/dashboard" className="link" onClick={() => setIsOpen(false)}>Главная</Link>
          <Link to="/transfer" className="link" onClick={() => setIsOpen(false)}>Перевод</Link>
          <Link to="/contacts" className="link" onClick={() => setIsOpen(false)}>Контакты</Link>
          <Link to="/account" className="link" onClick={() => setIsOpen(false)}>Аккаунт</Link>
          {isAdmin && <Link to="/admin" className="link" onClick={() => setIsOpen(false)}>Админка</Link>}
        </div>
      </div>
    </nav>
  );
}