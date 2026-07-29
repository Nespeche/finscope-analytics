PRAGMA foreign_keys = ON;

CREATE TABLE catalog_versions (
  catalog_id TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (
    length(content_sha256) = 64
    AND content_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  published_at TEXT NOT NULL,
  PRIMARY KEY (catalog_id, version)
) STRICT, WITHOUT ROWID;

CREATE INDEX catalog_versions_by_published_at
  ON catalog_versions (catalog_id, published_at DESC, version DESC);

CREATE TABLE active_catalog_pointers (
  catalog_id TEXT NOT NULL PRIMARY KEY,
  active_version TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  FOREIGN KEY (catalog_id, active_version)
    REFERENCES catalog_versions (catalog_id, version)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE INDEX active_catalog_pointers_by_version
  ON active_catalog_pointers (active_version, catalog_id);

CREATE TRIGGER catalog_versions_reject_update
BEFORE UPDATE ON catalog_versions
BEGIN
  SELECT RAISE(ABORT, 'catalog_versions are immutable');
END;

CREATE TRIGGER catalog_versions_reject_delete
BEFORE DELETE ON catalog_versions
BEGIN
  SELECT RAISE(ABORT, 'catalog_versions are immutable');
END;
