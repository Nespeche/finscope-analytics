import type { FullConfig } from '@playwright/test';

const EXPECTED_TIMEZONE = 'UTC';
const EXPECTED_LOCALE = 'en-US';

export default function globalSetup(config: FullConfig): void {
  process.env.TZ = EXPECTED_TIMEZONE;
  process.env.LANG = 'en_US.UTF-8';
  process.env.LC_ALL = 'en_US.UTF-8';

  if (config.projects.length !== 2) {
    throw new Error(`Expected exactly two deterministic Playwright projects; received ${config.projects.length}.`);
  }

  for (const project of config.projects) {
    if (project.use.timezoneId !== EXPECTED_TIMEZONE) {
      throw new Error(`Project ${project.name} must use timezone ${EXPECTED_TIMEZONE}.`);
    }
    if (project.use.locale !== EXPECTED_LOCALE) {
      throw new Error(`Project ${project.name} must use locale ${EXPECTED_LOCALE}.`);
    }
  }
}
