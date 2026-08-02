import { describe, expect, it } from 'vitest';
import gatewayCatalog from '../../../specs/001-fundamental-analysis-platform/definitions/gateway-problem-details-catalog.json';
import localCatalog from '../../../specs/001-fundamental-analysis-platform/definitions/local-operation-issue-catalog.json';
import {
  getRecoveryIssue,
  getRecoveryOperation,
  listUnmappedRecoveryActions,
  parseRecoveryIssueDetail,
  recoveryIssues,
  repositoryCorruptionIssue,
} from '../../../src/app/recovery/recovery-actions';

describe('B19 recovery action map', () => {
  it('maps every active gateway and local recovery action to an accessible operation', () => {
    const authorityActions = new Set<string>();
    for (const issue of localCatalog.issues) {
      for (const action of issue.recoveryActions) authorityActions.add(action);
    }
    for (const issue of [...gatewayCatalog.variants, ...gatewayCatalog.resourceNotFoundVariants]) {
      for (const action of issue.recoveryActions) authorityActions.add(action);
    }

    expect(listUnmappedRecoveryActions()).toEqual([]);
    for (const actionId of authorityActions) {
      const operation = getRecoveryOperation(actionId);
      expect(operation.id).toBe(actionId);
      expect(operation.label.trim()).not.toBe('');
      expect(operation.routeLabel.trim()).not.toBe('');
      expect(operation.description.trim()).not.toBe('');
    }
  });

  it('preserves the exact blocked operations and capabilities from active authorities', () => {
    for (const authorityIssue of localCatalog.issues) {
      const issue = getRecoveryIssue(authorityIssue.code);
      expect(issue).toBeDefined();
      expect(issue?.blockedOperations).toEqual(authorityIssue.blockedOperations);
      expect(issue?.preservedCapabilities).toEqual(authorityIssue.preservedCapabilities);
      expect(issue?.recoveryActions).toEqual(authorityIssue.recoveryActions);
    }

    for (const authorityIssue of gatewayCatalog.variants) {
      const issue = getRecoveryIssue(authorityIssue.code);
      expect(issue).toBeDefined();
      expect(issue?.blockedOperations).toEqual(authorityIssue.blockedOperations);
      expect(issue?.preservedCapabilities).toEqual(authorityIssue.preservedCapabilities);
      expect(issue?.recoveryActions).toEqual(authorityIssue.recoveryActions);
    }
  });

  it('offers validated restore, integrity inspection and confirmed deletion for quarantined data', () => {
    expect(repositoryCorruptionIssue.pipelineState).toBe('partial');
    expect(repositoryCorruptionIssue.recoveryActions).toEqual([
      'check_integrity',
      'validate_restore',
      'delete_corrupt_data',
    ]);
    for (const actionId of repositoryCorruptionIssue.recoveryActions) {
      expect(getRecoveryOperation(actionId).routeLabel).toBe('Data management');
    }
  });

  it('accepts only known issue codes from UI events', () => {
    expect(parseRecoveryIssueDetail(null)).toBeUndefined();
    expect(parseRecoveryIssueDetail({})).toBeUndefined();
    expect(parseRecoveryIssueDetail({ code: 'unknown_issue' })).toBeUndefined();
    expect(parseRecoveryIssueDetail({ code: 'cancelled', message: 'Operation cancelled safely.' })).toMatchObject({
      code: 'cancelled',
      message: 'Operation cancelled safely.',
      source: 'local',
    });
    expect(recoveryIssues.length).toBe(
      localCatalog.issues.length + gatewayCatalog.variants.length + gatewayCatalog.resourceNotFoundVariants.length + 1,
    );
  });
});
