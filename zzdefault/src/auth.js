// auth.js

import supabase from "./supabase.js";

// Nome NOVO da sessão local — muda de "fannon_session" pra "fannon_session_v2".
// Efeito: todas as sessões antigas viram inválidas, forçando todo mundo a
// logar de novo pelo sistema novo (é o que a gente queria).
const SESSION_KEY = "fannon_session_v2";

// URL da Edge Function que migra senha e deleta conta.
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-assist`;

const ADM_EMAILS = [
  "flame.outtakes981@passfwd.com",
  "lorenzoalbuquerque29@gmail.com",
  "lorenaccarrijo@gmail.com",
  "lis.anandaca@gmail.com",
  "ryansilvacosta002@gmail.com",
  "janapbeuter@gmail.com",
  "anagrego82@gmail.com",
  "thiagomsilva2010@gmail.com",
  "pinheiroheitor22@gmail.com",
  "marialaurastarling416@gmail.com",
  "themostpro505@gmail.com",
  "isabellabartasson15@gmail.com",
  "bungeesky@yahoo.com",
  "zoriqbox@gmail.com",
  "loloccarrijo19@gmail.com",
  "augustoaraujosoares@gmail.com",
];

const ADM_PLUS_EMAILS = [
  "gasoline.sharply166@passfwd.com",
  "profdunniahamdan@gmail.com",
  "joaoalexandretp@gmail.com",
  "marcosfabiano536@gmail.com",
];

export function sanitizeUsername(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9\-._]/g, "");
}

export function isValidUsername(username) {
  return /^[a-z0-9\-._]+$/.test(username);
}

// Guarda o perfil (name, username, type, avatar, id, email) no localStorage
// pra interface usar. NÃO é a sessão de segurança — essa é a do Supabase Auth.
function saveSession(profile) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export function getSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem(SESSION_KEY);
}

export async function isUsernameTaken(username, excludeUsername = null) {
  const { data } = await supabase
    .from("users").select("username")
    .eq("username", username.toLowerCase())
    .neq("username", excludeUsername || "");
  return data && data.length > 0;
}

export async function isEmailTaken(email, excludeEmail = null) {
  const { data } = await supabase
    .from("users").select("email")
    .eq("email", email.toLowerCase())
    .neq("email", excludeEmail || "");
  return data && data.length > 0;
}

// Busca o perfil na tabela users pelo id do usuário logado no Auth
async function loadProfile(userId) {
  const { data } = await supabase
    .from("users")
    .select("id, name, username, email, type, avatar")
    .eq("id", userId)
    .single();
  return data || null;
}

// Chama a Edge Function pra migrar a senha de uma conta antiga
async function migrateLegacyPassword(email, password) {
  try {
    const res = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
      },
      body: JSON.stringify({ action: "migrate", email, password }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function register({ name, username, email, password }) {
  const clean = sanitizeUsername(username);
  if (!isValidUsername(clean)) return { ok: false, error: "username_invalid" };
  const taken = await isUsernameTaken(clean);
  if (taken) return { ok: false, error: "username" };
  const emailTaken = await isEmailTaken(email);
  if (emailTaken) return { ok: false, error: "email" };

  let type = "user";
  if (ADM_PLUS_EMAILS.includes(email.toLowerCase())) type = "adm+";
  else if (ADM_EMAILS.includes(email.toLowerCase())) type = "adm";

  // Cria a conta no Auth (login/senha)
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
  });
  if (signUpErr || !signUpData?.user) return { ok: false, error: "server" };

  // Cria a linha de perfil na tabela users, com o MESMO id do Auth
  const { error: insertErr } = await supabase.from("users").insert({
    id: signUpData.user.id,
    name, username: clean, email: email.toLowerCase(),
    type, avatar: "", username_changed_at: null,
  });
  if (insertErr) return { ok: false, error: "server" };

  return { ok: true };
}

export async function login({ email, password }) {
  const mail = email.toLowerCase();

  // 1) Tenta logar direto pelo Auth (contas novas ou já migradas)
  let { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });

  // 2) Falhou? Pode ser conta antiga sem senha no Auth. Tenta migrar.
  if (error) {
    const mig = await migrateLegacyPassword(mail, password);
    if (mig.ok) {
      // Migrou: tenta logar de novo com a mesma senha
      const retry = await supabase.auth.signInWithPassword({ email: mail, password });
      data = retry.data; error = retry.error;
    } else {
      // Não migrou: senha errada ou conta inexistente
      return { ok: false };
    }
  }

  if (error || !data?.user) return { ok: false };

  // 3) Logado — carrega o perfil da tabela users
  const profile = await loadProfile(data.user.id);
  if (!profile) return { ok: false };

  return { ok: true, user: saveSession(profile) };
}

export async function updateName(username, newName) {
  const { error } = await supabase.from("users").update({ name: newName }).eq("username", username);
  if (error) return { ok: false };
  const updated = { ...getSession(), name: newName };
  saveSession(updated);
  return { ok: true, session: updated };
}

// Troca de email: atualiza no Auth e na tabela users.
export async function updateEmail(username, newEmail, password) {
  // Confere a senha atual re-logando
  const session = getSession();
  const { error: pwErr } = await supabase.auth.signInWithPassword({
    email: session.email, password,
  });
  if (pwErr) return { ok: false, error: "wrong_password" };

  const taken = await isEmailTaken(newEmail, session?.email);
  if (taken) return { ok: false, error: "email_taken" };

  // Atualiza no Auth
  const { error: authErr } = await supabase.auth.updateUser({ email: newEmail.toLowerCase() });
  if (authErr) return { ok: false };

  // Atualiza na tabela users
  const { error } = await supabase.from("users").update({ email: newEmail.toLowerCase() }).eq("username", username);
  if (error) return { ok: false };

  const updated = { ...session, email: newEmail.toLowerCase() };
  saveSession(updated);
  return { ok: true, session: updated };
}

export async function updatePassword(username, currentPassword, newPassword) {
  const session = getSession();
  // Confere a senha atual re-logando
  const { error: pwErr } = await supabase.auth.signInWithPassword({
    email: session.email, password: currentPassword,
  });
  if (pwErr) return { ok: false, error: "wrong_password" };

  // Define a nova senha no Auth
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false };
  return { ok: true };
}

export async function updateUsername(currentUsername, newUsername, password) {
  const clean = sanitizeUsername(newUsername);
  if (!isValidUsername(clean)) return { ok: false, error: "username_invalid" };

  const session = getSession();
  // Confere a senha re-logando
  const { error: pwErr } = await supabase.auth.signInWithPassword({
    email: session.email, password,
  });
  if (pwErr) return { ok: false, error: "wrong_password" };

  // Checa cooldown de 24h
  const { data } = await supabase.from("users").select("username_changed_at").eq("username", currentUsername).single();
  if (data?.username_changed_at) {
    const diff = Date.now() - new Date(data.username_changed_at).getTime();
    if (diff < 86400000) return { ok: false, error: "cooldown" };
  }

  const taken = await isUsernameTaken(clean, currentUsername);
  if (taken) return { ok: false, error: "username_taken" };

  const { error } = await supabase.from("users").update({
    username: clean, username_changed_at: new Date().toISOString(),
  }).eq("username", currentUsername);
  if (error) return { ok: false };

  const updated = { ...session, username: clean };
  saveSession(updated);
  return { ok: true, session: updated };
}

export async function updateAvatar(username, url) {
  const { error } = await supabase.from("users").update({ avatar: url }).eq("username", username);
  if (error) return { ok: false };
  const updated = { ...getSession(), avatar: url };
  saveSession(updated);
  return { ok: true, session: updated };
}

// Deletar conta: confere a senha, chama a Edge Function (que apaga do Auth
// e da tabela users), e limpa a sessão local.
export async function deleteAccount(username, password) {
  const session = getSession();
  // Confere a senha re-logando (isso também garante um token válido)
  const { data: signIn, error: pwErr } = await supabase.auth.signInWithPassword({
    email: session.email, password,
  });
  if (pwErr || !signIn?.session) return { ok: false, error: "wrong_password" };

  const token = signIn.session.access_token;
  try {
    const res = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "delete" }),
    });
    const result = await res.json();
    if (!result.ok) return { ok: false };
  } catch {
    return { ok: false };
  }

  await supabase.auth.signOut();
  localStorage.removeItem(SESSION_KEY);
  return { ok: true };
}