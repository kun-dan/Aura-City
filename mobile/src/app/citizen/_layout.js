import { RoleTabs } from '../../components/RoleTabs';

export default function CitizenTabs() {
  return (
    <RoleTabs
      role="citizen"
      tabs={[
        { name: 'index', label: 'Map', sf: { default: 'map', selected: 'map.fill' }, md: 'map' },
        { name: 'report', label: 'Report', sf: { default: 'camera', selected: 'camera.fill' }, md: 'photo_camera' },
        { name: 'leaders', label: 'Leaders', sf: { default: 'trophy', selected: 'trophy.fill' }, md: 'emoji_events' },
        { name: 'spending', label: 'Spending', sf: 'indianrupeesign.circle', md: 'receipt_long' },
      ]}
    />
  );
}
