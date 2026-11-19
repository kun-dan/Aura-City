import { RoleTabs } from '../../components/RoleTabs';

export default function ResolverTabs() {
  return (
    <RoleTabs
      role="resolver"
      tabs={[
        { name: 'index', label: 'My Jobs', sf: { default: 'hammer', selected: 'hammer.fill' }, md: 'construction' },
        { name: 'map', label: 'Map', sf: { default: 'map', selected: 'map.fill' }, md: 'map' },
        { name: 'ledger', label: 'Ledger', sf: 'indianrupeesign.circle', md: 'receipt_long' },
      ]}
    />
  );
}
