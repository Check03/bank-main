import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
export default function Navigation() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await signOut(auth); navigate("/login"); };
  if (!currentUser) return null;
  return (
    <nav style={{backgroundColor:"#1e3a8a",padding:"1rem"}}>
      <div style={{maxWidth:"1200px",margin:"0 auto",display:"flex",justifyContent:"space-between"}}>
        <Link to="/dashboard" style={{color:"white",textDecoration:"none",fontSize:"1.5rem"}}>Банк</Link>
        <div>
          <Link to="/dashboard" style={{color:"white",marginRight:"1rem"}}>Главная</Link>
          <Link to="/transfer" style={{color:"white",marginRight:"1rem"}}>Перевод</Link>
          <button onClick={handleLogout} style={{backgroundColor:"#dc2626",color:"white",border:"none",padding:"0.5rem"}}>Выйти</button>
        </div>
      </div>
    </nav>
  );
}