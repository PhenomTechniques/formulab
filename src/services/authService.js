import { sb } from '../lib/supabase.js';

export async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return subscription;
}

export async function signOut() {
  await sb.auth.signOut();
}

export async function signInWithPassword(email, password) {
  return await sb.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
  return await sb.auth.signUp({ email, password });
}

export async function resetPasswordForEmail(email, options) {
  return await sb.auth.resetPasswordForEmail(email, options);
}
