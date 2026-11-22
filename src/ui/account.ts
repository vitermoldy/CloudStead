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
