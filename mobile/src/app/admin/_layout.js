import { RoleTabs } from '../../components/RoleTabs';

export default function AdminTabs() {
  return (
    <RoleTabs
      role="admin"
      tabs={[
        { name: 'index', label: 'Dashboard', sf: { default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }, md: 'dashboard' },
        { name: 'audits', label: 'Audits', sf: { default: 'checkmark.shield', selected: 'checkmark.shield.fill' }, md: 'verified_user' },
        { name: 'map', label: 'Map', sf: { default: 'map', selected: 'map.fill' }, md: 'map' },
        { name: 'team', label: 'Team', sf: { default: 'person.3', selected: 'person.3.fill' }, md: 'group' },
        { name: 'ledger', label: 'Ledger', sf: 'indianrupeesign.circle', md: 'receipt_long' },
      ]}
    />
  );
}
