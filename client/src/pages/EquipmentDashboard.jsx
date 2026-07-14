import ActivityDashboard from '../components/ActivityDashboard';

export default function EquipmentDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">Equipment Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Log daily tools/equipment checks by department and activity group</p>
      </div>
      <ActivityDashboard />
    </div>
  );
}
