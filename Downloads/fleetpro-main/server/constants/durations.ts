/**
 * Common time durations used throughout the application
 * All values are in milliseconds
 */

// Standard duration units
export const ONE_SECOND = 1000;
export const ONE_MINUTE = 60 * ONE_SECOND;
export const ONE_HOUR = 60 * ONE_MINUTE;
export const ONE_DAY = 24 * ONE_HOUR;
export const ONE_WEEK = 7 * ONE_DAY;

// Common time periods
export const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE;
export const THIRTY_MINUTES_MS = 30 * ONE_MINUTE;
export const ONE_HOUR_MS = ONE_HOUR;
export const SEVEN_DAYS_MS = 7 * ONE_DAY;
export const THIRTY_DAYS_MS = 30 * ONE_DAY;
export const NINETY_DAYS_MS = 90 * ONE_DAY;

// Session and auth durations
export const SESSION_TIMEOUT = THIRTY_MINUTES_MS;
export const JWT_EXPIRY = SEVEN_DAYS_MS;
export const REFRESH_TOKEN_EXPIRY = THIRTY_DAYS_MS;
export const PASSWORD_RESET_EXPIRY = ONE_HOUR_MS;
export const OTP_EXPIRY = 15 * ONE_MINUTE;

// Rate limiting windows
export const RATE_LIMIT_WINDOW = FIFTEEN_MINUTES_MS;
export const LOGIN_ATTEMPT_LOCKOUT_DURATION = FIFTEEN_MINUTES_MS;

// Cache durations
export const CACHE_TTL_SECONDS = 3600; // 1 hour
export const CACHE_TTL_LONG_SECONDS = 86400; // 1 day
