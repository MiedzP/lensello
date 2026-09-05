/**
 * Lensello Phase 2: Intelligence Engine UI Components
 * React component sketches for operating rhythm views and campaign builder
 */

import React, { useState } from 'react';
import {
  DailyView,
  WeeklyView,
  MonthlyView,
  QuarterlyView,
  PriorityScore,
  PriorityLevel,
  OperatingRhythmAlert,
  CampaignBuilderRequest,
  PhotographyCategory,
  CampaignPriority,
  CampaignTemplate,
} from './types';

// ============================================================================
// DAILY VIEW COMPONENT
// ============================================================================

/**
 * DailyViewComponent - Compact alerts and metrics for daily standup
 * Shows: alerts, new leads, unanswered enquiries, pipeline moves
 */
export const DailyViewComponent: React.FC<{ data: DailyView }> = ({ data }) => {
  return (
    <div className="daily-view-container">
      <h2>Daily Snapshot - {data.date.toLocaleDateString()}</h2>

      {/* Alerts Section */}
      <section className="alerts-section">
        <h3>Today's Alerts ({data.alerts.length})</h3>
        <div className="alerts-list">
          {data.alerts.slice(0, 5).map((alert: OperatingRhythmAlert) => (
            <div
              key={alert.id}
              className={`alert-card priority-${alert.priority}`}
              onClick={() => (window.location.href = alert.actionUrl || '#')}
            >
              <span className="alert-type">{alert.type}</span>
              <p>{alert.message}</p>
              <time>{new Date(alert.createdAt).toLocaleTimeString()}</time>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">New Leads</div>
          <div className="metric-value">{data.compactMetrics.leadsReceived}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Followed Up</div>
          <div className="metric-value">{data.compactMetrics.leadsFollowedUp}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Unanswered</div>
          <div className="metric-value">{data.compactMetrics.unansweredEnquiries}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Appointments</div>
          <div className="metric-value">{data.compactMetrics.appointmentsSet}</div>
        </div>
        <div className="metric-card highlight">
          <div className="metric-label">Pipeline Value</div>
          <div className="metric-value">${data.compactMetrics.pipelineValue.toLocaleString()}</div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="quick-actions">
        <button className="btn-primary">View All Leads</button>
        <button className="btn-secondary">Send Follow-ups</button>
        <button className="btn-secondary">Update Pipeline</button>
      </section>
    </div>
  );
};

// ============================================================================
// WEEKLY VIEW COMPONENT
// ============================================================================

/**
 * WeeklyViewComponent - 1-3 key priorities + metrics
 * Shows: Red fix / Amber grow / Green continue slots
 */
export const WeeklyViewComponent: React.FC<{ data: WeeklyView }> = ({ data }) => {
  return (
    <div className="weekly-view-container">
      <h2>Weekly Focus - Week of {data.weekStartDate.toLocaleDateString()}</h2>

      <p className="subtitle">Pick 1-3 priorities. Relentlessly focus on these.</p>

      {/* Priority Slots */}
      <div className="priority-slots">
        {/* Red Fix Slot */}
        <div className="priority-slot red-slot">
          <h3>🔴 Red Fix</h3>
          <p className="slot-subtitle">What's broken?</p>

          {data.priorities.find((p) => p.slot === 'red_fix') && (
            <PrioritySlotContent
              slot={data.priorities.find((p) => p.slot === 'red_fix')!}
            />
          )}
        </div>

        {/* Amber Grow Slot */}
        <div className="priority-slot amber-slot">
          <h3>🟠 Amber Grow</h3>
          <p className="slot-subtitle">What's the opportunity?</p>

          {data.priorities.find((p) => p.slot === 'amber_grow') && (
            <PrioritySlotContent
              slot={data.priorities.find((p) => p.slot === 'amber_grow')!}
            />
          )}
        </div>

        {/* Green Continue Slot */}
        <div className="priority-slot green-slot">
          <h3>🟢 Green Continue</h3>
          <p className="slot-subtitle">What's working? Scale it.</p>

          {data.priorities.find((p) => p.slot === 'green_continue') && (
            <PrioritySlotContent
              slot={data.priorities.find((p) => p.slot === 'green_continue')!}
            />
          )}
        </div>
      </div>

      {/* Weekly Metrics */}
      <section className="weekly-metrics">
        <h3>This Week's Results</h3>
        <div className="metrics-row">
          <div className="stat">
            <span className="label">Leads</span>
            <span className="value">{data.metrics.leadsGenerated}</span>
          </div>
          <div className="stat">
            <span className="label">Conversions</span>
            <span className="value">{data.metrics.enquiriesConverted}</span>
          </div>
          <div className="stat">
            <span className="label">Bookings</span>
            <span className="value">{data.metrics.bookingsCreated}</span>
          </div>
          <div className="stat highlight">
            <span className="label">Revenue</span>
            <span className="value">${data.metrics.totalValue.toLocaleString()}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

const PrioritySlotContent: React.FC<{ slot: any }> = ({ slot }) => (
  <div className="slot-content">
    <p className="focus">{slot.focus}</p>
    <p className="outcome">Expected: {slot.expectedOutcome}</p>
    <p className="duedate">Due: {slot.dueDate.toLocaleDateString()}</p>
    <button className="btn-small">See Action Plan</button>
  </div>
);

// ============================================================================
// MONTHLY VIEW COMPONENT (LENS FRAMEWORK)
// ============================================================================

/**
 * MonthlyViewComponent - Full LENS metrics breakdown
 * Shows: Leads, Enquiry quality, Nurture, Sales, SEO, CPL, ROAS
 */
export const MonthlyViewComponent: React.FC<{ data: MonthlyView }> = ({ data }) => {
  return (
    <div className="monthly-view-container">
      <h2>Monthly Analysis - {data.month}</h2>

      <p className="subtitle">LENS Framework: Leadership, Enquiry, Nurture, Sales</p>

      {/* LENS Dashboard Grid */}
      <div className="lens-grid">
        {/* L - LEADS */}
        <div className="lens-card leads">
          <h3>L - LEADS</h3>
          <div className="metric-large">{data.lens.leads.total}</div>
          <p className="metric-label">Total Enquiries</p>

          <div className="breakdown">
            <p>
              <span className="badge">New:</span> {data.lens.leads.new}
            </p>
            <p>
              <span className="badge">Followed Up:</span> {data.lens.leads.followedUp}
            </p>
            <p>
              <span className="badge">Response Time:</span> {data.lens.leads.responseTime}h
            </p>
          </div>

          <div className="lead-sources">
            <p>Sources:</p>
            <ul>
              <li>Website: {data.lens.leads.source.website}</li>
              <li>Social: {data.lens.leads.source.social}</li>
              <li>Organic: {data.lens.leads.source.organic}</li>
              <li>Paid: {data.lens.leads.source.paid}</li>
              <li>Referral: {data.lens.leads.source.referral}</li>
            </ul>
          </div>
        </div>

        {/* E - ENQUIRY */}
        <div className="lens-card enquiry">
          <h3>E - ENQUIRY QUALITY</h3>
          <ProgressBar value={data.lens.enquiry.avgQualityScore} max={100} />
          <p className="metric-label">Quality Score (0-100)</p>

          <div className="breakdown">
            <p>
              <span className="badge">Engagement:</span>{' '}
              {(data.lens.enquiry.engagementRate * 100).toFixed(0)}%
            </p>
            <p>
              <span className="badge">Response Time:</span>{' '}
              {data.lens.enquiry.averageTimeToResponse.toFixed(1)}h
            </p>
            <p>
              <span className="badge">Abandonment:</span>{' '}
              {(data.lens.enquiry.abandonmentRate * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* N - NURTURE */}
        <div className="lens-card nurture">
          <h3>N - NURTURE</h3>
          <div className="metric-large">{data.lens.nurture.leadsInSequence}</div>
          <p className="metric-label">Leads in Sequences</p>

          <div className="breakdown">
            <p>
              <span className="badge">Conversion Rate:</span>{' '}
              {(data.lens.nurture.conversionRate * 100).toFixed(1)}%
            </p>
            <p>
              <span className="badge">Avg Time in Nurture:</span>{' '}
              {data.lens.nurture.avgTimeInNurture} days
            </p>
          </div>

          <p className="note">Most effective at: {calculateMostEffectiveNurtureStage(data)}</p>
        </div>

        {/* S - SALES */}
        <div className="lens-card sales">
          <h3>S - SALES</h3>
          <div className="metric-large">${data.lens.sales.totalValue.toLocaleString()}</div>
          <p className="metric-label">Total Bookings Value</p>

          <div className="breakdown">
            <p>
              <span className="badge">Bookings:</span> {data.lens.sales.bookings}
            </p>
            <p>
              <span className="badge">Avg Value:</span> ${data.lens.sales.avgBookingValue.toLocaleString()}
            </p>
            <p>
              <span className="badge">Conversion:</span>{' '}
              {(data.lens.sales.conversionRateFromLeads * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="lens-card metrics-additional">
          <h3>KEY METRICS</h3>
          <div className="metric-pair">
            <span>Cost Per Lead</span>
            <span className="value">${data.lens.cpl.toFixed(2)}</span>
          </div>
          <div className="metric-pair">
            <span>ROAS (Return on Ad Spend)</span>
            <span className="value">{data.lens.roas.toFixed(1)}x</span>
          </div>
          <div className="metric-pair">
            <span>Organic Traffic</span>
            <span className="value">{data.lens.seoRanking.trafficFromOrganic}</span>
          </div>
        </div>

        {/* Top Keywords */}
        <div className="lens-card seo">
          <h3>SEO KEYWORDS</h3>
          <ul>
            {data.lens.seoRanking.topKeywords.slice(0, 5).map((kw, i) => (
              <li key={i}>
                <span className="keyword">{kw.keyword}</span>
                <span className="position">#{kw.position}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Performance vs Target */}
      <section className="performance-section">
        <h3>Performance vs Target</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Target</th>
              <th>Actual</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {data.performanceVsTarget.map((row, i) => (
              <tr key={i} className={row.variance >= 0 ? 'positive' : 'negative'}>
                <td>{row.metric}</td>
                <td>{row.target}</td>
                <td>{row.actual}</td>
                <td className="variance">{row.variance > 0 ? '+' : ''}{row.variance.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Bottleneck Narrative */}
      <section className="bottleneck-section">
        <h3>Key Insight</h3>
        <p className="bottleneck-text">{data.bottleneck}</p>
      </section>
    </div>
  );
};

const ProgressBar: React.FC<{ value: number; max: number }> = ({ value, max }) => (
  <div className="progress-bar">
    <div className="progress-fill" style={{ width: `${(value / max) * 100}%` }}></div>
  </div>
);

function calculateMostEffectiveNurtureStage(data: MonthlyView): string {
  // Find dropoff point with lowest loss
  if (!data.lens.nurture.dropoffPoints.length) return 'Unknown';
  return data.lens.nurture.dropoffPoints.reduce((prev, curr) =>
    curr.lossPercentage < prev.lossPercentage ? curr : prev,
  ).stage;
}

// ============================================================================
// QUARTERLY VIEW COMPONENT
// ============================================================================

/**
 * QuarterlyViewComponent - Strategic overview
 * Shows: Business vs goals, constraints, seasonal factors, next-quarter plan
 */
export const QuarterlyViewComponent: React.FC<{ data: QuarterlyView }> = ({ data }) => {
  return (
    <div className="quarterly-view-container">
      <h2>Quarterly Review - {data.quarter}</h2>

      {/* Business vs Goals */}
      <section className="goals-section">
        <h3>Business vs Goals</h3>
        <div className="goals-grid">
          {data.businessVsGoals.map((goal, i) => (
            <div key={i} className={`goal-card ${goal.onTrack ? 'on-track' : 'at-risk'}`}>
              <div className="goal-header">
                <h4>{goal.goal}</h4>
                <span className="status-badge">{goal.onTrack ? '✓ On Track' : '⚠ At Risk'}</span>
              </div>
              <div className="goal-progress">
                <ProgressBar value={goal.actual} max={goal.target} />
                <p>
                  {goal.actual} / {goal.target}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Constraints */}
      <section className="constraints-section">
        <h3>Business Constraints</h3>
        <ul className="constraints-list">
          {data.constraints.map((constraint, i) => (
            <li key={i} className="constraint-item">
              {constraint}
            </li>
          ))}
        </ul>
      </section>

      {/* Seasonal Considerations */}
      <section className="seasonal-section">
        <h3>Seasonal Factors</h3>
        <ul className="seasonal-list">
          {data.seasonalConsiderations.map((factor, i) => (
            <li key={i}>{factor}</li>
          ))}
        </ul>
      </section>

      {/* Next Quarter Plan */}
      <section className="next-quarter-section">
        <h3>Next Quarter Focus</h3>
        <div className="plan-card">
          <div className="plan-item">
            <h4>Strategic Focus</h4>
            <p>{data.nextQuarterPlan.focus}</p>
          </div>
          <div className="plan-item">
            <h4>Investment Areas</h4>
            <ul>
              {data.nextQuarterPlan.investmentAreas.map((area, i) => (
                <li key={i}>{area}</li>
              ))}
            </ul>
          </div>
          <div className="plan-item">
            <h4>Expected Outcome</h4>
            <p>{data.nextQuarterPlan.expectedOutcome}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// CAMPAIGN BUILDER COMPONENT (3-Step Wizard)
// ============================================================================

/**
 * CampaignBuilderWizard - Goal-led campaign creation
 * Step A: Category selection
 * Step B: Priority/outcome selection
 * Step C: Review & customize template
 */
export const CampaignBuilderWizard: React.FC<{
  onComplete: (campaign: CampaignBuilderRequest) => void;
}> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [request, setRequest] = useState<CampaignBuilderRequest>({
    stepA: { category: 'weddings' },
    stepB: { priority: CampaignPriority.WEDDINGS_MORE_ENQUIRIES },
  });

  const handleCategorySelect = (category: PhotographyCategory) => {
    setRequest({ ...request, stepA: { category } });
    setStep(2);
  };

  const handlePrioritySelect = (priority: CampaignPriority) => {
    setRequest({ ...request, stepB: { priority } });
    setStep(3);
  };

  return (
    <div className="campaign-builder-wizard">
      <div className="wizard-header">
        <h2>Build a Marketing Campaign</h2>
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <span>1</span>
            <label>What</label>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <span>2</span>
            <label>Why</label>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <span>3</span>
            <label>Build</label>
          </div>
        </div>
      </div>

      {step === 1 && (
        <StepACategory onSelect={handleCategorySelect} />
      )}

      {step === 2 && (
        <StepBPriority
          category={request.stepA.category}
          onSelect={handlePrioritySelect}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepCReview
          request={request}
          onComplete={onComplete}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
};

const StepACategory: React.FC<{
  onSelect: (category: PhotographyCategory) => void;
}> = ({ onSelect }) => (
  <div className="step-content step-a">
    <h3>What do you want more of?</h3>
    <p className="step-subtitle">Choose your primary photography category</p>

    <div className="category-grid">
      {(
        [
          'weddings',
          'engagements',
          'family',
          'newborns',
          'portraits',
          'pets',
          'boudoir',
          'headshots',
          'commercial',
          'schools',
          'sports',
          'events',
          'property',
          'albums_upsell',
        ] as PhotographyCategory[]
      ).map((cat) => (
        <button
          key={cat}
          className="category-btn"
          onClick={() => onSelect(cat)}
        >
          <span className="emoji">{getCategoryEmoji(cat)}</span>
          <span className="label">{formatCategoryName(cat)}</span>
        </button>
      ))}
    </div>
  </div>
);

const StepBPriority: React.FC<{
  category: PhotographyCategory;
  onSelect: (priority: CampaignPriority) => void;
  onBack: () => void;
}> = ({ category, onSelect, onBack }) => {
  const priorityOptions = getPriorityOptionsForCategory(category);

  return (
    <div className="step-content step-b">
      <h3>What's your priority?</h3>
      <p className="step-subtitle">What outcome matters most right now?</p>

      <div className="priority-options">
        {priorityOptions.map((option) => (
          <button
            key={option.value}
            className="priority-option"
            onClick={() => onSelect(option.value)}
          >
            <h4>{option.label}</h4>
            <p>{option.description}</p>
            <span className="cta">Select →</span>
          </button>
        ))}
      </div>

      <button className="btn-back" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
};

const StepCReview: React.FC<{
  request: CampaignBuilderRequest;
  onComplete: (campaign: CampaignBuilderRequest) => void;
  onBack: () => void;
}> = ({ request, onComplete, onBack }) => {
  const [budget, setBudget] = useState(1500);
  const [duration, setDuration] = useState(30);

  // In real implementation, fetch template here
  const template = getCampaignTemplatePreview(request.stepA.category, request.stepB.priority);

  return (
    <div className="step-content step-c">
      <h3>Almost there! Review your campaign</h3>

      <div className="template-preview">
        <h4>{template.name}</h4>
        <p>{template.description}</p>

        <div className="template-highlights">
          <div className="highlight">
            <span className="label">Expected CPL</span>
            <span className="value">${template.benchmarks.expectedCPL}</span>
          </div>
          <div className="highlight">
            <span className="label">Expected Conversion</span>
            <span className="value">{(template.benchmarks.expectedConversion * 100).toFixed(0)}%</span>
          </div>
          <div className="highlight">
            <span className="label">ROI Payback</span>
            <span className="value">{template.benchmarks.paybackPeriod} days</span>
          </div>
        </div>
      </div>

      <div className="customization-section">
        <label>
          Budget
          <input
            type="range"
            min="500"
            max="10000"
            step="100"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <span className="value">${budget}</span>
        </label>

        <label>
          Duration
          <input
            type="range"
            min="7"
            max="90"
            step="7"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
          <span className="value">{duration} days</span>
        </label>
      </div>

      <div className="step-actions">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn-primary"
          onClick={() =>
            onComplete({
              ...request,
              stepC: {
                template: template,
                customizations: { budget, duration },
              },
            })
          }
        >
          Build Campaign →
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCategoryEmoji(category: PhotographyCategory): string {
  const emojis: Record<PhotographyCategory, string> = {
    weddings: '💍',
    engagements: '💑',
    family: '👨‍👩‍👧‍👦',
    newborns: '👶',
    portraits: '🖼️',
    pets: '🐕',
    boudoir: '✨',
    headshots: '💼',
    commercial: '📸',
    schools: '🎓',
    sports: '⚽',
    events: '🎉',
    property: '🏠',
    albums_upsell: '📖',
  };
  return emojis[category] || '📷';
}

function formatCategoryName(category: PhotographyCategory): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPriorityOptionsForCategory(
  category: PhotographyCategory,
): Array<{ value: CampaignPriority; label: string; description: string }> {
  // In real implementation, this returns category-specific options
  // Placeholder for weddings
  if (category === 'weddings') {
    return [
      {
        value: CampaignPriority.WEDDINGS_MORE_ENQUIRIES,
        label: 'More Enquiries',
        description: 'Boost volume of wedding photographer inquiries',
      },
      {
        value: CampaignPriority.WEDDINGS_HIGHER_VALUE,
        label: 'Higher Value Bookings',
        description: 'Attract premium couples and upsell add-ons',
      },
    ];
  }
  return [];
}

function getCampaignTemplatePreview(
  category: PhotographyCategory,
  priority: CampaignPriority,
): Partial<CampaignTemplate> {
  // In real implementation, fetch from template library
  return {
    name: 'Campaign Name',
    description: 'Campaign description',
    benchmarks: {
      expectedCTR: 0.035,
      expectedConversion: 0.12,
      expectedCPL: 45,
      expectedBookingValue: 3500,
      paybackPeriod: 60,
    },
  };
}
