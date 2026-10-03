// login.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth.js";
import "./css/login.css";

const INSTAGRAM_URL = "https://www.instagram.com/folhaalfanews/";
const CONTACT_EMAIL = "folhaalfanews@gmail.com";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(""); }

  async function handleSubmit() {
    if (!form.email || !form.password) { setError("Preencha todos os campos."); return; }
    setLoading(true);
    const result = await login(form);
    setLoading(false);
    if (!result.ok) { setError("Email ou senha incorretos."); return; }
    navigate("/");
  }

  return (
    <div className="auth-page">
      <header className="header">
        <div className="header-left" />
        <div className="header-center">
          <button className="btn-logo" onClick={() => navigate("/")}>
            <img src="/logofanNEOsite.png" style={{ height: "65px", width: "auto" }} />
          </button>
        </div>
        <div className="header-right">
          <button className="btn-login active">Login</button>
          <button className="btn-signup" onClick={() => navigate("/signup")}>Sign up</button>
        </div>
      </header>

      <main className="auth-content">
        <div className="auth-card">
          <h1 className="auth-title">Entrar</h1>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" name="email" placeholder="seu@email.com" value={form.email} onChange={handleChange} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div className="auth-field">
            <label>Senha</label>
            <input type="password" name="password" placeholder="••••••••" value={form.password} onChange={handleChange} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" onClick={handleSubmit} disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
          <p className="auth-switch">Não tem conta? <span onClick={() => navigate("/signup")}>Criar conta</span></p>
        </div>
      </main>

      <footer className="footer">
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="footer-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span>Siga-nos no Instagram</span>
        </a>
        <span className="footer-dot">•</span>
        <span className="footer-text">{CONTACT_EMAIL}</span>
      </footer>
    </div>
  );
}

export default Login;