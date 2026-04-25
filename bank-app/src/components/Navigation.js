import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Navigation() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

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
    <nav style={navStyles.nav}>
      <div style={navStyles.navContainer}>
        <Link to="/dashboard" style={navStyles.logo}>Банк "Надёжный"</Link>
        <div style={navStyles.navLinks}>
          <Link to="/dashboard" style={navStyles.link}>Главная</Link>
          <Link to="/transfer" style={navStyles.link}>Перевод</Link>
          <button onClick={handleLogout} style={navStyles.logoutBtn}>Выйти</button>
        </div>
      </div>
    </nav>
  );
}

const navStyles = {
  nav: { backgroundColor: "#1e3a8a", padding: "1rem", color: "white" },
  navContainer: { maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { color: "white", fontSize: "1.5rem", fontWeight: "bold", textDecoration: "none" },
  navLinks: { display: "flex", gap: "1.5rem", alignItems: "center" },
  link: { color: "white", textDecoration: "none", fontSize: "1rem" },
  logoutBtn: { backgroundColor: "#dc2626", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer" }
};