import { supabase } from './supabase';

export function generateAnonymousId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ANON-${year}-${random}`;
}

export function getStoredAnonymousId(): string | null {
  return localStorage.getItem('openview_anonymous_id');
}

export function setStoredAnonymousId(id: string): void {
  localStorage.setItem('openview_anonymous_id', id);
}

export function getOrCreateAnonymousId(): string {
  let id = getStoredAnonymousId();
  if (!id) {
    id = generateAnonymousId();
    setStoredAnonymousId(id);
  }
  return id;
}

export async function signUp(email: string, password: string, fullName: string) {
  // manda full_name para que el trigger lo copie a public.users
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}



export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
