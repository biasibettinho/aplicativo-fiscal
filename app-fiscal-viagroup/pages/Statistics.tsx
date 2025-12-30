
import React, { useMemo } from 'react';
import { db } from '../services/db';
import { RequestStatus } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { TrendingUp, Users, CheckCircle, Clock } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];

const Statistics: React.FC = () => {
  const requests = db.getRequests();

  const stats = useMemo(() => {
    const totalValue = requests.reduce((acc, curr) => acc + (curr.budgetValue || 0), 0);
    const finalized = requests.filter(r => r.status === RequestStatus.FATURADO).length;
    
    // Status counts
    const statusData = Object.values(RequestStatus).map(status => ({
      name: status,
      value: requests.filter(r => r.status === status).length
    })).filter(d => d.value > 0);

    // Branch data
    const branchCounts: Record<string, number> = {};
    requests.forEach(r => {
      branchCounts[r.branch] = (branchCounts[r.branch] || 0) + 1;
    });
    const branchData = Object.entries(branchCounts).map(([name, value]) => ({ name, value }));

    return { totalValue, finalized, statusData, branchData };
  }, [requests]);

  const SummaryCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
      <div className={`${color} p-4 rounded-2xl text-white shadow-lg`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard title="Total em Notas" value={`R$ ${stats.totalValue.toLocaleString()}`} icon={TrendingUp} color="bg-blue-600" />
        <SummaryCard title="Solicitações" value={requests.length} icon={Users} color="bg-indigo-600" />
        <SummaryCard title="Pgtos Liquidados" value={stats.finalized} icon={CheckCircle} color="bg-green-600" />
        <SummaryCard title="Média Fluxo" value="2.4 dias" icon={Clock} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-black text-gray-900 mb-8 flex items-center">
            <div className="w-2 h-6 bg-blue-600 rounded-full mr-3"></div>
            Distribuição por Status
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                  cursor={{ fill: '#F9FAFB' }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-black text-gray-900 mb-8 flex items-center">
            <div className="w-2 h-6 bg-green-600 rounded-full mr-3"></div>
            Volume por Filial
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.branchData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.branchData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {stats.branchData.map((b, i) => (
              <div key={b.name} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase truncate">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
