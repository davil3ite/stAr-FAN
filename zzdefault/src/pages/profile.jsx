// profile.jsx

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSession, logout,
  updateName, updateEmail, updatePassword, updateUsername, updateAvatar, deleteAccount
} from "../auth.js";
import { uploadImage } from "../storage.js";
import "./css/profile.css";

function Profile() {
  const navigate = useNavigate();
  const [session, setSession] = useState(getSession());
  const avatarInputRef = useRef(null);

  const [name, setName] = useState(session?.name || "");
  const [email, setEmail] = useState(session?.email || "");
  const [newUsername, setNewUsername] = useState(session?.username || "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [usernamePw, setUsernamePw] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [loading, setLoading] = useState(false);

  if (!session) { navigate("/"); return null; }

  function flash(text, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: "", ok: true }), 3500);
  }

  async function handleAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    flash("Enviando foto...");
    // Sobe a imagem para o Storage e salva só a URL
    const up = await uploadImage(file, "avatares");
    if (!up.ok) { flash("Erro ao enviar foto.", false); return; }
    const result = await updateAvatar(session.username, up.url);
    if (result.ok) { setSession(prev => ({ ...prev, avatar: up.url })); flash("Foto atualizada!"); }
    else flash("Erro ao salvar foto.", false);
    e.target.value = "";
  }

  async function handleName() {
    if (!name.trim()) { flash("Nome não pode ser vazio.", false); return; }
    setLoading(true);
    const result = await updateName(session.username, name.trim());
    setLoading(false);
    if (result.ok) { setSession(result.session); flash("Nome atualizado!"); }
    else flash("Erro ao atualizar nome.", false);
  }

  async function handleEmail() {
    if (!email.trim() || !emailPw) { flash("Preencha o email e a senha.", false); return; }
    setLoading(true);
    const result = await updateEmail(session.username, email.trim(), emailPw);
    setLoading(false); setEmailPw("");
    if (result.ok) { setSession(result.session); flash("Email atualizado!"); }
    else if (result.error === "wrong_password") flash("Senha incorreta.", false);
    else if (result.error === "email_taken") flash("Este email já está em uso.", false);
    else flash("Erro ao atualizar email.", false);
  }

  async function handlePassword() {
    if (!currentPw || !newPw || !confirmPw) { flash("Preencha todos os campos.", false); return; }
    if (newPw !== confirmPw) { flash("As senhas não coincidem.", false); return; }
    if (newPw.length < 6) { flash("A nova senha precisa ter ao menos 6 caracteres.", false); return; }
    setLoading(true);
    const result = await updatePassword(session.username, currentPw, newPw);
    setLoading(false); setCurrentPw(""); setNewPw(""); setConfirmPw("");
    if (result.ok) flash("Senha atualizada!");
    else if (result.error === "wrong_password") flash("Senha atual incorreta.", false);
    else flash("Erro ao atualizar senha.", false);
  }

  async function handleUsername() {
    if (!newUsername.trim() || !usernamePw) { flash("Preencha o username e a senha.", false); return; }
    setLoading(true);
    const result = await updateUsername(session.username, newUsername.trim(), usernamePw);
    setLoading(false); setUsernamePw("");
    if (result.ok) { setSession(result.session); flash("Username atualizado!"); }
    else if (result.error === "wrong_password") flash("Senha incorreta.", false);
    else if (result.error === "username_taken") flash("Username já em uso.", false);
    else if (result.error === "username_invalid") flash("Username inválido.", false);
    else if (result.error === "cooldown") flash("Você só pode mudar o username 1x a cada 24h.", false);
    else flash("Erro ao atualizar username.", false);
  }

  async function handleDelete() {
    if (!deletePw) { flash("Digite sua senha para confirmar.", false); return; }
    if (!window.confirm("Tem certeza? Esta ação é irreversível.")) return;
    setLoading(true);
    const result = await deleteAccount(session.username, deletePw);
    setLoading(false);
    if (result.ok) { logout(); navigate("/"); }
    else if (result.error === "wrong_password") flash("Senha incorreta.", false);
    else flash("Erro ao deletar conta.", false);
  }

  return (
    <div>
      <header className="header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate("/")}>◀</button>
        </div>
        <div className="header-center">
          <button className="btn-logo" onClick={() => navigate("/")}>
            <img src="/logofanNEOsite.png" style={{ height: "65px", width: "auto" }} />
          </button>
        </div>
        <div className="header-right" />
      </header>

      <main className="profile-content">
        <div className="profile-card">
          <h1 className="profile-title">Meu Perfil</h1>
          {msg.text && <p className={`profile-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

          <div className="profile-section">
            <p className="section-label">Foto de perfil</p>
            <div className="avatar-row">
              {session.avatar ? <img src={session.avatar} className="profile-avatar" alt="avatar" /> : <div className="profile-avatar-placeholder">{session.name[0].toUpperCase()}</div>}
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
              <button className="file-btn" onClick={() => avatarInputRef.current.click()}>
                {session.avatar ? "Trocar foto" : "Adicionar foto"}
              </button>
            </div>
          </div>

          <div className="profile-section">
            <label className="section-label">Nome</label>
            <div className="profile-row">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
              <button className="profile-save" onClick={handleName} disabled={loading}>Salvar</button>
            </div>
          </div>

          <div className="profile-section">
            <label className="section-label">Username <span className="section-hint">(1x a cada 24h)</span></label>
            <div className="profile-row">
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="novo_username" />
              <input type="password" value={usernamePw} onChange={e => setUsernamePw(e.target.value)} placeholder="Sua senha" />
              <button className="profile-save" onClick={handleUsername} disabled={loading}>Salvar</button>
            </div>
          </div>

          <div className="profile-section">
            <label className="section-label">Email</label>
            <div className="profile-row">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="novo@email.com" />
              <input type="password" value={emailPw} onChange={e => setEmailPw(e.target.value)} placeholder="Sua senha" />
              <button className="profile-save" onClick={handleEmail} disabled={loading}>Salvar</button>
            </div>
          </div>

          <div className="profile-section">
            <label className="section-label">Senha</label>
            <div className="profile-col">
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Senha atual" />
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Nova senha" />
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirmar nova senha" />
              <button className="profile-save" onClick={handlePassword} disabled={loading}>Salvar</button>
            </div>
          </div>

          <div className="profile-section">
            <label className="section-label danger">Deletar conta</label>
            <div className="profile-row">
              <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)} placeholder="Digite sua senha para confirmar" />
              <button className="profile-delete" onClick={handleDelete} disabled={loading}>Deletar</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Profile;