// hub.jsx

import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom'
import { getSession, logout } from "../auth.js";
import { getArticles, deleteArticle, timeAgo, getEditions, getMyVotes, castVote, getFeaturedArticle } from "../articles.js";
import { formatCount } from "../votes-format.js";
import "./css/hub.css";

const INSTAGRAM_URL = "https://www.instagram.com/folhaalfanews/";
const CONTACT_EMAIL = "folhaalfanews@gmail.com";

/* ── Helpers de co-autoria ── */
function formatAuthorsText(author, coauthors) {
  // Autoria anônima
  if (author === "anonymous") return "Autoria Anônima";

  const all = [author, ...(coauthors || [])];
  if (all.length === 1) return all[0].name;
  if (all.length === 2) return `${all[0].name} & ${all[1].name}`;
  const last = all[all.length - 1];
  const rest = all.slice(0, -1).map(a => a.name).join(", ");
  return `${rest} & ${last.name}`;
}

function AuthorAvatars({ author, coauthors }) {
  // Autoria anônima: exibe avatar padrão preto
  if (author === "anonymous") {
    return (
      <div className="card-avatars">
        <div className="card-avatar-anonymous" />
      </div>
    );
  }

  const all = [author, ...(coauthors || [])];
  return (
    <div className="card-avatars">
      {all.map((a, i) => (
        a.avatar
          ? <img
              key={a.username || i}
              src={a.avatar}
              className="card-avatar"
              alt={a.name}
              style={{ marginLeft: i === 0 ? 0 : -6, zIndex: all.length - i }}
            />
          : <div
              key={a.username || i}
              className="card-avatar-placeholder"
              style={{ marginLeft: i === 0 ? 0 : -6, zIndex: all.length - i }}
            >
              {a.name[0].toUpperCase()}
            </div>
      ))}
    </div>
  );
}

/* ── Botões de like/dislike ── */
function VoteButtons({ likes, dislikes, myVote, onVote, logged }) {
  // Clique: se já tava marcado nessa opção, tira (null); senão marca.
  function handle(e, value) {
    e.stopPropagation();
    if (!logged) return;
    onVote(myVote === value ? null : value);
  }

  return (
    <div className="vote-group" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className={`vote-btn like ${myVote === "like" ? "active" : ""}`}
        onClick={e => handle(e, "like")}
        disabled={!logged}
        title={logged ? "Gostei" : "Faça login pra votar"}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M2 10.5h3.2V21H2V10.5zm19.3.4c0-1-.8-1.9-1.9-1.9h-5.4l.8-3.9v-.2c0-.4-.2-.8-.4-1.1l-.9-.8-5.6 5.6c-.3.3-.5.8-.5 1.3V19c0 1 .9 1.9 1.9 1.9h7.8c.8 0 1.5-.5 1.8-1.2l2.6-6.1c.1-.2.1-.4.1-.6v-.1z"/>
        </svg>
        <span className="vote-count">{formatCount(likes)}</span>
      </button>

      <button
        type="button"
        className={`vote-btn dislike ${myVote === "dislike" ? "active" : ""}`}
        onClick={e => handle(e, "dislike")}
        disabled={!logged}
        title={logged ? "Não gostei" : "Faça login pra votar"}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M22 13.5h-3.2V3H22v10.5zM2.7 13.1c0 1 .8 1.9 1.9 1.9H10l-.8 3.9v.2c0 .4.2.8.4 1.1l.9.8 5.6-5.6c.3-.3.5-.8.5-1.3V5c0-1-.9-1.9-1.9-1.9H6.9c-.8 0-1.5.5-1.8 1.2L2.5 10.4c-.1.2-.1.4-.1.6v.1z"/>
        </svg>
        <span className="vote-count">{formatCount(dislikes)}</span>
      </button>
    </div>
  );
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const [session, setSession] = useState(getSession());
  const [articles, setArticles] = useState([]);
  const [editions, setEditions] = useState([]);
  // votos do usuário logado: { [article_id]: 'like' | 'dislike' }
  const [myVotes, setMyVotes] = useState({});
  // matéria em destaque marcada por adm+ (ou null se ninguém marcou)
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    Promise.all([getArticles(), getEditions(), getMyVotes(), getFeaturedArticle()])
      .then(([arts, eds, votes, feat]) => {
        setArticles(arts);
        setEditions(eds);
        setMyVotes(votes);
        setFeatured(feat);
      });
  }, []);

  function handleLogout() { logout(); setSession(null); navigate('/'); }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (window.confirm("Tem certeza que quer deletar esta matéria?")) {
      await deleteArticle(id);
      setArticles(prev => prev.filter(a => a.id !== id));
      setFeatured(prev => (prev && prev.id === id ? null : prev));
    }
  }

  // Clique num botão de voto. Atualiza o card na lista E o destaque (se for o mesmo).
  async function handleVote(articleId, value) {
    const prevVote = myVotes[articleId] || null;
    if (prevVote === value) return; // nada muda

    // função que recalcula like/dislike de um artigo
    const applyDelta = (a) => {
      if (a.id !== articleId) return a;
      let like = a.like || 0;
      let dislike = a.dislike || 0;
      if (prevVote === "like") like--;
      if (prevVote === "dislike") dislike--;
      if (value === "like") like++;
      if (value === "dislike") dislike++;
      return { ...a, like: Math.max(0, like), dislike: Math.max(0, dislike) };
    };
    const undoDelta = (a) => {
      if (a.id !== articleId) return a;
      let like = a.like || 0;
      let dislike = a.dislike || 0;
      if (value === "like") like--;
      if (value === "dislike") dislike--;
      if (prevVote === "like") like++;
      if (prevVote === "dislike") dislike++;
      return { ...a, like: Math.max(0, like), dislike: Math.max(0, dislike) };
    };

    // 1. Atualiza a tela na hora (otimista)
    setMyVotes(prev => {
      const next = { ...prev };
      if (value === null) delete next[articleId];
      else next[articleId] = value;
      return next;
    });
    setArticles(prev => prev.map(applyDelta));
    setFeatured(prev => (prev ? applyDelta(prev) : prev));

    // 2. Grava no banco. Se falhar, desfaz.
    const res = await castVote(articleId, value);
    if (!res.ok) {
      setMyVotes(prev => {
        const next = { ...prev };
        if (prevVote === null) delete next[articleId];
        else next[articleId] = prevVote;
        return next;
      });
      setArticles(prev => prev.map(undoDelta));
      setFeatured(prev => (prev ? undoDelta(prev) : prev));
    }
  }

  function canEdit(article) {
    if (!session) return false;
    // Artigos anônimos: só adm+ pode editar
    if (article.author === "anonymous") return session.type === "adm+";
    return session.username === article.author.username || session.type === "adm+";
  }

  function groupByEdition(articles, editions) {
    const edMap = {};
    editions.forEach(e => { edMap[e.id] = e; });
    const groups = {};
    articles.forEach(a => {
      const key = a.edition_id || "__none__";
      if (!groups[key]) {
        groups[key] = { edition: a.edition_id ? edMap[a.edition_id] : null, articles: [] };
      }
      groups[key].articles.push(a);
    });
    const sorted = Object.values(groups).sort((a, b) => {
      if (!a.edition) return 1;
      if (!b.edition) return -1;
      return b.edition.number - a.edition.number;
    });
    return sorted;
  }

  // Card pequeno (usado no grid de baixo)
  function ArticleCard({ a }) {
    return (
      <div className="article-card" key={a.id} onClick={() => navigate(`/article/${a.id}`)}>
        {a.cover_image && <div className="card-cover" style={{ backgroundImage: `url(${a.cover_image})` }} />}
        <div className="card-body">
          <span className="card-type">
            {a.type}{a.theme ? ` • ${a.theme}` : ""}
          </span>
          <h2 className="card-headline">{a.headline}</h2>
          <p className="card-excerpt">{a.body.replace(/<[^>]+>/g, '').slice(0, 120)}...</p>
          <div className="card-meta">
            <AuthorAvatars author={a.author} coauthors={a.coauthors} />
            <span>{formatAuthorsText(a.author, a.coauthors)}</span>
            <span>{timeAgo(a.created_at)}</span>
          </div>
          <VoteButtons
            likes={a.like || 0}
            dislikes={a.dislike || 0}
            myVote={myVotes[a.id] || null}
            onVote={(value) => handleVote(a.id, value)}
            logged={!!session}
          />
          {canEdit(a) && (
            <div className="card-actions" onClick={e => e.stopPropagation()}>
              <button className="card-action-btn" onClick={e => { e.stopPropagation(); navigate(`/write/${a.id}`); }} title="Editar">✏️</button>
              <button className="card-action-btn delete" onClick={e => handleDelete(e, a.id)} title="Deletar">🗑️</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Define a matéria do topo: a marcada como destaque OU, se não houver, a mais recente.
  const isRealFeatured = !!featured;
  const topArticle = featured || (articles.length > 0 ? articles[0] : null);

  // Edição do artigo do topo (pra mostrar "Edição N" nos campos dele)
  const topEdition = topArticle
    ? editions.find(e => e.id === topArticle.edition_id) || null
    : null;

  // Lista de baixo: todos menos o do topo (pra não repetir)
  const restArticles = topArticle
    ? articles.filter(a => a.id !== topArticle.id)
    : articles;

  const grouped = groupByEdition(restArticles, editions);
  const hasMultipleEditions = grouped.filter(g => g.edition !== null).length > 1 ||
    (grouped.length === 1 && grouped[0].edition !== null);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <button className={`menu-btn ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle menu">
            <span/><span/><span/>
          </button>
        </div>
        <div className="header-center">
          <button className="btn-logo" disabled="true">
            <img src="/logofanNEOsite.png" style={{ height: "65px", width: "auto" }} />
          </button>
        </div>
        <div className="header-right">
          {session ? (
            <>
              <button className="header-profile-btn" onClick={() => navigate('/profile')}>
                {session.avatar ? <img src={session.avatar} className="header-avatar" alt="avatar" /> : <div className="header-avatar-placeholder">{session.name[0].toUpperCase()}</div>}
                <span className="header-username">{session.name}</span>
              </button>
              {(session.type === "adm" || session.type === "adm+") && (
                <button className="btn-write" onClick={() => navigate('/write')}>Escrever</button>
              )}
              <button className="btn-login" onClick={handleLogout}>Sair</button>
            </>
          ) : (
            <>
              <button className="btn-login" onClick={() => navigate('/login')}>Log in</button>
              <button className="btn-signup" onClick={() => navigate('/signup')}>Sign up</button>
            </>
          )}
        </div>
      </header>

      <div className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <button className="sidebar-home" onClick={() => navigate('/')}>Início</button>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-social">
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="sidebar-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </a>
            <span className="sidebar-dot">•</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="sidebar-email">{CONTACT_EMAIL}</a>
          </div>
          <div className="sidebar-logsign">
            {session ? (
              <>
                <button className="sb-login" onClick={() => navigate('/profile')}>Perfil</button>
                <button className="sb-login" onClick={handleLogout}>Sair</button>
              </>
            ) : (
              <>
                <button className="sb-login" onClick={() => navigate('/login')}>Log in</button>
                <button className="sb-signup" onClick={() => navigate('/signup')}>Sign up</button>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className="page-content">
        {!topArticle ? <p className="page-hint"></p> : (
          <div className="home-wrap">

            {/* ── Matéria em destaque (ou mais recente) ── */}
            <section className="featured-section">
              <div className="section-head">
                <span className="section-head-label">
                  {isRealFeatured ? "Notícia em destaque" : "Notícia mais recente"}
                  {isRealFeatured && <span className="section-star"> ★</span>}
                </span>
                <span className="section-head-line" />
              </div>

              <div className="featured-card" onClick={() => navigate(`/article/${topArticle.id}`)}>
                {topArticle.cover_image && (
                  <div className="featured-cover" style={{ backgroundImage: `url(${topArticle.cover_image})` }} />
                )}
                <div className="featured-body">
                  <span className="card-type">
                    {topArticle.type}
                    {topArticle.theme ? ` • ${topArticle.theme}` : ""}
                    {topEdition ? ` • Edição ${topEdition.number}` : ""}
                    {isRealFeatured ? " ★" : ""}
                  </span>
                  <h2 className="featured-headline">{topArticle.headline}</h2>
                  <p className="featured-excerpt">{topArticle.body.replace(/<[^>]+>/g, '').slice(0, 260)}...</p>
                  <div className="card-meta">
                    <AuthorAvatars author={topArticle.author} coauthors={topArticle.coauthors} />
                    <span>{formatAuthorsText(topArticle.author, topArticle.coauthors)}</span>
                    <span>{timeAgo(topArticle.created_at)}</span>
                  </div>
                  <VoteButtons
                    likes={topArticle.like || 0}
                    dislikes={topArticle.dislike || 0}
                    myVote={myVotes[topArticle.id] || null}
                    onVote={(value) => handleVote(topArticle.id, value)}
                    logged={!!session}
                  />
                  {canEdit(topArticle) && (
                    <div className="card-actions" onClick={e => e.stopPropagation()}>
                      <button className="card-action-btn" onClick={e => { e.stopPropagation(); navigate(`/write/${topArticle.id}`); }} title="Editar">✏️</button>
                      <button className="card-action-btn delete" onClick={e => handleDelete(e, topArticle.id)} title="Deletar">🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Demais notícias, agrupadas por edição ── */}
            {grouped.map((group, gi) => (
              <section key={gi} className="edition-section">
                <div className="section-head">
                  <span className="section-head-label">
                    {group.edition ? `Edição ${group.edition.number}` : "Sem edição"}
                  </span>
                  <span className="section-head-line" />
                </div>
                <div className="cards-grid">
                  {group.articles.map(a => <ArticleCard key={a.id} a={a} />)}
                </div>
              </section>
            ))}

          </div>
        )}
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

export default Layout;