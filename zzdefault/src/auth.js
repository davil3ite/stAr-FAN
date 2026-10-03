// auth.js

import { createClient } from "@supabase/supabase-js";
import supabase from "./supabase.js";

const SESSION_KEY = "fannon_session_v2";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-assist`;
const API_KEY = import.meta.env.VITE_SUPABASE_KEY;

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

async function loadProfile(userId) {
  const { data } = await supabase
    .from("users")
    .select("id, name, username, email, type, avatar")
    .eq("id", userId)
    .single();
  return data || null;
}

async function callFunction(body, userToken = null) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": API_KEY,
  };
  if (userToken) headers["Authorization"] = `Bearer ${userToken}`;

  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return await res.json();
}

async function migrateLegacyPassword(email, password) {
  try {
    return await callFunction({ action: "migrate", email, password });
  } catch {
    return { ok: false, reason: "network" };
  }
}

async function verifyPassword(email, password) {
  const memStore = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = v; },
    removeItem(k) { delete this._d[k]; },
  };
  const temp = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    API_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storage: memStore } }
  );
  const { data, error } = await temp.auth.signInWithPassword({ email, password });
  return !error && !!data?.user;
}

async function currentToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
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

  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
  });
  if (signUpErr || !signUpData?.user) return { ok: false, error: "server" };

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

  let { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });

  if (error) {
    const mig = await migrateLegacyPassword(mail, password);
    if (mig.ok) {
      const retry = await supabase.auth.signInWithPassword({ email: mail, password });
      data = retry.data; error = retry.error;
    } else {
      return { ok: false };
    }
  }

  if (error || !data?.user) return { ok: false };

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

export async function updateEmail(username, newEmail, password) {
  const session = getSession();
  const mail = newEmail.toLowerCase();

  const taken = await isEmailTaken(mail, session?.email);
  if (taken) return { ok: false, error: "email_taken" };

  const token = await currentToken();
  if (!token) return { ok: false };

  const okPw = await verifyPassword(session.email, password);
  if (!okPw) return { ok: false, error: "wrong_password" };

  try {
    const result = await callFunction({ action: "change-email", newEmail: mail }, token);
    if (!result.ok) return { ok: false };
  } catch {
    return { ok: false };
  }

  const updated = { ...session, email: mail };
  saveSession(updated);
  return { ok: true, session: updated };
}

export async function updatePassword(username, currentPassword, newPassword) {
  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
  });
  if (error) {
    if (String(error.message).toLowerCase().includes("password")) {
      return { ok: false, error: "wrong_password" };
    }
    return { ok: false };
  }
  return { ok: true };
}

export async function updateUsername(currentUsername, newUsername, password) {
  const clean = sanitizeUsername(newUsername);
  if (!isValidUsername(clean)) return { ok: false, error: "username_invalid" };

  const session = getSession();
  const ok = await verifyPassword(session.email, password);
  if (!ok) return { ok: false, error: "wrong_password" };

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

export async function deleteAccount(username, password) {
  const session = getSession();

  const token = await currentToken();
  if (!token) return { ok: false };

  const ok = await verifyPassword(session.email, password);
  if (!ok) return { ok: false, error: "wrong_password" };

  try {
    const result = await callFunction({ action: "delete" }, token);
    if (!result.ok) return { ok: false };
  } catch {
    return { ok: false };
  }

  await supabase.auth.signOut();
  localStorage.removeItem(SESSION_KEY);
  return { ok: true };
}