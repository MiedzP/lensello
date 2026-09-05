/**
 * Lensello Phase 2: Intelligence Engine Database Schema
 * Supabase tables for priority rules, campaign templates, operating rhythm
 */

-- ============================================================================
-- PRIORITY SCORING TABLES
-- ============================================================================

CREATE TABLE priority_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  -- Red thresholds
  cpl_threshold_increase DECIMAL(5, 2) DEFAULT 15, -- % increase that triggers RED
  conversion_threshold_drop DECIMAL(5, 2) DEFAULT 20, -- % drop that triggers RED
  lead_followup_sla_hours INTEGER DEFAULT 24,
  bookings_target_threshold DECIMAL(3, 2) DEFAULT 0.80, -- Must achieve 80% of target
  campaign_performance_drop DECIMAL(5, 2) DEFAULT 25,
  funnel_conversion_minimum DECIMAL(5, 3) DEFAULT 0.050,
  -- Amber thresholds
  historic_leads_age_days INTEGER DEFAULT 30,
  historic_leads_unnurtured_percent DECIMAL(3, 2) DEFAULT 0.30,
  lead_quality_score_drop DECIMAL(5, 2) DEFAULT 15,
  ad_spend_efficiency_drop DECIMAL(5, 2) DEFAULT 10,
  -- Green thresholds
  seo_consistency_days INTEGER DEFAULT 14,
  cpl_improving_percent DECIMAL(5, 2) DEFAULT 5,
  conversion_healthy_minimum DECIMAL(5, 3) DEFAULT 0.150,
  nurture_target_conversion DECIMAL(5, 3) DEFAULT 0.200,
  booking_value_growth DECIMAL(5, 2) DEFAULT 10,
  campaign_roi_target DECIMAL(5, 2) DEFAULT 3,
  pipeline_days_cover INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE priority_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL, -- 'red', 'amber', 'green'
  score DECIMAL(5, 2) NOT NULL, -- 0-100
  indicators JSONB NOT NULL, -- array of indicator enum values
  recommended_actions JSONB NOT NULL, -- array of action strings
  confidence DECIMAL(3, 2) NOT NULL, -- 0-1
  metadata JSONB NOT NULL, -- cpl, conversionRate, leadFollowUpRate, etc
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  CREATE INDEX idx_priority_scores_business_category ON priority_scores(business_id, category),
  CREATE INDEX idx_priority_scores_level ON priority_scores(level)
);

-- ============================================================================
-- OPERATING RHYTHM TABLES
-- ============================================================================

CREATE TABLE operating_rhythm_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'new_lead', 'unanswered_enquiry', 'followup_due', 'pipeline_move', 'task_reminder'
  priority VARCHAR(20) NOT NULL, -- 'high', 'medium', 'low'
  message TEXT NOT NULL,
  action_url VARCHAR(500),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  CREATE INDEX idx_alerts_business_read ON operating_rhythm_alerts(business_id, read)
);

CREATE TABLE daily_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  view_date DATE NOT NULL,
  alerts_count INTEGER DEFAULT 0,
  leads_received INTEGER DEFAULT 0,
  leads_followed_up INTEGER DEFAULT 0,
  unanswered_enquiries INTEGER DEFAULT 0,
  appointments_set INTEGER DEFAULT 0,
  pipeline_value DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  UNIQUE(business_id, view_date)
);

CREATE TABLE weekly_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  -- Red fix slot
  red_fix_priority_id UUID,
  red_fix_focus TEXT,
  red_fix_expected_outcome TEXT,
  red_fix_due_date DATE,
  -- Amber grow slot
  amber_grow_priority_id UUID,
  amber_grow_focus TEXT,
  amber_grow_expected_outcome TEXT,
  amber_grow_due_date DATE,
  -- Green continue slot
  green_continue_priority_id UUID,
  green_continue_focus TEXT,
  green_continue_expected_outcome TEXT,
  green_continue_due_date DATE,
  -- Weekly metrics
  leads_generated INTEGER DEFAULT 0,
  enquiries_converted INTEGER DEFAULT 0,
  bookings_created INTEGER DEFAULT 0,
  total_value DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  UNIQUE(business_id, week_start_date)
);

CREATE TABLE monthly_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  -- LENS metrics snapshot
  lens_data JSONB NOT NULL,
  -- Performance vs target
  performance_vs_target JSONB NOT NULL, -- array of {metric, target, actual, variance}%
  top_performing_category VARCHAR(50),
  bottleneck_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  UNIQUE(business_id, month)
);

CREATE TABLE quarterly_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  quarter VARCHAR(10) NOT NULL, -- 'Q1-Q4 YYYY'
  business_vs_goals JSONB NOT NULL, -- array of {goal, target, actual, onTrack}
  constraints_list JSONB NOT NULL, -- array of constraint strings
  seasonal_considerations JSONB NOT NULL, -- array of strings
  next_quarter_plan JSONB NOT NULL, -- {focus, investmentAreas[], expectedOutcome}
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  UNIQUE(business_id, quarter)
);

-- ============================================================================
-- LENS METRICS TABLES (Time series)
-- ============================================================================

CREATE TABLE lens_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
  metric_date DATE NOT NULL,
  -- LENS scores
  leads_total INTEGER DEFAULT 0,
  leads_new INTEGER DEFAULT 0,
  leads_followed_up INTEGER DEFAULT 0,
  leads_response_time_hours DECIMAL(5, 2) DEFAULT 0,
  leads_source_website INTEGER DEFAULT 0,
  leads_source_social INTEGER DEFAULT 0,
  leads_source_referral INTEGER DEFAULT 0,
  leads_source_organic INTEGER DEFAULT 0,
  leads_source_paid INTEGER DEFAULT 0,
  enquiry_quality_score DECIMAL(5, 2) DEFAULT 0,
  enquiry_engagement_rate DECIMAL(5, 3) DEFAULT 0,
  enquiry_avg_time_to_response DECIMAL(5, 2) DEFAULT 0,
  enquiry_abandonment_rate DECIMAL(5, 3) DEFAULT 0,
  nurture_leads_in_sequence INTEGER DEFAULT 0,
  nurture_conversion_rate DECIMAL(5, 3) DEFAULT 0,
  nurture_avg_time_in_days INTEGER DEFAULT 0,
  sales_bookings INTEGER DEFAULT 0,
  sales_total_value DECIMAL(12, 2) DEFAULT 0,
  sales_avg_booking_value DECIMAL(10, 2) DEFAULT 0,
  sales_conversion_from_leads DECIMAL(5, 3) DEFAULT 0,
  cpl DECIMAL(10, 2) DEFAULT 0, -- cost per lead
  roas DECIMAL(5, 2) DEFAULT 0, -- return on ad spend
  seo_traffic_organic INTEGER DEFAULT 0,
  seo_keywords_json JSONB, -- {keyword, position, volume}[]
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  CREATE INDEX idx_lens_metrics_business_period ON lens_metrics(business_id, period, metric_date),
  CREATE INDEX idx_lens_metrics_category ON lens_metrics(category)
);

-- ============================================================================
-- CAMPAIGN TEMPLATE TABLES
-- ============================================================================

CREATE TABLE campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(100) NOT NULL, -- enum: weddings_more_enquiries, etc
  description TEXT NOT NULL,
  template_json JSONB NOT NULL, -- full CampaignTemplate structure
  benchmarks JSONB NOT NULL, -- {expectedCTR, expectedConversion, expectedCPL, etc}
  implementation_guide JSONB NOT NULL, -- {setup[], timeline[], ownerRole, dependencies[]}
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CREATE INDEX idx_templates_category_priority ON campaign_templates(category, priority)
);

CREATE TABLE generated_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  template_id UUID NOT NULL,
  step_a_category VARCHAR(50) NOT NULL,
  step_b_priority VARCHAR(100) NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  duration_days INTEGER NOT NULL,
  start_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'active', 'paused', 'completed'
  customizations JSONB NOT NULL, -- custom budget, duration, notes
  performance_data JSONB, -- {impressions, clicks, leads, conversions, spend}
  created_at TIMESTAMP DEFAULT NOW(),
  launched_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  FOREIGN KEY (template_id) REFERENCES campaign_templates(id),
  CREATE INDEX idx_campaigns_business_status ON generated_campaigns(business_id, status),
  CREATE INDEX idx_campaigns_created ON generated_campaigns(created_at DESC)
);

-- ============================================================================
-- BUSINESS GOALS & CONSTRAINTS (Phase 1 extension)
-- ============================================================================

CREATE TABLE business_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  metric VARCHAR(100) NOT NULL, -- 'bookings', 'enquiries', 'revenue', etc
  target_value INTEGER NOT NULL,
  period VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  CREATE INDEX idx_goals_business_category ON business_goals(business_id, category)
);

CREATE TABLE business_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  constraint_type VARCHAR(100) NOT NULL, -- 'max_daily_leads', 'seasonal_closure', 'budget_limit', 'team_capacity'
  constraint_value VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- ============================================================================
-- VIEW: Daily Priority Summary
-- ============================================================================

CREATE VIEW daily_priority_summary AS
SELECT
  ps.business_id,
  ps.category,
  ps.level,
  ps.score,
  COUNT(*) as active_alerts,
  MAX(ps.created_at) as last_updated
FROM priority_scores ps
LEFT JOIN operating_rhythm_alerts ora ON ps.business_id = ora.business_id
WHERE ps.expires_at > NOW()
  AND (ora.expires_at > NOW() OR ora.id IS NULL)
GROUP BY ps.business_id, ps.category, ps.level, ps.score, ps.created_at;

-- ============================================================================
-- INDEXES for query performance
-- ============================================================================

CREATE INDEX idx_priority_scores_expires ON priority_scores(expires_at);
CREATE INDEX idx_alerts_expires ON operating_rhythm_alerts(expires_at);
CREATE INDEX idx_lens_metrics_date ON lens_metrics(metric_date);

-- ============================================================================
-- ENABLE RLS (Row-Level Security) for Supabase
-- ============================================================================

ALTER TABLE priority_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_rhythm_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE lens_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_constraints ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own business data
CREATE POLICY "Users can view their own business priority rules"
  ON priority_rules FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can view their own priority scores"
  ON priority_scores FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can view their own alerts"
  ON operating_rhythm_alerts FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE auth_user_id = auth.uid()
  ));

-- Similar policies for all other tables...
