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
    // Debug logging
    console.log('createCampaign received data:', {
      keys: Object.keys(campaignData),
      photographyType: campaignData.photographyType,
      priority: campaignData.priority,
      channels: campaignData.channels,
      startDate: campaignData.startDate,
      endDate: campaignData.endDate,
      starts_on: campaignData.starts_on,
      ends_on: campaignData.ends_on,
    })

    // Validate required fields
    if (!campaignData.photographyType) {
      throw new Error('Photography type is required')
    }
    if (!campaignData.priority) {
      throw new Error('Priority is required')
    }
    if (!campaignData.channels || campaignData.channels.length === 0) {
      throw new Error('At least one channel must be selected')
    }

    // Check both possible date field names
    const startDate = campaignData.startDate || campaignData.starts_on
    const endDate = campaignData.endDate || campaignData.ends_on

    if (!startDate) {
      throw new Error(`Campaign start date is required (received: startDate=${campaignData.startDate}, starts_on=${campaignData.starts_on})`)
    }
    if (!endDate) {
      throw new Error(`Campaign end date is required (received: endDate=${campaignData.endDate}, ends_on=${campaignData.ends_on})`)
    }

    // Create campaign from the goal-led data
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert([
        {
          name: `${campaignData.photographyType} - ${campaignData.priority}`,
          objective: campaignData.priority,
          status: 'draft',
          brief: generateCampaignBrief({
            ...campaignData,
            startDate,
            endDate,
          }),
          platforms: campaignData.channels || [],
          audience: generateAudienceDescription(campaignData),
          starts_on: startDate,
          ends_on: endDate,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error creating campaign:', error)
      throw new Error(error.message || 'Failed to create campaign in database')
    }

    if (!campaign) {
      throw new Error('Campaign was created but no data returned')
    }

    return { success: true, campaignId: campaign.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error creating campaign:', message, error)
    throw new Error(`Failed to create campaign: ${message}`)
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


