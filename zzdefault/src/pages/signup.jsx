// signup.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { register, isUsernameTaken, sanitizeUsername } from "../auth.js";
import "./css/signup.css";

const INSTAGRAM_URL = "https://www.instagram.com/folhaalfanews/";
const CONTACT_EMAIL = "folhaalfanews@gmail.com";

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirm: "" });
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    let value = e.target.value;
    if (e.target.name === "username") { value = sanitizeUsername(value); setUsernameStatus(null); }
    setForm(f => ({ ...f, [e.target.name]: value }));
    setError("");
  }
  useEffect(() => {
    if (!form.username) { setUsernameStatus(null); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const taken = await isUsernameTaken(form.username);
      setUsernameStatus(taken ? "taken" : "available");
    }, 500);
    return () => clearTimeout(t);
  }, [form.username]);

  async function handleSubmit() {
    if (!form.name || !form.username || !form.email || !form.password || !form.confirm) { setError("Preencha todos os campos."); return; }
    if (usernameStatus === "taken") { setError("Nome de usuário já existe."); return; }
    if (usernameStatus === "checking") { setError("Aguarde a verificação do usuário."); return; }
    if (form.password !== form.confirm) { setError("As senhas não coincidem."); return; }
    if (form.password.length < 6) { setError("A senha precisa ter ao menos 6 caracteres."); return; }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (!result.ok) {
      if (result.error === "username") setError("Nome de usuário já existe.");
      else if (result.error === "email") setError("Este email já está cadastrado.");
      else if (result.error === "username_invalid") setError("Nome de usuário inválido.");
      return;
    }
    navigate("/login");
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
          <button className="btn-login" onClick={() => navigate("/login")}>Login</button>
          <button className="btn-signup active">Sign up</button>
        </div>
      </header>

      <main className="auth-content">
        <div className="auth-card">
          <h1 className="auth-title">Criar conta</h1>
          <div className="auth-field">
            <label>Nome</label>
            <input type="text" name="name" placeholder="Seu nome" value={form.name} onChange={handleChange} />
          </div>
          <div className="auth-field">
            <label>Nome de usuário</label>
            <div className="username-wrap">
              <input type="text" name="username" placeholder="ex: joao_silva" value={form.username} onChange={handleChange} />
              {usernameStatus === "checking" && <span className="ucheck checking">Verificando...</span>}
              {usernameStatus === "available" && <span className="ucheck available">✓ Disponível</span>}
              {usernameStatus === "taken" && <span className="ucheck taken">✗ Indisponível</span>}
            </div>
            <span className="field-hint">Apenas letras minúsculas, números, hífens, pontos e underlines.</span>
          </div>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" name="email" placeholder="seu@email.com" value={form.email} onChange={handleChange} />
          </div>
          <div className="auth-field">
            <label>Senha</label>
            <input type="password" name="password" placeholder="Mín. 6 caracteres" value={form.password} onChange={handleChange} />
          </div>
          <div className="auth-field">
            <label>Confirmar senha</label>
            <input type="password" name="confirm" placeholder="••••••••" value={form.confirm} onChange={handleChange} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" onClick={handleSubmit} disabled={loading}>{loading ? "Criando conta..." : "Criar conta"}</button>
          <p className="auth-switch">Já tem conta? <span onClick={() => navigate("/login")}>Entrar</span></p>
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

export default Signup;