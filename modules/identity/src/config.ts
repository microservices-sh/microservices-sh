// Tunables for the passwordless email-code + session flow. Conservative defaults;
// override per use-case call via deps.
export const LOGIN_CODE_DIGITS = 6;
export const LOGIN_CODE_TTL_SECONDS = 600; // 10 minutes
export const LOGIN_CODE_MAX_ATTEMPTS = 5; // wrong tries before the code is locked
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, rolling
