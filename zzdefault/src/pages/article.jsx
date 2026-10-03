// article.jsx

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSession } from "../auth.js";
import { getArticleById, getEditionById, deleteArticle } from "../articles.js";
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

function Article() {
  const navigate = useNavigate();
  const { id } = useParams();
  const session = getSession();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [article, setArticle] = useState(null);
  const [edition, setEdition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getArticleById(id).then(data => {
      setArticle(data);
      setLoading(false);
      if (data?.edition_id) {
        getEditionById(data.edition_id).then(ed => setEdition(ed));
      }
    });
  }, [id]);

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