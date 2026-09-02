import type { ModuleRole } from '../../engine/provenance';
import type { CopyKey } from '../../copy';

const KEYS: Record<ModuleRole['kind'], CopyKey> = {
  finder: 'role.finder',
  separator: 'role.separator',
  timing: 'role.timing',
  alignment: 'role.alignment',
  darkModule: 'role.darkModule',
  format: 'role.format',
  version: 'role.version',
  data: 'role.data',
  ecc: 'role.ecc',
  remainder: 'role.remainder',
};

export function roleLabelKey(role: ModuleRole): CopyKey {
  return KEYS[role.kind];
}

export function roleKindKey(kind: ModuleRole['kind']): CopyKey {
  return KEYS[kind];
}
