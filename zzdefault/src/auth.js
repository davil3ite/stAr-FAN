// auth.js

import supabase from "./supabase.js";

const SESSION_KEY = "fannon_session";

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

async function hashPassword(password) {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function saveSession(user) {
  const { password: _, ...safeUser } = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
  return safeUser;
}

export function getSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
}

export function logout() {
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

export async function register({ name, username, email, password }) {
  const clean = sanitizeUsername(username);
  if (!isValidUsername(clean)) return { ok: false, error: "username_invalid" };
  const taken = await isUsernameTaken(clean);
  if (taken) return { ok: false, error: "username" };
  const emailTaken = await isEmailTaken(email);
  if (emailTaken) return { ok: false, error: "email" };
  const hashed = await hashPassword(password);
  let type = "user";
  if (ADM_PLUS_EMAILS.includes(email.toLowerCase())) type = "adm+";
  else if (ADM_EMAILS.includes(email.toLowerCase())) type = "adm";
  const { error } = await supabase.from("users").insert({
    name, username: clean, email: email.toLowerCase(),
    password: hashed, type, avatar: "", username_changed_at: null,
  });
  if (error) return { ok: false, error: "server" };
  return { ok: true };
}

export async function login({ email, password }) {
  const hashed = await hashPassword(password);
  const { data, error } = await supabase
    .from("users").select("*")
    .eq("email", email.toLowerCase())
    .eq("password", hashed)
    .single();
  if (error || !data) return { ok: false };
  return { ok: true, user: saveSession(data) };
}

export async function updateName(username, newName) {
  const { error } = await supabase.from("users").update({ name: newName }).eq("username", username);
  if (error) return { ok: false };
  const session = getSession();
  const updated = { ...session, name: newName };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return { ok: true, session: updated };
}

export async function updateEmail(username, newEmail, password) {
  const hashed = await hashPassword(password);
  const { data } = await supabase.from("users").select("password").eq("username", username).single();
  if (!data || data.password !== hashed) return { ok: false, error: "wrong_password" };
  const taken = await isEmailTaken(newEmail, getSession()?.email);
  if (taken) return { ok: false, error: "email_taken" };
  const { error } = await supabase.from("users").update({ email: newEmail.toLowerCase() }).eq("username", username);
  if (error) return { ok: false };
  const session = getSession();
  const updated = { ...session, email: newEmail.toLowerCase() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return { ok: true, session: updated };
}

export async function updatePassword(username, currentPassword, newPassword) {
  const hashed = await hashPassword(currentPassword);
  const { data } = await supabase.from("users").select("password").eq("username", username).single();
  if (!data || data.password !== hashed) return { ok: false, error: "wrong_password" };
  const newHashed = await hashPassword(newPassword);
  const { error } = await supabase.from("users").update({ password: newHashed }).eq("username", username);
  if (error) return { ok: false };
  return { ok: true };
}

export async function updateUsername(currentUsername, newUsername, password) {
  const clean = sanitizeUsername(newUsername);
  if (!isValidUsername(clean)) return { ok: false, error: "username_invalid" };
  const hashed = await hashPassword(password);
  const { data } = await supabase.from("users").select("password, username_changed_at").eq("username", currentUsername).single();
  if (!data || data.password !== hashed) return { ok: false, error: "wrong_password" };
  if (data.username_changed_at) {
    const diff = Date.now() - new Date(data.username_changed_at).getTime();
    if (diff < 86400000) return { ok: false, error: "cooldown" };
  }
  const taken = await isUsernameTaken(clean, currentUsername);
  if (taken) return { ok: false, error: "username_taken" };
  const { error } = await supabase.from("users").update({
    username: clean, username_changed_at: new Date().toISOString(),
  }).eq("username", currentUsername);
  if (error) return { ok: false };
  const session = getSession();
  const updated = { ...session, username: clean };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return { ok: true, session: updated };
}

// Agora recebe a URL da imagem (já enviada ao Storage), não mais o base64.
export async function updateAvatar(username, url) {
  const { error } = await supabase.from("users").update({ avatar: url }).eq("username", username);
  if (error) return { ok: false };
  const session = getSession();
  const updated = { ...session, avatar: url };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return { ok: true, session: updated };
}

export async function deleteAccount(username, password) {
  const hashed = await hashPassword(password);
  const { data } = await supabase.from("users").select("password").eq("username", username).single();
  if (!data || data.password !== hashed) return { ok: false, error: "wrong_password" };
  const { error } = await supabase.from("users").delete().eq("username", username);
  if (error) return { ok: false };
  localStorage.removeItem(SESSION_KEY);
  return { ok: true };
}