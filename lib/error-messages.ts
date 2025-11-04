/**
 * Centralized error message system for user-friendly error handling
 *
 * Usage:
 * ```typescript
 * import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
 *
 * try {
 *   // ... operation
 * } catch (error) {
 *   alert(getErrorMessage(error, ErrorMessages.DATABASE_ERROR))
 * }
 * ```
 */

export const ErrorMessages = {
  // Database Errors
  DATABASE_ERROR: 'Database operation failed. Please try again or contact support if the issue persists.',
  DATABASE_CONNECTION_FAILED: 'Could not connect to the database. Please check your connection and try again.',

  // Vocabulary & Tag Management
  CATEGORY_DUPLICATE_KEY: 'This category key already exists. Please choose a unique key.',
  CATEGORY_DUPLICATE_PATH: 'This storage path is already in use by another category. Please use a unique path.',
  CATEGORY_INVALID_KEY: 'Invalid category key. Use only lowercase letters, numbers, and underscores.',
  CATEGORY_REQUIRED_FIELDS: 'Please fill in all required fields (key, label, storage path, and storage type).',
  CATEGORY_DELETE_FAILED: 'Failed to delete category. Make sure no tags are using this category.',

  TAG_DUPLICATE_VALUE: 'This tag already exists in this category. Please use a unique tag value.',
  TAG_MERGE_FAILED: 'Failed to merge tags. Please try again.',
  TAG_DELETE_FAILED: 'Failed to delete tag. This tag may be in use by reference images.',
  TAG_ADD_FAILED: 'Failed to add tag. Please check your input and try again.',
  TAG_UPDATE_FAILED: 'Failed to update tag. Please try again.',

  // Image Upload & Processing
  IMAGE_UPLOAD_FAILED: 'Failed to upload image. Please check the file and try again.',
  IMAGE_TOO_LARGE: 'Image file is too large. Please upload an image smaller than 10MB.',
  IMAGE_INVALID_FORMAT: 'Invalid image format. Please upload JPG, PNG, or WEBP files only.',
  IMAGE_DELETE_FAILED: 'Failed to delete image. Please try again.',
  IMAGE_UPDATE_FAILED: 'Failed to update image tags. Please try again.',
  IMAGE_FETCH_FAILED: 'Failed to load images. Please refresh the page.',

  // AI & Suggestions
  AI_SUGGESTION_FAILED: 'AI tag suggestion failed. You can still tag images manually.',
  AI_API_ERROR: 'Could not connect to AI service. Please check your API key configuration.',
  AI_RATE_LIMIT: 'Too many AI requests. Please wait a moment and try again.',

  // Vocabulary Config
  VOCAB_CONFIG_LOAD_FAILED: 'Failed to load vocabulary configuration. Please refresh the page.',
  VOCAB_CONFIG_SAVE_FAILED: 'Failed to save vocabulary configuration. Please try again.',
  VOCAB_CONFIG_INVALID_JSON: 'Invalid JSON format. Please check your configuration and try again.',
  VOCAB_CONFIG_VALIDATION_FAILED: 'Configuration validation failed. Please ensure all categories have required fields (key, label, storage_type, storage_path).',
  VOCAB_CONFIG_DUPLICATE_DETECTED: 'Duplicate category keys or storage paths detected. Each must be unique.',

  // Authentication & Authorization
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_UNAUTHORIZED: 'You do not have permission to perform this action.',
  AUTH_LOGIN_FAILED: 'Login failed. Please check your credentials and try again.',

  // Network & Generic
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  OPERATION_CANCELLED: 'Operation was cancelled.',

  // Validation
  VALIDATION_REQUIRED_FIELD: (field: string) => `${field} is required.`,
  VALIDATION_INVALID_FORMAT: (field: string) => `Invalid ${field} format.`,
  VALIDATION_TOO_LONG: (field: string, maxLength: number) => `${field} must be ${maxLength} characters or less.`,
  VALIDATION_TOO_SHORT: (field: string, minLength: number) => `${field} must be at least ${minLength} characters.`,

  // Bulk Operations
  BULK_OPERATION_FAILED: 'Bulk operation completed with some errors. Please check individual items.',
  BULK_DELETE_FAILED: 'Failed to delete selected items. Please try again.',
  BULK_UPDATE_FAILED: 'Failed to update selected items. Please try again.',

  // Dashboard & Admin
  DELETE_ALL_IMAGES_FAILED: 'Failed to delete all images. Some images may have been deleted.',
  RESET_VOCABULARY_FAILED: 'Failed to reset vocabulary to defaults. Please try again.',
  EXPORT_DATA_FAILED: 'Failed to export data. Please try again.',
  DUPLICATE_DETECTION_FAILED: 'Failed to scan for duplicates. Please try again.',
} as const

/**
 * PostgreSQL error codes mapped to user-friendly messages
 */
export const PostgresErrorCodes: Record<string, string> = {
  '23505': ErrorMessages.TAG_DUPLICATE_VALUE, // unique_violation
  '23503': 'This item cannot be deleted because it is referenced by other data.', // foreign_key_violation
  '23502': 'Required database field is missing.', // not_null_violation
  '42P01': 'Database table not found. Please contact support.', // undefined_table
  '42703': 'Database column not found. Please contact support.', // undefined_column
  '08006': ErrorMessages.DATABASE_CONNECTION_FAILED, // connection_failure
  '08001': ErrorMessages.DATABASE_CONNECTION_FAILED, // sqlclient_unable_to_establish_sqlconnection
}

/**
 * Get a user-friendly error message from an error object
 *
 * @param error - The error object (can be Error, PostgresError, or unknown)
 * @param fallbackMessage - Message to show if error cannot be parsed
 * @returns User-friendly error message
 */
export function getErrorMessage(
  error: unknown,
  fallbackMessage: string = ErrorMessages.UNKNOWN_ERROR
): string {
  if (!error) return fallbackMessage

  // Handle PostgresError (Supabase errors have a 'code' property)
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as any).code as string
    if (code in PostgresErrorCodes) {
      return PostgresErrorCodes[code]
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for network errors
    if (error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('fetch')) {
      return ErrorMessages.NETWORK_ERROR
    }

    // Check for authentication errors
    if (error.message.toLowerCase().includes('auth') ||
        error.message.toLowerCase().includes('unauthorized')) {
      return ErrorMessages.AUTH_UNAUTHORIZED
    }

    // Return the error message if it's meaningful
    if (error.message && error.message.length > 0 && error.message !== 'Unknown error') {
      return error.message
    }
  }

  // Handle string errors
  if (typeof error === 'string' && error.length > 0) {
    return error
  }

  return fallbackMessage
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch') ||
           error.message.toLowerCase().includes('connection')
  }
  return false
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('auth') ||
           error.message.toLowerCase().includes('unauthorized') ||
           error.message.toLowerCase().includes('session')
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as any).code
    return code === 'PGRST301' || code === 'PGRST302' // PostgREST auth errors
  }

  return false
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('validation') ||
           error.message.toLowerCase().includes('invalid') ||
           error.message.toLowerCase().includes('required')
  }
  return false
}

/**
 * Format an error for logging while showing user-friendly message
 *
 * @param error - The error object
 * @param context - Additional context about where the error occurred
 * @returns Object with userMessage and logMessage
 */
export function formatError(
  error: unknown,
  context?: string,
  fallbackMessage?: string
): { userMessage: string; logMessage: string } {
  const userMessage = getErrorMessage(error, fallbackMessage)

  let logMessage = context ? `[${context}] ` : ''

  if (error instanceof Error) {
    logMessage += `${error.name}: ${error.message}`
    if (error.stack) {
      logMessage += `\n${error.stack}`
    }
  } else if (typeof error === 'object' && error !== null) {
    logMessage += JSON.stringify(error, null, 2)
  } else {
    logMessage += String(error)
  }

  return { userMessage, logMessage }
}
