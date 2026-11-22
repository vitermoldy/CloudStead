// The sign-in screen and the account rows in the island panel. While the server runs,
// nobody uses the island without an account; when it cannot be reached the island
// still works and keeps its progress in this browser, as it did before accounts.
import { ApiError, checkAccount, cloudState, onCloud, signIn, signOut, signUp, type CloudState } from '../core/cloud';

