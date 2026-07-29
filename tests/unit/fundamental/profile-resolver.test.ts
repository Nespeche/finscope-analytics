import { describe, expect, it } from 'vitest';
import {
  getProfileCapability,
  resolveAccountingProfile,
} from '../../../src/domain/fundamental/profile-resolver';

describe('accounting profile resolver', () => {
  it('selects the full US-GAAP operating profile and exact allowlists', () => {
    const result = resolveAccountingProfile({
      accountingStandard: 'us_gaap',
      entityType: 'operating_company',
    });
    expect(result).toMatchObject({
      supportState: 'supported',
      pipelineState: 'ready',
      profile: { profileId: 'general_operating_us_gaap', status: 'ACTIVE_FULL' },
    });
    expect(result.metrics.filter((metric) => metric.state === 'eligible')).toHaveLength(24);
    expect(getProfileCapability(result, 'concept', 'revenue')).toEqual({ id: 'revenue', state: 'eligible' });
  });

  it('keeps incompatible bank metrics not_applicable instead of forcing general ratios', () => {
    const result = resolveAccountingProfile({
      accountingStandard: 'us_gaap',
      entityType: 'financial_institution',
    });
    expect(result.profile.profileId).toBe('financial_institution_limited');
    expect(getProfileCapability(result, 'metric', 'FND_ROE')).toEqual({ id: 'FND_ROE', state: 'eligible' });
    expect(getProfileCapability(result, 'metric', 'FND_GROSS_MARGIN')).toEqual({
      id: 'FND_GROSS_MARGIN',
      state: 'not_applicable',
      reasonCode: 'profile_not_allowlisted',
    });
  });

  it('returns unsupported_profile as a normal partial local result', () => {
    const result = resolveAccountingProfile({
      accountingStandard: 'unknown',
      entityType: 'unknown',
    });
    expect(result).toMatchObject({
      supportState: 'unsupported',
      pipelineState: 'partial',
      profile: { profileId: 'unsupported_profile' },
    });
    expect(result.metrics).toHaveLength(24);
    expect(result.metrics.every((metric) =>
      metric.state === 'not_applicable' && metric.reasonCode === 'unsupported_profile')).toBe(true);
    expect(result.limitations).toContain('identity_filings_and_evidence_preserved');
  });
});
