/**
 * Type validators and type guards for string enums
 * Used to safely convert database strings to typed literals
 */

// Gig status types
export const GigStatusValues = ['inquiry', 'hold', 'confirmed', 'completed', 'cancelled'] as const;
export type GigStatus = typeof GigStatusValues[number];

export function isGigStatus(value: unknown): value is GigStatus {
  return typeof value === 'string' && GigStatusValues.includes(value as any);
}

export function asGigStatus(value: unknown, fallback: GigStatus = 'inquiry'): GigStatus {
  return isGigStatus(value) ? value : fallback;
}

// Campaign status types
export const CampaignStatusValues = ['published', 'draft', 'scheduled', 'approved', 'failed'] as const;
export type CampaignStatus = typeof CampaignStatusValues[number];

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === 'string' && CampaignStatusValues.includes(value as any);
}

export function asCampaignStatus(value: unknown, fallback: CampaignStatus = 'draft'): CampaignStatus {
  return isCampaignStatus(value) ? value : fallback;
}

// Campaign platform types
export const CampaignPlatformValues = ['instagram', 'facebook', 'tiktok', 'pinterest'] as const;
export type CampaignPlatform = typeof CampaignPlatformValues[number];

export function isCampaignPlatform(value: unknown): value is CampaignPlatform {
  return typeof value === 'string' && CampaignPlatformValues.includes(value as any);
}

export function asCampaignPlatform(value: unknown, fallback: CampaignPlatform = 'instagram'): CampaignPlatform {
  return isCampaignPlatform(value) ? value : fallback;
}

// Ad platform types
export const AdPlatformValues = ['tiktok', 'meta', 'google'] as const;
export type AdPlatform = typeof AdPlatformValues[number];

export function isAdPlatform(value: unknown): value is AdPlatform {
  return typeof value === 'string' && AdPlatformValues.includes(value as any);
}

export function asAdPlatform(value: unknown, fallback: AdPlatform = 'meta'): AdPlatform {
  return isAdPlatform(value) ? value : fallback;
}

// Ad status types
export const AdStatusValues = ['draft', 'active', 'review', 'paused', 'ended'] as const;
export type AdStatus = typeof AdStatusValues[number];

export function isAdStatus(value: unknown): value is AdStatus {
  return typeof value === 'string' && AdStatusValues.includes(value as any);
}

export function asAdStatus(value: unknown, fallback: AdStatus = 'draft'): AdStatus {
  return isAdStatus(value) ? value : fallback;
}

// Client stage types
export const ClientStageValues = ['completed', 'lead', 'inquiry', 'quoted', 'booked', 'lost'] as const;
export type ClientStage = typeof ClientStageValues[number];

export function isClientStage(value: unknown): value is ClientStage {
  return typeof value === 'string' && ClientStageValues.includes(value as any);
}

export function asClientStage(value: unknown, fallback: ClientStage = 'lead'): ClientStage {
  return isClientStage(value) ? value : fallback;
}

// Gallery layout types
export const GalleryLayoutValues = ['story', 'mosaic', 'fine_art', 'film_strip', 'contact_sheet'] as const;
export type GalleryLayout = typeof GalleryLayoutValues[number];

export function isGalleryLayout(value: unknown): value is GalleryLayout {
  return typeof value === 'string' && GalleryLayoutValues.includes(value as any);
}

export function asGalleryLayout(value: unknown, fallback: GalleryLayout = 'mosaic'): GalleryLayout {
  return isGalleryLayout(value) ? value : fallback;
}

// Lesson status types
export const LessonStatusValues = ['in_progress', 'complete'] as const;
export type LessonStatus = typeof LessonStatusValues[number];

export function isLessonStatus(value: unknown): value is LessonStatus {
  return typeof value === 'string' && LessonStatusValues.includes(value as any);
}

export function asLessonStatus(value: unknown, fallback: LessonStatus = 'in_progress'): LessonStatus {
  return isLessonStatus(value) ? value : fallback;
}

// Onboarding step types
export const OnboardingStepValues = ['categories', 'location', 'pricing', 'goals', 'connect', 'complete'] as const;
export type OnboardingStep = typeof OnboardingStepValues[number];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && OnboardingStepValues.includes(value as any);
}

export function asOnboardingStep(value: unknown, fallback: OnboardingStep = 'categories'): OnboardingStep {
  return isOnboardingStep(value) ? value : fallback;
}

// File status types
export const FileStatusValues = ['pending', 'imported', 'failed'] as const;
export type FileStatus = typeof FileStatusValues[number];

export function isFileStatus(value: unknown): value is FileStatus {
  return typeof value === 'string' && FileStatusValues.includes(value as any);
}

export function asFileStatus(value: unknown, fallback: FileStatus = 'pending'): FileStatus {
  return isFileStatus(value) ? value : fallback;
}

// Contract status types
export const ContractStatusValues = ['void', 'draft', 'sent', 'accepted'] as const;
export type ContractStatus = typeof ContractStatusValues[number];

export function isContractStatus(value: unknown): value is ContractStatus {
  return typeof value === 'string' && ContractStatusValues.includes(value as any);
}

export function asContractStatus(value: unknown, fallback: ContractStatus = 'draft'): ContractStatus {
  return isContractStatus(value) ? value : fallback;
}

// Mailbox status types
export const MailboxStatusValues = ['disabled', 'connected', 'failing'] as const;
export type MailboxStatus = typeof MailboxStatusValues[number];

export function isMailboxStatus(value: unknown): value is MailboxStatus {
  return typeof value === 'string' && MailboxStatusValues.includes(value as any);
}

export function asMailboxStatus(value: unknown, fallback: MailboxStatus = 'disabled'): MailboxStatus {
  return isMailboxStatus(value) ? value : fallback;
}

// Client source types
export const ClientSourceValues = ['instagram', 'google', 'referral', 'other', 'repeat', 'website', 'wedding_wire'] as const;
export type ClientSource = typeof ClientSourceValues[number];

export function isClientSource(value: unknown): value is ClientSource {
  return typeof value === 'string' && ClientSourceValues.includes(value as any);
}

export function asClientSource(value: unknown, fallback: ClientSource = 'other'): ClientSource {
  return isClientSource(value) ? value : fallback;
}

// Message direction types
export const MessageDirectionValues = ['inbound', 'outbound'] as const;
export type MessageDirection = typeof MessageDirectionValues[number];

export function isMessageDirection(value: unknown): value is MessageDirection {
  return typeof value === 'string' && MessageDirectionValues.includes(value as any);
}

export function asMessageDirection(value: unknown, fallback: MessageDirection = 'inbound'): MessageDirection {
  return isMessageDirection(value) ? value : fallback;
}

// Campaign objective types
export const CampaignObjectiveValues = ['showcase_portfolio', 'book_more_shoots', 'fill_a_date', 'promote_a_package', 'seasonal_promo', 'referral_push'] as const;
export type CampaignObjective = typeof CampaignObjectiveValues[number];

export function isCampaignObjective(value: unknown): value is CampaignObjective {
  return typeof value === 'string' && CampaignObjectiveValues.includes(value as any);
}

export function asCampaignObjective(value: unknown, fallback: CampaignObjective = 'showcase_portfolio'): CampaignObjective {
  return isCampaignObjective(value) ? value : fallback;
}

// Import file status types
export const ImportFileStatusValues = ['pending', 'imported', 'failed'] as const;
export type ImportFileStatus = typeof ImportFileStatusValues[number];

export function isImportFileStatus(value: unknown): value is ImportFileStatus {
  return typeof value === 'string' && ImportFileStatusValues.includes(value as any);
}

export function asImportFileStatus(value: unknown, fallback: ImportFileStatus = 'pending'): ImportFileStatus {
  return isImportFileStatus(value) ? value : fallback;
}

// Label source types
export const LabelSourceValues = ['ai', 'manual'] as const;
export type LabelSource = typeof LabelSourceValues[number];

export function isLabelSource(value: unknown): value is LabelSource {
  return typeof value === 'string' && LabelSourceValues.includes(value as any);
}

export function asLabelSource(value: unknown, fallback: LabelSource = 'manual'): LabelSource {
  return isLabelSource(value) ? value : fallback;
}

// Approval status types
export const ApprovalStatusValues = ['approved', 'pending', 'rejected'] as const;
export type ApprovalStatus = typeof ApprovalStatusValues[number];

export function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return typeof value === 'string' && ApprovalStatusValues.includes(value as any);
}

export function asApprovalStatus(value: unknown, fallback: ApprovalStatus = 'pending'): ApprovalStatus {
  return isApprovalStatus(value) ? value : fallback;
}

// Staff role types
export const StaffRoleValues = ['owner', 'staff'] as const;
export type StaffRole = typeof StaffRoleValues[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && StaffRoleValues.includes(value as any);
}

export function asStaffRole(value: unknown, fallback: StaffRole = 'staff'): StaffRole {
  return isStaffRole(value) ? value : fallback;
}

// Platform link status types
export const PlatformLinkStatusValues = ['connected', 'expired', 'revoked', 'unlinked'] as const;
export type PlatformLinkStatus = typeof PlatformLinkStatusValues[number];

export function isPlatformLinkStatus(value: unknown): value is PlatformLinkStatus {
  return typeof value === 'string' && PlatformLinkStatusValues.includes(value as any);
}

export function asPlatformLinkStatus(value: unknown, fallback: PlatformLinkStatus = 'unlinked'): PlatformLinkStatus {
  return isPlatformLinkStatus(value) ? value : fallback;
}

// Campaign tag types (season)
export const CampaignTagValues = ['wedding_fair', 'engagement', 'new_year', 'valentines', 'spring', 'summer', 'autumn', 'christmas', 'evergreen', 'other'] as const;
export type CampaignTag = typeof CampaignTagValues[number];

export function isCampaignTag(value: unknown): value is CampaignTag {
  return typeof value === 'string' && CampaignTagValues.includes(value as any);
}

export function asCampaignTag(value: unknown, fallback: CampaignTag = 'other'): CampaignTag {
  return isCampaignTag(value) ? value : fallback;
}
