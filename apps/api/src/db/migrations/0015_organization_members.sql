-- Multiple admins per organization
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uid VARCHAR(128) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, uid)
);

-- Seed from existing owner_uid so current owners keep access
INSERT INTO organization_members (organization_id, uid, role)
SELECT id, owner_uid, 'owner' FROM organizations;

CREATE INDEX idx_org_members_uid ON organization_members(uid);
