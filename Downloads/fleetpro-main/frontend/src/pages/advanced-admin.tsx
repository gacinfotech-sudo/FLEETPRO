import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { LogOut, LayoutDashboard, Users, BarChart3, Eye, Settings, FileText, Menu, X, Search, Filter, Download, TrendingUp, Clock, AlertCircle, CheckCircle, Bell, Plus, Lock, Trash2, Edit2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TabType = 'overview' | 'tenants' | 'users' | 'analytics' | 'monitoring' | 'audit' | 'settings';

const MENU_ITEMS = [
  { id: 'overview' as TabType, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenants' as TabType, label: 'Tenants', icon: Users },
  { id: 'users' as TabType, label: 'Users', icon: Shield },
  { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
  { id: 'monitoring' as TabType, label: 'Monitoring', icon: Eye },
  { id: 'audit' as TabType, label: 'Audit Logs', icon: FileText },
  { id: 'settings' as TabType, label: 'Settings', icon: Settings },
];

export default function AdvancedAdmin() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  // Fetch all tenants
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["/api/admin/tenants/search"],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:5050/api/admin/tenants/search?limit=100', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to fetch tenants');
        const data = await res.json();
        console.log('Tenants fetched:', data);
        return data.tenants || data || [];
      } catch (error) {
        console.error('Error fetching tenants:', error);
        return [];
      }
    },
    retry: 2,
  });

  // Auto-select first tenant
  useEffect(() => {
    if (tenants && tenants.length > 0 && !selectedTenant) {
      console.log('Auto-selecting first tenant:', tenants[0]);
      setSelectedTenant(tenants[0]);
    }
  }, [tenants]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "Error",
        description: "Logout failed",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-24'} bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white transition-all duration-300 flex flex-col shadow-2xl border-r border-slate-700`}>
        {/* Logo */}
        <div className="p-6 border-b border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold shadow-lg">
            🚗
          </div>
          {sidebarOpen && (
            <div>
              <p className="font-black text-xl bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">FleetPro</p>
              <p className="text-xs text-slate-400">Enterprise Admin</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="font-semibold text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 space-y-3 border-t border-slate-700">
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs">
            <p className="text-slate-400">Logged in as</p>
            {sidebarOpen && <p className="text-white font-semibold truncate">{user?.userId}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-red-600/20 hover:text-red-400 transition-all font-medium text-sm"
          >
            <LogOut size={18} />
            {sidebarOpen && 'Logout'}
          </button>
        </div>

        {/* Collapse Button */}
        <div className="p-4 border-t border-slate-700 flex justify-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 px-8 py-5 flex justify-between items-center shadow-xl">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
              {MENU_ITEMS.find(m => m.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">Welcome back, <span className="text-blue-400 font-semibold">{user?.userId}</span></p>
          </div>
          <div className="flex items-center gap-6">
            {/* Tenant Selector */}
            <select
              value={selectedTenant?.id || ''}
              onChange={(e) => {
                const tenant = tenants?.find((t: any) => t.id === parseInt(e.target.value));
                setSelectedTenant(tenant);
              }}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              disabled={isLoading || !tenants || tenants.length === 0}
            >
              <option value="">
                {isLoading ? '🔄 Loading tenants...' : !tenants || tenants.length === 0 ? 'No tenants' : 'Select Tenant...'}
              </option>
              {tenants && tenants.length > 0 && tenants.map((tenant: any) => (
                <option key={tenant.id} value={tenant.id}>
                  🏢 {tenant.name || 'Unknown'}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </button>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{user?.userId}</p>
              <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                <CheckCircle size={12} className="text-green-400" />
                {user?.role}
              </p>
            </div>
          </div>
        </header>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute top-20 right-8 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Bell size={16} className="text-blue-400" />
              Notifications
            </h3>
            <div className="space-y-2">
              {[
                { icon: '📈', msg: 'Revenue increased by 24%', time: '2 min ago' },
                { icon: '⚠️', msg: 'CPU usage at 78%', time: '5 min ago' },
                { icon: '✅', msg: 'Database backup completed', time: '1 hour ago' },
              ].map((notif, i) => (
                <div key={i} className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{notif.icon}</span>
                    <div>
                      <p className="text-slate-200">{notif.msg}</p>
                      <p className="text-xs text-slate-500 mt-1">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 p-8">
          {activeTab === 'overview' && <OverviewTab tenant={selectedTenant} />}
          {activeTab === 'tenants' && <TenantsTab />}
          {activeTab === 'users' && <UsersTab tenant={selectedTenant} />}
          {activeTab === 'analytics' && <AnalyticsTab tenant={selectedTenant} />}
          {activeTab === 'monitoring' && <MonitoringTab tenant={selectedTenant} />}
          {activeTab === 'audit' && <AuditTab tenant={selectedTenant} />}
          {activeTab === 'settings' && <SettingsTab tenant={selectedTenant} />}
        </main>
      </div>
    </div>
  );
}

function OverviewTab({ tenant }: { tenant?: any }) {
  const { data: stats = {} } = useQuery({
    queryKey: ["/api/admin/analytics/stats", tenant?.id],
    queryFn: async () => {
      try {
        const url = tenant
          ? `http://localhost:5050/api/admin/tenants/${tenant.id}/stats`
          : 'http://localhost:5050/api/admin/analytics/stats';
        const res = await fetch(url, { credentials: 'include' });
        return res.ok ? await res.json() : {};
      } catch {
        return {};
      }
    },
    retry: 1,
  });

  return (
    <div className="space-y-8">
      {/* Tenant Info Header */}
      {tenant && (
        <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 border border-blue-600/30 rounded-2xl p-6">
          <p className="text-sm text-blue-300 mb-1">📊 Currently Viewing Tenant:</p>
          <h2 className="text-2xl font-bold text-white">{tenant.name}</h2>
          <p className="text-sm text-blue-200 mt-2">Email: {tenant.email} • Plan: {tenant.plan || 'Professional'} • Users: {tenant.userCount || 0}</p>
        </div>
      )}

      {/* KPI Cards with Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Tenants', value: stats.totalTenants || 0, trend: '+12%', icon: '🏢', gradient: 'from-blue-600 to-blue-400', trendColor: 'text-green-400' },
          { label: 'Active Users', value: stats.activeUsers || 0, trend: '+8%', icon: '👥', gradient: 'from-green-600 to-green-400', trendColor: 'text-green-400' },
          { label: 'Monthly Revenue', value: `₹${(stats.monthlyRevenue || 0).toLocaleString()}`, trend: '+24%', icon: '💰', gradient: 'from-purple-600 to-purple-400', trendColor: 'text-green-400' },
          { label: 'Uptime', value: `${stats.uptime || 99}%`, trend: 'Excellent', icon: '⚡', gradient: 'from-orange-600 to-orange-400', trendColor: 'text-blue-400' },
        ].map((card, i) => (
          <div key={i} className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105`}>
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm opacity-90 font-medium">{card.label}</p>
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className="text-3xl font-black">{card.value}</p>
            <div className={`flex items-center gap-1 mt-3 text-xs font-bold ${card.trendColor}`}>
              <TrendingUp size={14} />
              {card.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-400" />
            Revenue Trend
          </h3>
          <div className="space-y-4">
            {[
              { month: 'Aug', value: 85, percent: 85 },
              { month: 'Sep', value: 92, percent: 92 },
              { month: 'Oct', value: 78, percent: 78 },
              { month: 'Nov', value: 95, percent: 95 },
            ].map((month, i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300 font-medium">{month.month}</span>
                  <span className="text-blue-400 font-bold">₹{month.value}K</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all" style={{ width: `${month.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6">Quick Stats</h3>
          <div className="space-y-4">
            {[
              { label: 'New Tenants', value: 12, icon: '📈', color: 'text-green-400' },
              { label: 'Active Sessions', value: 234, icon: '🔵', color: 'text-blue-400' },
              { label: 'Support Tickets', value: 5, icon: '🎫', color: 'text-orange-400' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{stat.icon}</span>
                  <p className="text-slate-300 text-sm font-medium">{stat.label}</p>
                </div>
                <p className={`font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Health & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-400" />
            System Health
          </h3>
          <div className="space-y-3">
            {[
              { label: 'API Server', status: '✅ Healthy', uptime: '99.9%' },
              { label: 'Database', status: '✅ Healthy', uptime: '100%' },
              { label: 'Cache Layer', status: '✅ Healthy', uptime: '99.8%' },
              { label: 'Email Service', status: '✅ Healthy', uptime: '99.2%' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
                <div>
                  <p className="text-white font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-1">Uptime: {item.uptime}</p>
                </div>
                <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6">Quick Actions</h3>
          <div className="space-y-3">
            {[
              { emoji: '👥', title: 'Manage Tenants', desc: 'View and manage tenants', color: 'from-blue-600/20 to-blue-500/20' },
              { emoji: '📊', title: 'View Analytics', desc: 'Performance metrics', color: 'from-green-600/20 to-green-500/20' },
              { emoji: '🔍', title: 'Monitor System', desc: 'System health check', color: 'from-purple-600/20 to-purple-500/20' },
            ].map((action, i) => (
              <button
                key={i}
                className={`w-full p-4 bg-gradient-to-r ${action.color} border border-slate-600 rounded-lg hover:border-slate-500 hover:shadow-lg transition-all text-left group`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl group-hover:scale-110 transition-transform">{action.emoji}</span>
                  <div>
                    <p className="text-white font-bold text-sm">{action.title}</p>
                    <p className="text-xs text-slate-400">{action.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const { data: tenants = [] } = useQuery({
    queryKey: ["/api/admin/tenants/search", search],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:5050/api/admin/tenants/search?limit=50&search=${search}`, { credentials: 'include' });
        const data = await res.json();
        return data.tenants || [];
      } catch {
        return [];
      }
    },
    retry: 1,
  });

  const getTenantColor = (index: number) => {
    const colors = [
      'from-blue-600 to-blue-400',
      'from-green-600 to-green-400',
      'from-purple-600 to-purple-400',
      'from-orange-600 to-orange-400',
      'from-pink-600 to-pink-400',
      'from-cyan-600 to-cyan-400',
    ];
    return colors[index % colors.length];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center md:justify-between">
        <div className="flex gap-3 flex-1">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Search tenants by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors hidden sm:block"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex gap-2 bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-2 rounded ${view === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              ⊞
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 rounded ${view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              ≡
            </button>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition-all font-semibold shadow-lg hover:shadow-xl whitespace-nowrap">
            + Add Tenant
          </button>
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.length > 0 ? (
            tenants.map((tenant: any, idx: number) => (
              <div
                key={tenant.id}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-xl hover:shadow-2xl transition-all hover:border-slate-600"
              >
                {/* Header with Amount */}
                <div className={`bg-gradient-to-br ${getTenantColor(idx)} p-6 relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                    </svg>
                  </div>
                  <div className="relative z-10">
                    <p className="text-3xl font-black text-white">₹{Math.floor(Math.random() * 50000) + 5000}</p>
                    <p className="text-sm text-white/80 mt-1">Per Month</p>
                  </div>
                </div>

                {/* Tenant Info */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{tenant.name || 'N/A'}</h3>
                      <p className="text-xs text-slate-400">{tenant.email || 'N/A'}</p>
                    </div>
                    <span className="inline-block px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-bold whitespace-nowrap">
                      🟢 Active
                    </span>
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-4 mb-6 pb-6 border-b border-slate-700">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Payment Status</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          Math.random() > 0.5
                            ? 'bg-green-500/20 text-green-300'
                            : Math.random() > 0.5
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {Math.random() > 0.5 ? '✓ Paid' : Math.random() > 0.5 ? '○ Pending' : '✕ Failed'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Payment Method</p>
                        <p className="text-sm text-white font-semibold">
                          {['Credit Card', 'UPI', 'Bank Transfer'][Math.floor(Math.random() * 3)]}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Next Billing</p>
                        <p className="text-sm text-white font-semibold">9/16/2026</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Last Payment</p>
                        <p className="text-sm text-white font-semibold">8/{Math.floor(Math.random() * 31) + 1}/2026</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300 font-medium">Auto-Renewal</span>
                      <div className="relative w-12 h-6 bg-green-600 rounded-full cursor-pointer">
                        <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md"></div>
                      </div>
                    </div>
                  </div>

                  {/* Subscription & Dates */}
                  <div className="space-y-3 mb-6 pb-6 border-b border-slate-700">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Plan Tier</p>
                        <p className="text-sm text-white font-bold">{tenant.plan || 'Professional'}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Created</p>
                        <p className="text-sm text-white font-bold">8/10/2026</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Expires</p>
                        <p className="text-sm text-white font-bold">9/10/2027</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Users</p>
                        <p className="text-sm text-blue-400 font-bold">{tenant.userCount || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Usage Metrics */}
                  <div className="space-y-3 mb-6 pb-6 border-b border-slate-700">
                    <p className="text-xs text-slate-500 uppercase font-bold">📊 Usage Metrics</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-400">API Calls</span>
                          <span className="text-xs text-slate-300 font-bold">8.2K / 10K</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400" style={{width: '82%'}}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-400">Storage</span>
                          <span className="text-xs text-slate-300 font-bold">45.6GB / 100GB</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{width: '45%'}}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-400">Webhooks</span>
                          <span className="text-xs text-slate-300 font-bold">5 / 20</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400" style={{width: '25%'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company Info */}
                  <div className="space-y-3 mb-6 pb-6 border-b border-slate-700">
                    <p className="text-xs text-slate-500 uppercase font-bold">🏢 Company Details</p>
                    <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Industry:</span>
                        <span className="text-white font-semibold">Technology</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Support Tier:</span>
                        <span className="text-blue-300 font-bold">Premium</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Contract Type:</span>
                        <span className="text-white">Annual</span>
                      </div>
                    </div>
                  </div>

                  {/* Login Credentials */}
                  <div className="mb-6 pb-6 border-b border-slate-700">
                    <p className="text-xs text-slate-500 mb-3 uppercase font-bold">🔐 Login Credentials</p>
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 space-y-3">
                      <div>
                        <p className="text-xs text-slate-400">Login ID</p>
                        <p className="text-sm text-white font-mono">admin_undefined</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Password</p>
                        <p className="text-sm text-white font-mono">••••••••••</p>
                      </div>
                      <p className="text-xs text-orange-400 font-semibold">⚠ First time - must change</p>
                      <p className="text-xs text-slate-400 leading-tight">
                        Share these credentials securely with tenant owner. Password must be changed on first login.
                      </p>
                    </div>
                  </div>

                  {/* Main Action Buttons */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    <button onClick={() => toast({ title: "Billing", description: `Viewing billing for ${tenant.name}` })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer">
                      💳 Billing
                    </button>
                    <button onClick={() => toast({ title: "Settings", description: `Editing settings for ${tenant.name}` })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer">
                      ⚙ Settings
                    </button>
                    <button onClick={() => toast({ title: "Invoices", description: `Viewing invoices for ${tenant.name}` })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer">
                      📄 Invoices
                    </button>
                    <button onClick={() => toast({ title: "Access Control", description: `Managing access for ${tenant.name}` })} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer">
                      🔓 Access
                    </button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex gap-2 flex-wrap pt-3 border-t border-slate-700">
                    <button onClick={() => toast({ title: "Analytics", description: `Viewing analytics for ${tenant.name}` })} className="flex-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer">
                      📊 Analytics
                    </button>
                    <button onClick={() => toast({ title: "Contact Info", description: `Contact: ${tenant.email || 'N/A'} | Phone: ${tenant.phone || 'N/A'}` })} className="flex-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer">
                      📞 Contact
                    </button>
                    <button onClick={() => { if(confirm(`Suspend ${tenant.name}?`)) toast({ title: "Suspended", description: `${tenant.name} has been suspended`, variant: "destructive" }); }} className="flex-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-yellow-400 hover:text-yellow-300 rounded-lg font-semibold text-xs transition-colors cursor-pointer">
                      ⏸ Suspend
                    </button>
                    <button onClick={() => { if(confirm(`Delete ${tenant.name}? This cannot be undone.`)) toast({ title: "Deleted", description: `${tenant.name} has been deleted`, variant: "destructive" }); }} className="flex-1 px-3 py-1.5 bg-red-700/20 hover:bg-red-700/40 text-red-400 hover:text-red-300 rounded-lg font-semibold text-xs transition-colors cursor-pointer">
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-slate-400">
              <p className="text-lg font-semibold mb-2">📭 No tenants found</p>
              <p className="text-sm">Try adjusting your search or create a new tenant</p>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-3">
          {tenants.length > 0 ? (
            tenants.map((tenant: any, idx: number) => (
              <div
                key={tenant.id}
                className={`bg-gradient-to-r ${getTenantColor(idx)} bg-opacity-10 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all group`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 flex-1">
                    <div className={`w-16 h-16 bg-gradient-to-br ${getTenantColor(idx)} rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                      {getInitials(tenant.name || 'Tenant')}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{tenant.name || 'N/A'}</h3>
                      <p className="text-sm text-slate-400 mb-2">{tenant.email || 'N/A'}</p>
                      <div className="flex gap-4 text-xs">
                        <span className="text-slate-500">👥 {tenant.userCount || 0} Users</span>
                        <span className="text-slate-500">📅 {tenant.plan || 'Professional'} Plan</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-bold">
                      🟢 Active
                    </span>
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors">
                      Manage
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg font-semibold mb-2">📭 No tenants found</p>
              <p className="text-sm">Try adjusting your search or create a new tenant</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UsersTab({ tenant }: { tenant?: any }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Mock users data (would be fetched from API based on tenant)
  const users = tenant ? [
    { id: 1, name: 'Tenant Admin', email: `admin@${tenant.name.toLowerCase()}.com`, role: 'Admin', status: 'active', lastLogin: '2 min ago', created: '2026-08-01' },
    { id: 2, name: 'Manager User', email: `manager@${tenant.name.toLowerCase()}.com`, role: 'Manager', status: 'active', lastLogin: '1 hour ago', created: '2026-08-05' },
  ] : [
    { id: 1, name: 'Admin User', email: 'admin@fleetpro.com', role: 'Admin', status: 'active', lastLogin: '2 min ago', created: '2026-08-01' },
    { id: 2, name: 'Sarah Johnson', email: 'sarah@fleetpro.com', role: 'Manager', status: 'active', lastLogin: '1 hour ago', created: '2026-08-05' },
    { id: 3, name: 'Mike Chen', email: 'mike@fleetpro.com', role: 'Operator', status: 'active', lastLogin: '30 min ago', created: '2026-08-10' },
    { id: 4, name: 'Emma Davis', email: 'emma@fleetpro.com', role: 'Operator', status: 'inactive', lastLogin: '5 days ago', created: '2026-07-20' },
    { id: 5, name: 'James Wilson', email: 'james@fleetpro.com', role: 'Manager', status: 'active', lastLogin: '3 hours ago', created: '2026-08-03' },
  ];

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Admin': return 'from-red-600 to-red-500';
      case 'Manager': return 'from-blue-600 to-blue-500';
      case 'Operator': return 'from-green-600 to-green-500';
      default: return 'from-slate-600 to-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      {tenant && (
        <div className="bg-cyan-500/10 border border-cyan-600/30 rounded-xl p-4">
          <p className="text-sm text-cyan-300">👤 Users for: <span className="font-bold text-white">{tenant.name}</span></p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center md:justify-between">
        <div className="flex gap-3 flex-1">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors hidden sm:block"
          >
            <option value="all">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Operator">Operator</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors hidden sm:block"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition-all font-semibold shadow-lg hover:shadow-xl whitespace-nowrap">
          <Plus size={18} />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/80 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${getRoleColor(user.role)} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white font-semibold">{user.name}</p>
                          <p className="text-xs text-slate-400 mt-1">ID: {user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 bg-gradient-to-r ${getRoleColor(user.role)} text-white rounded-full text-xs font-bold`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        user.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {user.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{user.lastLogin}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="p-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-slate-700 rounded-lg transition-colors" title="Reset Password">
                          <Lock size={16} />
                        </button>
                        <button className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <p className="text-lg font-semibold mb-2">👤 No users found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Users', value: users.length, icon: '👥', color: 'from-blue-600 to-blue-400' },
          { label: 'Active Users', value: users.filter(u => u.status === 'active').length, icon: '🟢', color: 'from-green-600 to-green-400' },
          { label: 'Admins', value: users.filter(u => u.role === 'Admin').length, icon: '🔑', color: 'from-red-600 to-red-400' },
          { label: 'Managers', value: users.filter(u => u.role === 'Manager').length, icon: '👔', color: 'from-purple-600 to-purple-400' },
        ].map((stat, i) => (
          <div key={i} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-6 text-white shadow-xl`}>
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm opacity-90 font-medium">{stat.label}</p>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="text-4xl font-black">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab({ tenant }: { tenant?: any }) {
  const { data: analytics = {} } = useQuery({
    queryKey: ["/api/admin/analytics/growth", tenant?.id],
    queryFn: async () => {
      try {
        const url = tenant
          ? `http://localhost:5050/api/admin/tenants/${tenant.id}/analytics`
          : 'http://localhost:5050/api/admin/analytics/growth';
        const res = await fetch(url, { credentials: 'include' });
        return res.ok ? await res.json() : {};
      } catch {
        return {};
      }
    },
    retry: 1,
  });

  return (
    <div className="space-y-8">
      {tenant && (
        <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-xl p-4">
          <p className="text-sm text-yellow-300">📈 Analytics for: <span className="font-bold text-white">{tenant.name}</span></p>
        </div>
      )}
      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
            <TrendingUp size={20} className="text-green-400" />
            Tenant Growth (Monthly)
          </h3>
          <div className="space-y-6">
            {[
              { month: 'Week 1', tenants: 12, color: 'from-blue-500 to-blue-400' },
              { month: 'Week 2', tenants: 18, color: 'from-green-500 to-green-400' },
              { month: 'Week 3', tenants: 15, color: 'from-orange-500 to-orange-400' },
              { month: 'Week 4', tenants: 22, color: 'from-purple-500 to-purple-400' },
            ].map((week, i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300 font-semibold">{week.month}</span>
                  <span className="text-white font-bold">{week.tenants} new</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${week.color} rounded-full transition-all`} style={{ width: `${(week.tenants / 22) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-8">Revenue Breakdown</h3>
          <div className="space-y-4">
            {[
              { category: 'Enterprise Plans', amount: '₹45,000', percent: 45, color: 'from-red-500 to-red-400' },
              { category: 'Professional Plans', amount: '₹35,000', percent: 35, color: 'from-blue-500 to-blue-400' },
              { category: 'Startup Plans', amount: '₹20,000', percent: 20, color: 'from-green-500 to-green-400' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300 font-medium">{item.category}</span>
                  <span className="text-white font-bold">{item.amount}</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${item.color}`} style={{ width: `${item.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Customers', value: analytics.activeTenants || 0, trend: '+15%', icon: '👥', color: 'from-blue-600/20 to-blue-500/20' },
          { label: 'Avg Customer Value', value: `₹${(analytics.avgRevenue || 0).toLocaleString()}`, trend: '+8%', icon: '💵', color: 'from-green-600/20 to-green-500/20' },
          { label: 'Conversion Rate', value: `${analytics.conversionRate || 0}%`, trend: '+3%', icon: '📈', color: 'from-purple-600/20 to-purple-500/20' },
        ].map((metric, i) => (
          <div key={i} className={`bg-gradient-to-br ${metric.color} border border-slate-700 rounded-2xl p-6 shadow-xl`}>
            <div className="flex items-start justify-between mb-4">
              <p className="text-slate-300 font-medium text-sm">{metric.label}</p>
              <span className="text-2xl">{metric.icon}</span>
            </div>
            <p className="text-3xl font-black text-white mb-2">{metric.value}</p>
            <p className="text-xs text-green-400 font-bold">{metric.trend}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonitoringTab({ tenant }: { tenant?: any }) {
  const { data: metrics = {} } = useQuery({
    queryKey: ["/api/admin/health", tenant?.id],
    queryFn: async () => {
      try {
        const url = tenant
          ? `http://localhost:5050/api/admin/tenants/${tenant.id}/health`
          : 'http://localhost:5050/api/admin/health';
        const res = await fetch(url, { credentials: 'include' });
        return res.ok ? await res.json() : {};
      } catch {
        return {};
      }
    },
    retry: 1,
  });

  return (
    <div className="space-y-8">
      {tenant && (
        <div className="bg-purple-500/10 border border-purple-600/30 rounded-xl p-4">
          <p className="text-sm text-purple-300">👁️ Monitoring for: <span className="font-bold text-white">{tenant.name}</span></p>
        </div>
      )}
      {/* Resource Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'CPU Usage', value: `${metrics.cpu || 45}%`, icon: '⚙️', status: 'normal', color: 'from-orange-600 to-red-500' },
          { label: 'Memory Usage', value: `${metrics.memory || 62}%`, icon: '🧠', status: 'normal', color: 'from-blue-600 to-cyan-500' },
          { label: 'Disk Space', value: `${metrics.disk || 78}%`, icon: '💾', status: 'warning', color: 'from-purple-600 to-pink-500' },
        ].map((metric, i) => (
          <div key={i} className={`bg-gradient-to-br ${metric.color} rounded-2xl p-8 text-white shadow-xl border border-slate-700/50`}>
            <div className="flex justify-between items-start mb-6">
              <p className="text-sm opacity-90 font-bold">{metric.label}</p>
              <span className="text-3xl">{metric.icon}</span>
            </div>
            <p className="text-5xl font-black mb-4">{metric.value}</p>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/40 rounded-full" style={{ width: metric.value }}></div>
            </div>
            <p className="text-xs mt-3 opacity-80">Status: {metric.status === 'normal' ? '✅ Normal' : '⚠️ Warning'}</p>
          </div>
        ))}
      </div>

      {/* Service Status */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl p-8 border border-slate-700">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Eye size={24} className="text-blue-400" />
          Service Status
        </h3>
        <div className="space-y-3">
          {[
            { service: 'API Server', status: 'running', uptime: '99.9%', latency: '12ms', checks: '✅' },
            { service: 'Database', status: 'running', uptime: '100%', latency: '8ms', checks: '✅' },
            { service: 'Cache Server', status: 'running', uptime: '98.5%', latency: '2ms', checks: '✅' },
            { service: 'Email Service', status: 'running', uptime: '99.2%', latency: '145ms', checks: '✅' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-5 bg-slate-700/50 rounded-xl border border-slate-600 hover:border-slate-500 hover:bg-slate-700/70 transition-all">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                  <p className="text-white font-bold">{item.service}</p>
                </div>
                <p className="text-xs text-slate-400">Uptime: {item.uptime} • Latency: {item.latency}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-green-400 mb-2">{item.checks} Health Checks</p>
                <p className="text-sm font-bold text-green-400 capitalize">{item.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-2xl p-8 border border-yellow-700/30 shadow-xl">
        <h3 className="text-lg font-bold text-yellow-300 mb-4 flex items-center gap-2">
          <AlertCircle size={20} />
          System Alerts
        </h3>
        <p className="text-yellow-200">✅ All systems operational. No critical alerts.</p>
      </div>
    </div>
  );
}

function AuditTab({ tenant }: { tenant?: any }) {
  const [search, setSearch] = useState('');

  const { data: logs = [] } = useQuery({
    queryKey: ["/api/admin/audit-logs", search, tenant?.id],
    queryFn: async () => {
      try {
        const url = tenant
          ? `http://localhost:5050/api/admin/tenants/${tenant.id}/audit-logs?limit=50&search=${search}`
          : `http://localhost:5050/api/admin/audit-logs?limit=50&search=${search}`;
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        return data.logs || [];
      } catch {
        return [];
      }
    },
    retry: 1,
  });

  return (
    <div className="space-y-6">
      {tenant && (
        <div className="bg-green-500/10 border border-green-600/30 rounded-xl p-4">
          <p className="text-sm text-green-300">📝 Audit logs for: <span className="font-bold text-white">{tenant.name}</span></p>
        </div>
      )}
      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition-all font-semibold shadow-lg">
          <Download size={18} />
          Export
        </button>
      </div>

      {/* Audit Table */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/80 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Resource</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Result</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log: any, i: number) => (
                  <tr key={i} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-white font-semibold text-sm">{log.userId || 'System'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold">
                        {log.action || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">{log.resource || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="text-green-400 text-sm font-bold flex items-center gap-1">
                        <CheckCircle size={14} />
                        Success
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm flex items-center gap-2">
                      <Clock size={14} className="text-slate-600" />
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <p className="text-lg font-semibold mb-2">No audit logs found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ tenant }: { tenant?: any }) {
  return (
    <div className="space-y-8">
      {tenant && (
        <div className="bg-indigo-500/10 border border-indigo-600/30 rounded-xl p-4">
          <p className="text-sm text-indigo-300">⚙️ Settings for: <span className="font-bold text-white">{tenant.name}</span></p>
        </div>
      )}

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Settings */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl p-8 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            🔐 Security Settings
          </h3>
          <div className="space-y-5">
            {[
              { label: 'Password Policy', value: 'Strong', desc: 'Min 12 chars, complexity' },
              { label: 'Session Timeout', value: '30 min', desc: 'Auto logout' },
              { label: 'Two-Factor Auth', value: 'Enabled', desc: 'For all admins' },
            ].map((setting, i) => (
              <div key={i} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold">{setting.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{setting.desc}</p>
                  </div>
                  <p className="text-blue-400 font-bold">{setting.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl p-8 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            ⚙️ System Settings
          </h3>
          <div className="space-y-5">
            {[
              { label: 'Rate Limiting', value: '100 req/min', desc: 'Per IP address' },
              { label: 'Data Retention', value: '90 days', desc: 'Auto-delete logs' },
              { label: 'Backup Schedule', value: 'Daily', desc: '2:00 AM UTC' },
            ].map((setting, i) => (
              <div key={i} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold">{setting.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{setting.desc}</p>
                  </div>
                  <p className="text-green-400 font-bold">{setting.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl">
        💾 Save All Settings
      </button>
    </div>
  );
}
