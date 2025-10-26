import { createServerClient } from '@/lib/supabase'

/**
 * Get the enhanced prompt setting from the database.
 *
 * This is the source of truth for whether to use enhanced prompts with
 * correction analysis. Falls back to environment variable if database
 * query fails.
 *
 * @returns {Promise<boolean>} True if enhanced prompts are enabled
 */
export async function getEnhancedPromptSetting(): Promise<boolean> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('user_settings')
      .select('setting_value')
      .eq('setting_key', 'use_enhanced_prompt')
      .single()

    if (error) {
      console.error('Error fetching enhanced prompt setting:', error)
      // Fallback to environment variable if database query fails
      return process.env.USE_ENHANCED_PROMPT === 'true'
    }

    return data.setting_value === 'true'
  } catch (error) {
    console.error('Error in getEnhancedPromptSetting:', error)
    // Fallback to environment variable
    return process.env.USE_ENHANCED_PROMPT === 'true'
  }
}
