import { z } from 'zod';

/**
 * Validation schemas for input sanitization and security
 *
 * These schemas ensure:
 * - Proper data types and formats
 * - Length constraints to prevent DoS attacks
 * - Safe character sets to prevent injection attacks
 * - File size and type restrictions
 */

// ============================================================================
// Briefing Form Validation
// ============================================================================

export const briefingEmailSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(100, 'Email must be less than 100 characters')
    .trim()
    .toLowerCase(),
  studioEmail: z
    .string()
    .email('Invalid studio email address')
    .max(100, 'Email must be less than 100 characters')
    .trim()
    .toLowerCase(),
});

export const questionnaireFieldSchema = z
  .string()
  .max(5000, 'Response must be less than 5000 characters')
  .trim()
  .optional();

export const questionnaireSchema = z.object({
  projectName: z
    .string()
    .min(1, 'Project name is required')
    .max(200, 'Project name must be less than 200 characters')
    .trim(),
  companyName: z
    .string()
    .max(200, 'Company name must be less than 200 characters')
    .trim()
    .optional(),
  industry: questionnaireFieldSchema,
  projectGoals: questionnaireFieldSchema,
  targetAudience: questionnaireFieldSchema,
  competitors: questionnaireFieldSchema,
  brandPersonality: questionnaireFieldSchema,
  designPreferences: questionnaireFieldSchema,
  mustHaveElements: questionnaireFieldSchema,
  colorPreferences: questionnaireFieldSchema,
  inspirationLinks: questionnaireFieldSchema,
  timeline: questionnaireFieldSchema,
  budget: questionnaireFieldSchema,
  additionalInfo: questionnaireFieldSchema,
});

// ============================================================================
// File Upload Validation
// ============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;

export const imageFileSchema = z.object({
  size: z
    .number()
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE, 'File must be less than 10MB'),
  type: z.enum(ALLOWED_IMAGE_TYPES, {
    message: 'Only JPG, PNG, and WEBP images are allowed'
  }),
  name: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename must be less than 255 characters'),
});

// Helper to validate base64 image data
export const base64ImageSchema = z
  .string()
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, 'Invalid base64 image format')
  .refine(
    (data) => {
      // Check that the base64 data is reasonable size (< 20MB when encoded)
      const base64Length = data.split(',')[1]?.length || 0;
      const estimatedSize = (base64Length * 3) / 4; // Approximate decoded size
      return estimatedSize < 20 * 1024 * 1024;
    },
    { message: 'Image data is too large (max 20MB)' }
  );

// ============================================================================
// Tag Management Validation
// ============================================================================

export const tagValueSchema = z
  .string()
  .min(1, 'Tag cannot be empty')
  .max(50, 'Tag must be less than 50 characters')
  .regex(/^[a-z0-9-\s]+$/, 'Tag can only contain lowercase letters, numbers, hyphens, and spaces')
  .transform(val => val.trim().toLowerCase())
  .refine(val => val.length > 0, 'Tag cannot be empty after trimming');

// Dynamic category validation - accepts any valid category string
export const tagCategorySchema = z
  .string()
  .min(1, 'Category is required')
  .max(50, 'Category must be less than 50 characters')
  .regex(/^[a-z_]+$/, 'Category must be lowercase letters and underscores only');

export const tagDescriptionSchema = z
  .string()
  .max(500, 'Description must be less than 500 characters')
  .trim()
  .optional();

export const createTagSchema = z.object({
  category: tagCategorySchema,
  tag_value: tagValueSchema,
  description: tagDescriptionSchema,
  sort_order: z
    .number()
    .int('Sort order must be an integer')
    .nonnegative('Sort order must be non-negative')
    .optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateTagSchema = z.object({
  tag_value: tagValueSchema.optional(),
  description: tagDescriptionSchema,
  sort_order: z
    .number()
    .int('Sort order must be an integer')
    .nonnegative('Sort order must be non-negative')
    .optional(),
  is_active: z.boolean().optional(),
});

// ============================================================================
// Image Tagging Validation
// ============================================================================

export const notesSchema = z
  .string()
  .max(1000, 'Notes must be less than 1000 characters')
  .trim()
  .optional();

export const tagArraySchema = z
  .array(tagValueSchema)
  .max(100, 'Cannot have more than 100 tags in a category');

export const imageStatusSchema = z.enum(['pending', 'tagged', 'approved', 'skipped']);

// ============================================================================
// Vocabulary Config Validation
// ============================================================================

export const vocabularyCategorySchema = z.object({
  key: z
    .string()
    .regex(/^[a-z_]+$/, 'Category key must be lowercase letters and underscores only')
    .min(1, 'Category key is required')
    .max(50, 'Category key must be less than 50 characters'),
  label: z
    .string()
    .min(1, 'Category label is required')
    .max(100, 'Category label must be less than 100 characters'),
  storage_type: z.enum(['array', 'jsonb_array', 'text'], {
    message: 'Storage type must be array, jsonb_array, or text'
  }),
  storage_path: z
    .string()
    .min(1, 'Storage path is required')
    .max(100, 'Storage path must be less than 100 characters')
    .regex(/^[a-z_][a-z0-9_.]*$/, 'Storage path must start with a letter or underscore, and contain only lowercase letters, numbers, underscores, and dots'),
  search_weight: z
    .number()
    .min(0, 'Search weight must be at least 0')
    .max(10, 'Search weight must be at most 10'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  placeholder: z
    .string()
    .max(200, 'Placeholder must be less than 200 characters')
    .optional(),
  tags: z
    .array(
      z.string()
        .min(1, 'Tag cannot be empty')
        .max(50, 'Tag must be less than 50 characters')
        .transform(val => val.trim().toLowerCase())
    )
    .max(100, 'Cannot have more than 100 tags per category')
    .optional(),
});

export const vocabularyConfigSchema = z.object({
  config_name: z
    .string()
    .min(1, 'Config name is required')
    .max(255, 'Config name must be less than 255 characters')
    .trim(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  structure: z.object({
    categories: z
      .array(vocabularyCategorySchema)
      .min(1, 'At least one category is required')
      .max(20, 'Cannot have more than 20 categories')
      .refine(
        (categories) => {
          // Check for duplicate keys
          const keys = categories.map(c => c.key);
          return keys.length === new Set(keys).size;
        },
        { message: 'Category keys must be unique' }
      )
      .refine(
        (categories) => {
          // Check for duplicate storage paths
          const paths = categories.map(c => c.storage_path);
          return paths.length === new Set(paths).size;
        },
        { message: 'Storage paths must be unique' }
      ),
  }),
});

// ============================================================================
// AI Suggestion Validation
// ============================================================================

export const aiSuggestionsSchema = z.object({
  industries: tagArraySchema,
  projectTypes: tagArraySchema,
  styles: tagArraySchema,
  moods: tagArraySchema,
  elements: tagArraySchema,
  confidence: z.enum(['low', 'medium', 'high']),
  reasoning: z
    .string()
    .max(2000, 'Reasoning must be less than 2000 characters')
    .optional(),
});

// ============================================================================
// Search and Filter Validation
// ============================================================================

export const searchQuerySchema = z
  .string()
  .max(200, 'Search query must be less than 200 characters')
  .trim()
  .optional();

export const sortOrderSchema = z.enum(['newest', 'oldest', 'recently_updated']);

export const paginationSchema = z.object({
  limit: z
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(50),
  offset: z
    .number()
    .int('Offset must be an integer')
    .nonnegative('Offset must be non-negative')
    .default(0),
});

// ============================================================================
// Filename Sanitization
// ============================================================================

/**
 * Sanitizes a filename by replacing unsafe characters and limiting length
 * Returns a safe filename or generates a UUID-based one if input is invalid
 */
export function sanitizeFilename(filename: string, maxLength = 100): string {
  // Extract extension
  const lastDotIndex = filename.lastIndexOf('.');
  const extension = lastDotIndex > 0 ? filename.slice(lastDotIndex + 1) : '';
  const nameWithoutExt = lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;

  // Validate extension is alphanumeric and reasonable length
  const safeExtension = /^[a-zA-Z0-9]{1,10}$/.test(extension) ? extension : 'bin';

  // Remove unsafe characters from name
  let safeName = nameWithoutExt
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace unsafe chars with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .toLowerCase();

  // If name is empty or invalid, generate UUID
  if (!safeName || safeName.length === 0) {
    safeName = crypto.randomUUID();
  }

  // Limit length (reserve space for extension and dot)
  const maxNameLength = maxLength - safeExtension.length - 1;
  if (safeName.length > maxNameLength) {
    safeName = safeName.slice(0, maxNameLength);
  }

  return `${safeName}.${safeExtension}`;
}

/**
 * Generates a secure random filename with the given extension
 */
export function generateSecureFilename(extension: string): string {
  const safeExtension = extension.replace(/^\./, '').toLowerCase();

  // Validate extension
  if (!/^[a-zA-Z0-9]{1,10}$/.test(safeExtension)) {
    throw new Error('Invalid file extension');
  }

  return `${crypto.randomUUID()}.${safeExtension}`;
}

// ============================================================================
// Type Exports
// ============================================================================

export type BriefingEmailInput = z.infer<typeof briefingEmailSchema>;
export type QuestionnaireInput = z.infer<typeof questionnaireSchema>;
export type ImageFileInput = z.infer<typeof imageFileSchema>;
export type TagCategory = z.infer<typeof tagCategorySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type ImageStatus = z.infer<typeof imageStatusSchema>;
export type VocabularyConfigInput = z.infer<typeof vocabularyConfigSchema>;
export type VocabularyCategory = z.infer<typeof vocabularyCategorySchema>;
export type AISuggestionsInput = z.infer<typeof aiSuggestionsSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SortOrder = z.infer<typeof sortOrderSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
