/**
 * Common numeric limits and boundaries used throughout the application
 */

// Rate limiting
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 100;
export const LOGIN_MAX_ATTEMPTS = 5;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_RESULTS = 100;
export const AUDIT_LOG_LIMIT = 10000;

// Entity limits
export const MAX_MANAGERS_PER_DRIVER = 5;
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Retry configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30000;

// Batch processing
export const BATCH_PROCESS_SIZE = 100;
export const BULK_INSERT_SIZE = 1000;

// Percentage calculations
export const PERCENTAGE_MULTIPLIER = 100;
