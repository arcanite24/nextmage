/**
 * The server's rule for new passwords (Session.passwordProblem), checked before asking it: what is wrong, if anything
 * (too short, no letter and digit mix, the player's name); the sign-in screen words it.
 */
export function checkPassword(password: string, minLength: number, userName: string): 'short' | 'mix' | 'name' | null {
  if (password.length < minLength) return 'short';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'mix';
  if (userName && password === userName) return 'name';
  return null;
}
