/**
 * Initialize Pre-Built Templates
 *
 * Script to load built-in templates into a photographer's account.
 * Run once per photographer during onboarding or via admin panel.
 */

import {
  createTimelineTemplate,
  addMilestone,
  addAction,
} from './timeline-engine';
import { BUILT_IN_TEMPLATES } from './types';

/**
 * Initialize all built-in templates for a photographer
 */
export async function initializeBuiltInTemplates(
  photographerId: string
): Promise<{ success: boolean; templates: Array<{ id: string; name: string }> }> {
  const results: Array<{ id: string; name: string }> = [];

  for (const [key, templateData] of Object.entries(BUILT_IN_TEMPLATES)) {
    try {
      // Create template
      const template = await createTimelineTemplate(photographerId, {
        slug: templateData.slug,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        duration_days: templateData.duration_days,
        timezone: 'UTC',
      });

      // Add milestones and actions
      for (const milestoneData of templateData.milestones) {
        const milestone = await addMilestone({
          template_id: template.id,
          position: milestoneData.day_number,
          title: milestoneData.title,
          description: milestoneData.description,
          day_number: milestoneData.day_number,
          day_calc_mode: milestoneData.day_calc_mode,
          repeat_every_days: milestoneData.repeat_every_days,
          repeat_end_day: milestoneData.repeat_end_day,
        });

        // Add actions to milestone
        for (let i = 0; i < milestoneData.actions.length; i++) {
          const actionData = milestoneData.actions[i];
          await addAction({
            milestone_id: milestone.id,
            action_type: actionData.action_type,
            priority_level: actionData.priority_level,
            title: actionData.title,
            description: actionData.description,
            template_content: actionData.template_content,
            template_variables: actionData.template_variables,
            action_config: actionData.action_config,
            position: i,
          });
        }
      }

      results.push({
        id: template.id,
        name: template.name,
      });

      console.log(`✓ Initialized template: ${template.name}`);
    } catch (error) {
      console.error(`✗ Failed to initialize ${templateData.name}:`, error);
    }
  }

  return {
    success: results.length === Object.keys(BUILT_IN_TEMPLATES).length,
    templates: results,
  };
}

/**
 * Initialize a single built-in template by slug
 */
export async function initializeTemplate(
  photographerId: string,
  slug: string
): Promise<{ id: string; name: string }> {
  const templateData = BUILT_IN_TEMPLATES[slug];

  if (!templateData) {
    throw new Error(`Template not found: ${slug}`);
  }

  // Create template
  const template = await createTimelineTemplate(photographerId, {
    slug: templateData.slug,
    name: templateData.name,
    description: templateData.description,
    category: templateData.category,
    duration_days: templateData.duration_days,
    timezone: 'UTC',
  });

  // Add milestones and actions
  for (const milestoneData of templateData.milestones) {
    const milestone = await addMilestone({
      template_id: template.id,
      position: milestoneData.day_number,
      title: milestoneData.title,
      description: milestoneData.description,
      day_number: milestoneData.day_number,
      day_calc_mode: milestoneData.day_calc_mode,
      repeat_every_days: milestoneData.repeat_every_days,
      repeat_end_day: milestoneData.repeat_end_day,
    });

    // Add actions to milestone
    for (let i = 0; i < milestoneData.actions.length; i++) {
      const actionData = milestoneData.actions[i];
      await addAction({
        milestone_id: milestone.id,
        action_type: actionData.action_type,
        priority_level: actionData.priority_level,
        title: actionData.title,
        description: actionData.description,
        template_content: actionData.template_content,
        template_variables: actionData.template_variables,
        action_config: actionData.action_config,
        position: i,
      });
    }
  }

  console.log(`✓ Initialized template: ${template.name}`);

  return {
    id: template.id,
    name: template.name,
  };
}
