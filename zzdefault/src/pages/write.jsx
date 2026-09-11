// write.jsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSession } from "../auth.js";
import { createArticle, updateArticle, getArticleById, getEditions, createEdition, deleteEdition } from "../articles.js";
import supabase from "../supabase.js";
import "./css/write.css";

const TYPES = ["Notícia", "Reportagem", "Artigo de opinião", "Crônica", "Resenha Crítica"];
const THEMES = ["Esportes", "Cultura", "SESI", "Brasil", "Mundo", "Ciência", "Tecnologia", "Saúde", "Arte", "Culinária"];
const THEMES_VISIBLE = 6;
const MAX_COAUTHORS = 4;

const PARAGRAPH_INDENT = "3em";

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function applyFormat(tag) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    const commands = { b: "bold", i: "italic", u: "underline" };
    if (commands[tag]) document.execCommand(commands[tag], false, null);
    return;
  }
  const range = sel.getRangeAt(0);
  let node = sel.anchorNode;
  while (node) {
    if (node.nodeName === tag.toUpperCase()) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }
    node = node.parentNode;
  }
  const wrapper = document.createElement(tag);
  try {
    range.surroundContents(wrapper);
  } catch {
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }
  const newRange = document.createRange();
  newRange.selectNodeContents(wrapper);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/* ── Recuo de parágrafo (Tab) ──
   Encontra o bloco onde o cursor está dentro do editor e aplica/remove
   text-indent. Se o cursor estiver em texto solto (filho direto do editor),
   envolve a linha num <div> antes de recuar, para não recuar o editor todo. */
function findParagraphBlock(editor, node) {
  // Sobe a partir do nó do cursor até o filho direto do editor
  let current = node;
  while (current && current.parentNode !== editor && current !== editor) {
    current = current.parentNode;
  }
  if (!current || current === editor) return null;
  // Só aceita blocos de elemento (DIV/P), não imagens ou texto solto
  if (current.nodeType !== 1) return null;
  const tag = current.nodeName;
  if (tag !== "DIV" && tag !== "P") return null;
  return current;
}

function toggleParagraphIndent(editor, remove) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  let node = sel.anchorNode;
  if (!node) return;

  let block = findParagraphBlock(editor, node);

  // Texto solto direto no editor: envolve a linha atual num <div>
  if (!block) {
    // formatBlock transforma a linha do cursor num bloco
    document.execCommand("formatBlock", false, "div");
    node = window.getSelection().anchorNode;
    block = findParagraphBlock(editor, node);
  }

  if (!block) return;

  if (remove) {
    block.style.textIndent = "";
    if (!block.getAttribute("style")) block.removeAttribute("style");
  } else {
    block.style.textIndent = PARAGRAPH_INDENT;
  }
}

function IconAlignLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="5.5" width="10" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
}
function IconAlignCenter() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="3" y="5.5" width="10" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="3" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
}
function IconAlignRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="5" y="5.5" width="10" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="5" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
}
function IconAlignJustify() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="5.5" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
}

/* ── Co-author avatar stack ── */
function CoauthorStack({ author, coauthors, onAddClick, onRemove, maxReached, anonymous }) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const hideTimerRef = useRef(null);
  const tooltipRef = useRef(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        setVisible(false);
        setFadeOut(false);
      }, 300);
    }, 3000);
  }, [cancelHide]);

  const hideImmediate = useCallback(() => {
    cancelHide();
    setFadeOut(false);
    setVisible(false);
  }, [cancelHide]);

  const hideFade = useCallback(() => {
    cancelHide();
    setFadeOut(true);
    setTimeout(() => {
      setVisible(false);
      setFadeOut(false);
    }, 300);
  }, [cancelHide]);

  useEffect(() => {
    function handleClick(e) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        hideFade();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [hideFade]);

  useEffect(() => {
    if (coauthors.length === 0) {
      hideImmediate();
    }
  }, [coauthors.length, hideImmediate]);

  useEffect(() => () => cancelHide(), [cancelHide]);

  function handleMouseEnter() {
    if (coauthors.length === 0) return;
    cancelHide();
    setFadeOut(false);
    setVisible(true);
  }

  function handleMouseLeave() {
    if (!visible) return;
    scheduleHide();
  }

  // Se anônimo, exibe avatar padrão e mensagem
  if (anonymous) {
    return (
      <div className="coauthor-row">
        <div className="coauthor-avatars">
          <div className="coauthor-avatar-wrap" style={{ zIndex: 1 }}>
            <div className="coauthor-avatar-anonymous" />
          </div>
        </div>
        <span className="coauthor-anonymous-hint">
          Desative a autoria anônima para adicionar co-autores
        </span>
      </div>
    );
  }

  const allAuthors = [{ ...author, isMain: true }, ...coauthors];

  return (
    <div className="coauthor-row">
      <div
        className="coauthor-avatars"
        ref={tooltipRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {allAuthors.map((a, i) => (
          <div
            key={a.username}
            className="coauthor-avatar-wrap"
            style={{ zIndex: allAuthors.length - i, marginLeft: i === 0 ? 0 : -8 }}
          >
            {a.avatar
              ? <img src={a.avatar} className="coauthor-avatar-img" alt={a.name} />
              : <div className="coauthor-avatar-placeholder">{a.name[0].toUpperCase()}</div>
            }
          </div>
        ))}

        {coauthors.length > 0 && visible && (
          <div
            className={`coauthor-tooltip${fadeOut ? " coauthor-tooltip--fadeout" : ""}`}
            onMouseEnter={() => { cancelHide(); setFadeOut(false); }}
            onMouseLeave={scheduleHide}
          >
            {coauthors.map(ca => (
              <div key={ca.username} className="coauthor-tooltip-item">
                <span className="coauthor-tooltip-name">{ca.username}</span>
                <button
                  className="coauthor-tooltip-remove"
                  onClick={(e) => { e.stopPropagation(); onRemove(ca.username); }}
                  title="Remover co-autor"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!maxReached && (
        <button className="coauthor-add-btn" onClick={onAddClick} title="Adicionar co-autor">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#999" strokeWidth="1.2" strokeDasharray="3 2"/>
            <path d="M7 4v6M4 7h6" stroke="#999" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>Adicionar co-autor</span>
        </button>
      )}
    </div>
  );
}

/* ── Modal de busca de co-autor ── */
function CoauthorSearchModal({ onClose, onAdd, existingUsernames, currentUsername }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); return; }

    clearTimeout(debounceRef.current);
    setResults("loading");
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, username, avatar, type")
        .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
        .in("type", ["adm", "adm+"])
        .limit(8);

      if (error || !data || data.length === 0) {
        setResults("not_found");
        return;
      }

      const filtered = data.filter(
        u => u.username !== currentUsername && !existingUsernames.includes(u.username)
      );

      if (filtered.length === 0) {
        const allSelf = data.every(u => u.username === currentUsername);
        setResults(allSelf ? "self" : "already_added");
      } else {
        setResults(filtered);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function handleAdd(user) {
    setAdding(true);
    onAdd(user);
    onClose();
  }

  const isSpecialState = results === null || results === "loading" || results === "not_found" || results === "self" || results === "already_added";

  return (
    <div className="coauthor-modal-overlay" onClick={onClose}>
      <div className="coauthor-modal" onClick={e => e.stopPropagation()}>
        <div className="coauthor-modal-header">
          <span>Adicionar co-autor</span>
          <button className="coauthor-modal-close" onClick={onClose}>✕</button>
        </div>
        <input
          ref={inputRef}
          className="coauthor-modal-input"
          placeholder="username ou nome"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
        <div className="coauthor-modal-result">
          {results === null && <span className="coauthor-result-hint">Digite o username ou nome do co-autor</span>}
          {results === "loading" && <span className="coauthor-result-hint">Buscando...</span>}
          {results === "not_found" && <span className="coauthor-result-notfound">Nenhum autor encontrado</span>}
          {results === "self" && <span className="coauthor-result-notfound">Você já é o autor</span>}
          {results === "already_added" && <span className="coauthor-result-notfound">Co-autor já adicionado</span>}

          {!isSpecialState && Array.isArray(results) && (
            <div className="coauthor-result-list">
              {results.map(user => {
                const isAdm = user.type === "adm" || user.type === "adm+";
                return (
                  <div key={user.username} className="coauthor-result-found">
                    {user.avatar
                      ? <img src={user.avatar} className="coauthor-result-avatar" alt={user.name} />
                      : <div className="coauthor-result-avatar-placeholder">{user.name[0].toUpperCase()}</div>
                    }
                    <div className="coauthor-result-info">
                      <span className="coauthor-result-name">{user.name}</span>
                      <span className="coauthor-result-username">{user.username}</span>
                    </div>
                    <button
                      className={`coauthor-result-add-btn${!isAdm ? " coauthor-result-add-btn--disabled" : ""}`}
                      onClick={() => isAdm && !adding && handleAdd(user)}
                      disabled={adding || !isAdm}
                      title={!isAdm ? "Apenas admins podem ser co-autores" : "Adicionar"}
                    >
                      {adding ? "..." : "Adicionar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Write() {
  const navigate = useNavigate();
  const { id } = useParams();
  const session = getSession();

  const [type, setType] = useState(TYPES[0]);
  const [theme, setTheme] = useState(null);
  const [themeOverflowOpen, setThemeOverflowOpen] = useState(false);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [sources, setSources] = useState([{ label: "", url: "" }]);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [activeFormats, setActiveFormats] = useState({ b: false, i: false, u: false });
  const [activeAlign, setActiveAlign] = useState("Left");

  // Edições
  const [editions, setEditions] = useState([]);
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [editionDropdownOpen, setEditionDropdownOpen] = useState(false);
  const [editionLoading, setEditionLoading] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState(null);

  // Co-autoria
  const [coauthors, setCoauthors] = useState([]);
  const [coauthorModalOpen, setCoauthorModalOpen] = useState(false);

  // Autoria anônima — apenas adm+ pode usar
  const [anonymous, setAnonymous] = useState(false);
  const isAdmPlus = session?.type === "adm+";

  const bodyRef = useRef(null);
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const editionDropdownRef = useRef(null);
  const themeOverflowRef = useRef(null);

  useEffect(() => {
    if (!session || (session.type !== "adm" && session.type !== "adm+")) { navigate("/"); return; }
    getEditions().then(eds => {
      setEditions(eds);
      if (eds.length > 0 && !id) setSelectedEdition(eds[0]);
    });
    if (id) {
      getArticleById(id).then(a => {
        if (a) {
          setType(a.type);
          setTheme(a.theme || null);
          setHeadline(a.headline);
          setBody(a.body);
          setCoverImage(a.cover_image || "");
          setCoverPreview(a.cover_image || "");
          setSources(a.sources?.length ? a.sources : [{ label: "", url: "" }]);
          setCoauthors(a.coauthors || []);
          // Detecta se o artigo já era anônimo
          if (a.author === "anonymous") setAnonymous(true);
          if (bodyRef.current) bodyRef.current.innerHTML = a.body;
          if (a.edition_id) {
            getEditions().then(eds => {
              const ed = eds.find(e => e.id === a.edition_id);
              if (ed) setSelectedEdition(ed);
            });
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (editionDropdownRef.current && !editionDropdownRef.current.contains(e.target))
        setEditionDropdownOpen(false);
      if (themeOverflowRef.current && !themeOverflowRef.current.contains(e.target))
        setThemeOverflowOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCreateEdition() {
    setEditionLoading(true);
    const ed = await createEdition();
    if (ed) {
      const updated = await getEditions();
      setEditions(updated);
      setSelectedEdition(ed);
    }
    setEditionLoading(false);
    setEditionDropdownOpen(false);
  }

  async function handleDeleteEdition(e, edId) {
    e.stopPropagation();
    if (deleteWarning === edId) {
      const result = await deleteEdition(edId);
      if (result.ok) {
        const updated = await getEditions();
        setEditions(updated);
        if (selectedEdition?.id === edId)
          setSelectedEdition(updated.length > 0 ? updated[0] : null);
      }
      setDeleteWarning(null);
    } else {
      setDeleteWarning(edId);
    }
    setTimeout(() => setDeleteWarning(v => v === edId ? null : v), 3000);
  }

  function handleBodyChange() { setBody(bodyRef.current.innerHTML); }

  // Tab = recuo de parágrafo; Shift+Tab = remove o recuo
  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      bodyRef.current.focus();
      toggleParagraphIndent(bodyRef.current, e.shiftKey);
      setBody(bodyRef.current.innerHTML);
    }
  }

  function updateActiveFormats() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (sel.isCollapsed) {
      setActiveFormats({
        b: document.queryCommandState("bold"),
        i: document.queryCommandState("italic"),
        u: document.queryCommandState("underline"),
      });
      return;
    }
    let node = sel.anchorNode;
    const active = { b: false, i: false, u: false };
    while (node && node !== bodyRef.current) {
      const name = node.nodeName?.toLowerCase();
      if (name === "b" || name === "strong") active.b = true;
      if (name === "i" || name === "em") active.i = true;
      if (name === "u") active.u = true;
      node = node.parentNode;
    }
    setActiveFormats(active);
  }

  function handleFormat(e, tag) {
    e.preventDefault();
    bodyRef.current.focus();
    applyFormat(tag);
    setBody(bodyRef.current.innerHTML);
    setTimeout(updateActiveFormats, 0);
  }

  function handleAlign(e, dir) {
    e.preventDefault();
    bodyRef.current.focus();
    document.execCommand("justify" + dir, false, null);
    setBody(bodyRef.current.innerHTML);
    setActiveAlign(dir);
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    setBody(bodyRef.current.innerHTML);
  }

  async function handleCoverChange(e) {
    const file = e.target.files[0]; if (!file) return;
    const base64 = await fileToBase64(file);
    setCoverImage(base64); setCoverPreview(base64);
  }

  async function handleInlineImage(e) {
    const file = e.target.files[0]; if (!file) return;
    const base64 = await fileToBase64(file);
    bodyRef.current.focus();
    document.execCommand("insertImage", false, base64);
    setBody(bodyRef.current.innerHTML);
    e.target.value = "";
  }

  function addSource() { setSources(s => [...s, { label: "", url: "" }]); }
  function removeSource(i) { setSources(s => s.filter((_, idx) => idx !== i)); }
  function updateSource(i, field, value) { setSources(s => s.map((src, idx) => idx === i ? { ...src, [field]: value } : src)); }

  function handleAddCoauthor(user) {
    setCoauthors(prev => [...prev, { id: user.id, name: user.name, username: user.username, avatar: user.avatar || "" }]);
  }

  function handleRemoveCoauthor(username) {
    setCoauthors(prev => prev.filter(ca => ca.username !== username));
  }

  function handleAnonymousToggle() {
    setAnonymous(v => !v);
  }

  async function handlePublish() {
    if (!headline.trim()) { setError("A manchete é obrigatória."); return; }
    if (!body.trim() || body === "<br>") { setError("O texto é obrigatório."); return; }
    if (!anonymous && session?.id == null) {
      setError("Sessão inválida. Faça login novamente e tente de novo.");
      return;
    }
    setPublishing(true);

    // Se anônimo, salva author como string "anonymous" e ignora co-autores.
    // Caso contrário, salva apenas a referência por id — nome/foto são
    // buscados na hora de exibir, então mudanças de perfil refletem sozinhas.
    const authorData = anonymous
      ? "anonymous"
      : { id: session.id };

    // Co-autores viram referências por id. Se algum não tiver id (formato
    // antigo carregado numa edição), preserva o objeto original como fallback.
    const coauthorRefs = coauthors.length > 0
      ? coauthors.map(c => (c.id != null ? { id: c.id } : c))
      : null;

    const data = {
      type,
      theme,
      headline: headline.trim(),
      body,
      coverImage,
      images: [],
      sources: sources.filter(s => s.url.trim()),
      author: authorData,
      coauthors: anonymous ? null : coauthorRefs,
      editionId: selectedEdition?.id || null,
    };
    if (id) await updateArticle(id, data);
    else await createArticle(data);
    setPublishing(false);
    navigate("/");
  }

  const visibleThemes = THEMES.slice(0, THEMES_VISIBLE);
  const overflowThemes = THEMES.slice(THEMES_VISIBLE);
  const isOverflowTheme = theme && overflowThemes.includes(theme);
  const maxReached = coauthors.length >= MAX_COAUTHORS;

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

      <main className="write-content">
        <div className="write-card">

          {/* Checkbox de autoria anônima — só aparece para adm+ */}
          {isAdmPlus && (
            <label className="anonymous-checkbox-label">
              <input
                type="checkbox"
                className="anonymous-checkbox"
                checked={anonymous}
                onChange={handleAnonymousToggle}
              />
              <span>Autoria Anônima</span>
            </label>
          )}

          {/* Título + dropdown de edição */}
          <div className="write-title-row">
            <h1 className="write-title">{id ? "Editar matéria" : "Nova matéria"}</h1>

            {editions.length > 0 || session?.type === "adm+" ? (
              <div className="edition-dropdown-wrap" ref={editionDropdownRef}>
                <button
                  className="edition-pill"
                  onClick={() => setEditionDropdownOpen(v => !v)}
                >
                  {selectedEdition ? `Edição ${selectedEdition.number}` : "Sem edição"}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4 }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {editionDropdownOpen && (
                  <div className="edition-dropdown">
                    {editions.map(ed => (
                      <div
                        key={ed.id}
                        className={`edition-option ${selectedEdition?.id === ed.id ? "active" : ""}`}
                        onClick={() => { setSelectedEdition(ed); setEditionDropdownOpen(false); setDeleteWarning(null); }}
                      >
                        <span>Edição {ed.number}</span>
                        {session?.type === "adm+" && (
                          <button
                            className={`edition-delete-btn ${deleteWarning === ed.id ? "warn" : ""}`}
                            onClick={e => handleDeleteEdition(e, ed.id)}
                            title={deleteWarning === ed.id ? "Clique novamente para confirmar" : "Apagar edição"}
                          >
                            {deleteWarning === ed.id ? "!" : "×"}
                          </button>
                        )}
                      </div>
                    ))}

                    {deleteWarning && (
                      <p className="edition-delete-warn">
                        Apague todas as matérias desta edição antes de removê-la.
                      </p>
                    )}

                    {session?.type === "adm+" && (
                      <button
                        className="edition-create-btn"
                        onClick={handleCreateEdition}
                        disabled={editionLoading}
                      >
                        {editionLoading ? "Criando..." : "+ Nova edição"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Co-autoria */}
          <CoauthorStack
            author={{ name: session?.name || "", username: session?.username || "", avatar: session?.avatar || "" }}
            coauthors={coauthors}
            onAddClick={() => setCoauthorModalOpen(true)}
            onRemove={handleRemoveCoauthor}
            maxReached={maxReached}
            anonymous={anonymous}
          />

          {/* Tipo */}
          <div className="write-field">
            <label>Tipo</label>
            <div className="type-options">
              {TYPES.map(t => (
                <button key={t} className={`type-btn ${type === t ? "active" : ""}`} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
          </div>

          {/* Tema */}
          <div className="write-field">
            <label>Tema <span className="optional">(opcional)</span></label>
            <div className="type-options" style={{ position: "relative" }}>
              {visibleThemes.map(t => (
                <button
                  key={t}
                  className={`type-btn ${theme === t ? "active" : ""}`}
                  onClick={() => setTheme(theme === t ? null : t)}
                >{t}</button>
              ))}

              {overflowThemes.length > 0 && (
                <div className="theme-overflow-wrap" ref={themeOverflowRef}>
                  <button
                    className={`type-btn theme-overflow-trigger ${isOverflowTheme ? "active" : ""}`}
                    onClick={() => setThemeOverflowOpen(v => !v)}
                    title="Mais temas"
                  >
                    {isOverflowTheme ? theme : "···"}
                  </button>
                  {themeOverflowOpen && (
                    <div className="theme-overflow-dropdown">
                      {overflowThemes.map(t => (
                        <button
                          key={t}
                          className={`theme-overflow-item ${theme === t ? "active" : ""}`}
                          onClick={() => { setTheme(theme === t ? null : t); setThemeOverflowOpen(false); }}
                        >{t}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Manchete */}
          <div className="write-field">
            <label>Manchete</label>
            <input type="text" placeholder="Título da matéria" value={headline} onChange={e => { setHeadline(e.target.value); setError(""); }} />
          </div>

          {/* Imagem de capa */}
          <div className="write-field">
            <label>Imagem de capa</label>
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverChange} />
            <button className="file-btn" onClick={() => coverInputRef.current.click()}>
              {coverPreview ? "Trocar imagem de capa" : "Escolher imagem de capa"}
            </button>
            {coverPreview && <img src={coverPreview} alt="capa" className="cover-preview" />}
          </div>

          {/* Texto */}
          <div className="write-field">
            <label>Texto</label>
            <div className="editor-toolbar">
              <button className={activeFormats.b ? "active" : ""} onMouseDown={e => handleFormat(e, "b")}><b>B</b></button>
              <button className={activeFormats.i ? "active" : ""} onMouseDown={e => handleFormat(e, "i")}><i>I</i></button>
              <button className={activeFormats.u ? "active" : ""} onMouseDown={e => handleFormat(e, "u")}><u>U</u></button>
              <span className="toolbar-sep" />
              <button onMouseDown={e => handleAlign(e, "Left")} className={activeAlign === "Left" ? "active" : ""} title="Alinhar à esquerda"><IconAlignLeft /></button>
              <button onMouseDown={e => handleAlign(e, "Center")} className={activeAlign === "Center" ? "active" : ""} title="Centralizar"><IconAlignCenter /></button>
              <button onMouseDown={e => handleAlign(e, "Right")} className={activeAlign === "Right" ? "active" : ""} title="Alinhar à direita"><IconAlignRight /></button>
              <button onMouseDown={e => handleAlign(e, "Full")} className={activeAlign === "Full" ? "active" : ""} title="Justificar"><IconAlignJustify /></button>
              <span className="toolbar-sep" />
              <button onMouseDown={e => { e.preventDefault(); inlineInputRef.current.click(); }}>🖼</button>
              <input ref={inlineInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInlineImage} />
            </div>
            <div
              ref={bodyRef}
              className="editor-body"
              contentEditable
              suppressContentEditableWarning
              onInput={handleBodyChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onKeyUp={updateActiveFormats}
              onMouseUp={updateActiveFormats}
              data-placeholder="Escreva sua matéria aqui..."
            />
          </div>

          {/* Fontes */}
          <div className="write-field">
            <label>Fontes <span className="optional">(opcional)</span></label>
            {sources.map((src, i) => (
              <div className="source-row" key={i}>
                <input type="text" placeholder="Nome da fonte" value={src.label} onChange={e => updateSource(i, "label", e.target.value)} />
                <input type="text" placeholder="https://..." value={src.url} onChange={e => updateSource(i, "url", e.target.value)} />
                {sources.length > 1 && <button className="remove-source" onClick={() => removeSource(i)}>✕</button>}
              </div>
            ))}
            <button className="add-source" onClick={addSource}>+ Adicionar fonte</button>
          </div>

          {error && <p className="write-error">{error}</p>}
          <button className="publish-btn" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publicando..." : id ? "Salvar alterações" : "Publicar"}
          </button>
        </div>
      </main>

      {coauthorModalOpen && (
        <CoauthorSearchModal
          onClose={() => setCoauthorModalOpen(false)}
          onAdd={handleAddCoauthor}
          existingUsernames={coauthors.map(ca => ca.username)}
          currentUsername={session?.username}
        />
      )}
    </div>
  );
}

export default Write;