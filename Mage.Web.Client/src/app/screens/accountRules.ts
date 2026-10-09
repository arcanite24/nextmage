/** The server's rule for new passwords (Session.passwordProblem), checked before asking it. */
export function checkPassword(password: string, minLength: number, userName: string): string | null {
  if (password.length < minLength) return `At least ${minLength} characters.`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least one letter and one digit.';
  if (userName && password === userName) return "Don't use your name as the password.";
  return null;
}
