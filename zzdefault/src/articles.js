// articles.js

import supabase from "./supabase.js";

// ── Edições ──────────────────────────────────────────────────────────────────

export async function getEditions() {
  const { data, error } = await supabase
    .from("editions")
    .select("*")
    .order("number", { ascending: false });
  if (error) return [];
  return data;
}

export async function getEditionById(id) {
  const { data, error } = await supabase
    .from("editions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function createEdition() {
  const { data: existing } = await supabase
    .from("editions")
    .select("number")
    .order("number", { ascending: false });

  const nums = new Set((existing || []).map(e => e.number));
  let next = 1;
  while (nums.has(next)) next++;

  const { data, error } = await supabase
    .from("editions")
    .insert({ number: next })
    .select()
    .single();
  if (error) return null;
  return data;
}

export async function deleteEdition(id) {
  const { data: articles } = await supabase
    .from("articles")
    .select("id")
    .eq("edition_id", id)
    .limit(1);
  if (articles && articles.length > 0) return { ok: false, reason: "has_articles" };
  const { error } = await supabase.from("editions").delete().eq("id", id);
  if (error) return { ok: false, reason: "server" };
  return { ok: true };
}

function isIdRef(obj) {
  return obj && typeof obj === "object" && obj.id !== undefined && obj.id !== null;
}

function collectIds(articles) {
  const ids = new Set();
  for (const a of articles) {
    if (isIdRef(a.author)) ids.add(a.author.id);
    if (Array.isArray(a.coauthors)) {
      for (const c of a.coauthors) {
        if (isIdRef(c)) ids.add(c.id);
      }
    }
  }
  return [...ids];
}

function resolveOne(ref, userMap) {
  if (isIdRef(ref)) {
    const u = userMap[ref.id];
    if (u) {
      return { id: u.id, name: u.name, username: u.username, avatar: u.avatar || "" };
    }
    return { id: ref.id, name: "Usuário removido", username: "", avatar: "" };
  }
  if (ref && typeof ref === "object") {
    return { name: ref.name, username: ref.username, avatar: ref.avatar || "" };
  }
  return { name: "", username: "", avatar: "" };
}

async function hydrateAuthors(articles) {
  const ids = collectIds(articles);

  let userMap = {};
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name, username, avatar")
      .in("id", ids);
    if (users) {
      for (const u of users) userMap[u.id] = u;
    }
  }

  return articles.map(a => {
    const author = a.author === "anonymous"
      ? "anonymous"
      : resolveOne(a.author, userMap);

    let coauthors = null;
    if (Array.isArray(a.coauthors) && a.coauthors.length > 0) {
      coauthors = a.coauthors.map(c => resolveOne(c, userMap));
    }

    return { ...a, author, coauthors };
  });
}

// ── Artigos ───────────────────────────────────────────────────────────────────

export async function getArticles() {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return await hydrateAuthors(data);
}

export async function getArticleById(id) {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  const [hydrated] = await hydrateAuthors([data]);
  return hydrated;
}

export async function createArticle({ type, theme, headline, body, coverImage, images, sources, author, coauthors, editionId }) {
  const { data, error } = await supabase.from("articles").insert({
    type,
    theme: theme || null,
    headline,
    body,
    cover_image: coverImage,
    sources,
    author,
    coauthors: coauthors || null,
    edition_id: editionId || null,
  }).select().single();
  if (error) return null;
  return data;
}

export async function updateArticle(id, fields) {
  const { data, error } = await supabase.from("articles").update({
    type: fields.type,
    theme: fields.theme || null,
    headline: fields.headline,
    body: fields.body,
    cover_image: fields.coverImage,
    sources: fields.sources,
    coauthors: fields.coauthors || null,
    edition_id: fields.editionId || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();
  if (error) return null;
  return data;
}

export async function deleteArticle(id) {
  await supabase.from("articles").delete().eq("id", id);
}

export function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} dia(s)`;
  return new Date(isoString).toLocaleDateString("pt-BR");
}