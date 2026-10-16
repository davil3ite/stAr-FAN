// article.jsx

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSession } from "../auth.js";
import { getArticleById, getEditionById, deleteArticle, getMyVotes, castVote } from "../articles.js";
import { formatCount } from "../votes-format.js";
import "./css/article.css";

const INSTAGRAM_URL = "https://www.instagram.com/folhaalfanews/";
const CONTACT_EMAIL = "folhaalfanews@gmail.com";

function formatAuthorsText(author, coauthors) {
  if (author === "anonymous") return "Autoria Anônima";

  const all = [author, ...(coauthors || [])];
  if (all.length === 1) return all[0].name;
  if (all.length === 2) return `${all[0].name} & ${all[1].name}`;
  const last = all[all.length - 1];
  const rest = all.slice(0, -1).map(a => a.name).join(", ");
  return `${rest} & ${last.name}`;
}

function AuthorAvatars({ author, coauthors }) {
  if (author === "anonymous") {
    return (
      <div className="article-avatars">
        <div className="article-avatar-anonymous" />
      </div>
    );
  }

  const all = [author, ...(coauthors || [])];
  return (
    <div className="article-avatars">
      {all.map((a, i) => (
        a.avatar
          ? <img
              key={a.username || i}
              src={a.avatar}
              className="article-avatar"
              alt={a.name}
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: all.length - i }}
            />
          : <div
              key={a.username || i}
              className="article-avatar-placeholder"
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: all.length - i }}
            >
              {a.name[0].toUpperCase()}
            </div>
      ))}
    </div>
  );
}

/* ── Botões de like/dislike (versão da página do artigo) ── */
function VoteButtons({ likes, dislikes, myVote, onVote, logged }) {
  function handle(value) {
    if (!logged) return;
    onVote(myVote === value ? null : value);
  }

  return (
    <div className="article-vote-group">
      <button
        type="button"
        className={`vote-btn like ${myVote === "like" ? "active" : ""}`}
        onClick={() => handle("like")}
        disabled={!logged}
        title={logged ? "Gostei" : "Faça login pra votar"}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path d="M2 10.5h3.2V21H2V10.5zm19.3.4c0-1-.8-1.9-1.9-1.9h-5.4l.8-3.9v-.2c0-.4-.2-.8-.4-1.1l-.9-.8-5.6 5.6c-.3.3-.5.8-.5 1.3V19c0 1 .9 1.9 1.9 1.9h7.8c.8 0 1.5-.5 1.8-1.2l2.6-6.1c.1-.2.1-.4.1-.6v-.1z"/>
        </svg>
        <span className="vote-count">{formatCount(likes)}</span>
      </button>

      <button
        type="button"
        className={`vote-btn dislike ${myVote === "dislike" ? "active" : ""}`}
        onClick={() => handle("dislike")}
        disabled={!logged}
        title={logged ? "Não gostei" : "Faça login pra votar"}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path d="M22 13.5h-3.2V3H22v10.5zM2.7 13.1c0 1 .8 1.9 1.9 1.9H10l-.8 3.9v.2c0 .4.2.8.4 1.1l.9.8 5.6-5.6c.3-.3.5-.8.5-1.3V5c0-1-.9-1.9-1.9-1.9H6.9c-.8 0-1.5.5-1.8 1.2L2.5 10.4c-.1.2-.1.4-.1.6v.1z"/>
        </svg>
        <span className="vote-count">{formatCount(dislikes)}</span>
      </button>
    </div>
  );
}

function Article() {
  const navigate = useNavigate();
  const { id } = useParams();
  const session = getSession();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [article, setArticle] = useState(null);
  const [edition, setEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  // voto do usuário logado neste artigo: 'like' | 'dislike' | null
  const [myVote, setMyVote] = useState(null);

  useEffect(() => {
    Promise.all([getArticleById(id), getMyVotes()]).then(([data, votes]) => {
      setArticle(data);
      setMyVote(votes[id] || null);
      setLoading(false);
      if (data?.edition_id) {
        getEditionById(data.edition_id).then(ed => setEdition(ed));
      }
    });
  }, [id]);

  // Clique num botão de voto.
  async function handleVote(value) {
    const prevVote = myVote;
    if (prevVote === value) return;

    // 1. Atualiza na hora (otimista)
    setMyVote(value);
    setArticle(prev => {
      if (!prev) return prev;
      let like = prev.like || 0;
      let dislike = prev.dislike || 0;
      if (prevVote === "like") like--;
      if (prevVote === "dislike") dislike--;
      if (value === "like") like++;
      if (value === "dislike") dislike++;
      return { ...prev, like: Math.max(0, like), dislike: Math.max(0, dislike) };
    });

    // 2. Grava. Se falhar, desfaz.
    const res = await castVote(id, value);
    if (!res.ok) {
      setMyVote(prevVote);
      setArticle(prev => {
        if (!prev) return prev;
        let like = prev.like || 0;
        let dislike = prev.dislike || 0;
        if (value === "like") like--;
        if (value === "dislike") dislike--;
        if (prevVote === "like") like++;
        if (prevVote === "dislike") dislike++;
        return { ...prev, like: Math.max(0, like), dislike: Math.max(0, dislike) };
      });
    }
  }

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f5f5f5" }}><p style={{ color: "#aaa", fontFamily: "Syne, sans-serif" }}>Carregando...</p></div>;
  if (!article) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f5f5f5" }}><p style={{ color: "#aaa", fontFamily: "Syne, sans-serif" }}>Matéria não encontrada.</p></div>;

  const canEdit = session && (
    article.author === "anonymous"
      ? session.type === "adm+"
      : session.username === article.author.username || session.type === "adm+"
  );

  async function handleDelete() {
    if (window.confirm("Tem certeza que quer deletar esta matéria?")) { await deleteArticle(id); navigate("/"); }
  }

  return (
    <div className="article-page">
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

      <main className="article-content">
        <div className="article-body">
          <span className="article-type">
            {article.type}
            {article.theme && <> • {article.theme}</>}
            {edition && <> • Edição {edition.number}</>}
          </span>
          <h1 className="article-headline">{article.headline}</h1>
          <div className="article-author-row">
            <AuthorAvatars author={article.author} coauthors={article.coauthors} />
            <span className="article-author">{formatAuthorsText(article.author, article.coauthors)}</span>
          </div>
          {article.cover_image && <img src={article.cover_image} alt="capa" className="article-cover" />}
          <div className="article-text" dangerouslySetInnerHTML={{ __html: article.body }} />
          {article.sources && article.sources.filter(s => s.url).length > 0 && (
            <div className="sources-dropdown">
              <button className="sources-toggle" onClick={() => setSourcesOpen(v => !v)}>Fontes {sourcesOpen ? "▲" : "▼"}</button>
              {sourcesOpen && (
                <ul className="sources-list">
                  {article.sources.filter(s => s.url).map((s, i) => (
                    <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.label || s.url}</a></li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="article-rate">
            <span className="article-rate-text">Gostou desse artigo?</span>
            <VoteButtons
              likes={article.like || 0}
              dislikes={article.dislike || 0}
              myVote={myVote}
              onVote={handleVote}
              logged={!!session}
            />
          </div>

          {canEdit && (
            <div className="author-actions">
              <button className="btn-edit" onClick={() => navigate(`/write/${id}`)}>Editar</button>
              <button className="btn-delete" onClick={handleDelete}>Deletar</button>
            </div>
          )}
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

export default Article;