'use server'

import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function createCampaign(campaignData: Record<string, any>) {
  const supabase = await createClient()
  const session = await requireUser()

  if (!session) {
    throw new Error('Not authenticated')
  }

  try {
    // Create campaign from the goal-led data
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert([
        {
          name: `${campaignData.photographyType} - ${campaignData.priority}`,
          objective: campaignData.priority,
          status: 'draft',
          brief: generateCampaignBrief(campaignData),
          platforms: campaignData.channels || [],
          audience: generateAudienceDescription(campaignData),
          starts_on: campaignData.startDate || null,
          ends_on: campaignData.endDate || null,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return { success: true, campaignId: campaign.id }
  } catch (error) {
    console.error('Error creating campaign:', error)
    throw new Error('Failed to create campaign')
  }
}

/**
 * Generate campaign brief from goal-led inputs
 */
function generateCampaignBrief(data: Record<string, any>): string {
  const timeline = data.startDate && data.endDate
    ? `Timeline: ${new Date(data.startDate).toLocaleDateString()} to ${new Date(data.endDate).toLocaleDateString()}`
    : ''

  return `
Campaign: ${data.photographyType}
Goal: ${data.priority}
Channels: ${data.channels?.join(', ') || 'TBD'}
${timeline}

Marketing Framework:
1. **Landing Page** - Position this work type and capture enquiries
2. **Email Sequence** - Nurture prospects with portfolio and testimonials
3. **Ad Creative** - Visual storytelling highlighting the work type
4. **Call to Action** - Clear path to consultation or booking

Target Audience: Clients seeking ${data.photographyType.toLowerCase()}

Success Metrics:
- Enquiry volume
- Conversion rate
- Cost per lead
- Average booking value
`.trim()
}

/**
 * Generate audience description based on photography type
 */
function generateAudienceDescription(data: Record<string, any>): string {
  const audienceMap: Record<string, string> = {
    weddings: 'Engaged couples, 25-45, interested in wedding photography',
    engagements: 'Recently engaged couples looking for engagement shoot photography',
    portraits: 'Professionals and families seeking portrait photography',
    families: 'Parents with children age 0-12 interested in family photos',
    newborns: 'New parents (up to 6 months postpartum)',
    headshots: 'Business professionals and executives',
    commercial: 'Business owners seeking commercial photography',
  }

  return (
    Object.entries(audienceMap).find(([key]) =>
      data.photographyType?.toLowerCase().includes(key)
    )?.[1] || `People interested in ${data.photographyType}`
  )
}


