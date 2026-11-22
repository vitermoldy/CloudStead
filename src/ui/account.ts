// The sign-in screen and the account rows in the island panel. While the server runs,
// nobody uses the island without an account; when it cannot be reached the island
// still works and keeps its progress in this browser, as it did before accounts.
import { ApiError, checkAccount, cloudState, onCloud, signIn, signOut, signUp, type CloudState } from '../core/cloud';

interface Hooks {
  /** Puts the account's save in place of this browser's and reloads. */
  applySave(text: string, toastText: string): void;
  /** Writes the browser save now, which also sends it to the account. */
  saveNow(): void;
  /** Removes the island from this browser before the reload that follows signing out. */
  forget(): void;
  toast(text: string, ms?: number): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const joined = (iso: string): string => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export function mountAccount(hooks: Hooks): void {
  const gate = $<HTMLDialogElement>('auth-gate');
  const form = $<HTMLFormElement>('gate-form');
  const user = $<HTMLInputElement>('gate-user');
  const pass = $<HTMLInputElement>('gate-pass');
  const submit = $<HTMLButtonElement>('gate-submit');
  const error = $('gate-error');
  let mode: 'in' | 'up' = 'in';
  let busy = false;
  // "Pakai tanpa akun" holds until the page reloads or the visitor asks to sign in.
  let skipped = false;

  function setMode(next: 'in' | 'up'): void {
    mode = next;
    $('gate-h').textContent = next === 'in' ? 'Masuk ke CloudStead' : 'Buat akun CloudStead';
    submit.textContent = next === 'in' ? 'Masuk' : 'Buat akun';
    pass.autocomplete = next === 'in' ? 'current-password' : 'new-password';
    $('gate-pass-hint').hidden = next === 'in';
    $('gate-switch-text').textContent = next === 'in' ? 'Belum punya akun?' : 'Sudah punya akun?';
    $('gate-switch').textContent = next === 'in' ? 'Daftar' : 'Masuk';
    $('gate-lead').textContent =
      next === 'in'
        ? 'Pulaumu tersimpan di akunmu, jadi bisa dilanjutkan dari browser mana pun.'
        : 'Pulau yang sudah ada di browser ini ikut masuk ke akun barumu.';
    error.textContent = '';
    user.removeAttribute('aria-invalid');
    pass.removeAttribute('aria-invalid');
  }

  let shown: CloudState['auth'] | null = null;
  function render(state: CloudState = cloudState()): void {
    const offline = state.auth === 'unavailable';
    // The first check is not shown: a signed-in visitor should not see the screen flash by.
    const wanted = state.auth === 'signed-out' || (offline && !skipped) || (state.auth === 'checking' && gate.open);
    $('gate-checking').hidden = state.auth !== 'checking';
    form.hidden = state.auth !== 'signed-out';
    $('gate-switch-line').hidden = state.auth !== 'signed-out';
    $('gate-offline').hidden = !offline;
    $('gate-lead').hidden = state.auth !== 'signed-out';
    if (wanted && !gate.open) gate.showModal();
    else if (!wanted && gate.open) gate.close();
    // Focus moves only when what the screen asks for changes, never on every update.
    if (gate.open && shown !== state.auth) {
      if (state.auth === 'signed-out') user.focus();
      else if (offline) $('gate-retry').focus();
    }
    shown = gate.open ? state.auth : null;

    const signedIn = state.auth === 'signed-in' && state.account;
    $('account-in').hidden = !signedIn;
    $('account-out-of').hidden = Boolean(signedIn);
    if (signedIn) {
      $('account-name').textContent = state.account!.username;
      $('account-since').textContent = joined(state.account!.createdAt);
    }
  }

  async function finish(save: string | null, welcome: string): Promise<void> {
    if (save) {
      hooks.applySave(save, welcome);
      return;
    }
    hooks.saveNow();
    pass.value = '';
    hooks.toast(welcome);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    error.textContent = '';
    const name = user.value.trim();
    const password = pass.value;
    user.toggleAttribute('aria-invalid', !name);
    pass.toggleAttribute('aria-invalid', !password);
    if (!name || !password) {
      error.textContent = !name ? 'Isi username dulu.' : 'Isi kata sandi dulu.';
      (!name ? user : pass).focus();
      return;
    }
    busy = true;
    submit.disabled = true;
    submit.textContent = mode === 'in' ? 'Memeriksa…' : 'Membuat akun…';
    try {
      const save = mode === 'in' ? await signIn(name, password) : await signUp(name, password);
      await finish(save, mode === 'in' ? `Masuk sebagai ${cloudState().account?.username}.` : `Akun ${name} dibuat. Selamat datang.`);
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : 'Tidak bisa masuk. Coba lagi.';
      if (e instanceof ApiError && e.status === 401) pass.select();
      pass.setAttribute('aria-invalid', 'true');
    } finally {
      busy = false;
      submit.disabled = false;
      setModeLabelOnly();
    }
  });

  /** Restores the submit label without clearing the error the visitor still needs to read. */
  function setModeLabelOnly(): void {
    submit.textContent = mode === 'in' ? 'Masuk' : 'Buat akun';
  }

  $('gate-switch').addEventListener('click', () => {
    setMode(mode === 'in' ? 'up' : 'in');
    user.focus();
  });

  // A required sign-in has no "close": Escape does nothing while the server waits for
  // a password, and means "Pakai tanpa akun" when the server is down.
  gate.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (cloudState().auth === 'unavailable') skip();
  });

  function skip(): void {
    skipped = true;
