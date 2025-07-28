import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useService } from '@/contexts/ServiceContext';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminStats from '@/components/admin/AdminStats';
import RequestList from '@/components/admin/RequestList';
import StatusUpdateDialog from '@/components/admin/StatusUpdateDialog';
import AdminMessages from '@/components/admin/AdminMessages';
import TruckDispatch from '@/components/admin/TruckDispatch';
import AddTruckForm from '@/components/admin/AddTruckForm';
import PaymentForm from '@/components/PaymentForm';
import GoogleMap from '@/components/GoogleMap';
import { useSocket } from '@/contexts/SocketContext';
import { Wrench, MessageSquare, Truck, CreditCard, MapPin, Plus } from 'lucide-react';

const AdminDashboard = () => {
  const { requests, updateRequestStatus } = useService();
  const { notifications, removeNotification } = useSocket();
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    request: null,
    actionType: '',
  });
  const [trucks, setTrucks] = useState([]);

  const handleStatusUpdate = (request, action) => {
    setDialogState({ isOpen: true, request, actionType: action });
  };

  const handleTruckAdded = (newTruck) => {
    setTrucks(prev => [newTruck, ...prev]);
  };

  const handlePaymentSuccess = (paymentIntent) => {
    console.log('Payment successful:', paymentIntent);
  };

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const approvedRequests = requests.filter(req => req.status === 'approved');
  const completedRequests = requests.filter(req => req.status === 'completed');

  const requestTabs = [
    { value: 'pending', label: 'Pending', data: pendingRequests, emptyMessage: 'No pending requests. All requests have been processed.' },
    { value: 'approved', label: 'Approved', data: approvedRequests, emptyMessage: 'No requests are currently approved.' },
    { value: 'completed', label: 'Completed', data: completedRequests, emptyMessage: 'No requests have been completed yet.' },
    { value: 'all', label: 'All Requests', data: requests, emptyMessage: 'No service requests in the system.' },
  ];

  return (
    <div className="min-h-screen p-4">
      <Helmet>
        <title>Admin Dashboard - AutoCare Pro</title>
        <meta name="description" content="Administrative dashboard for managing service requests, approvals, and system oversight." />
      </Helmet>
      
      <AdminHeader />
      <AdminStats requests={requests} />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-black/50 border border-red-900/30">
            <TabsTrigger value="requests" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Wrench className="w-4 h-4 mr-2" /> Service Requests
            </TabsTrigger>
            <TabsTrigger value="trucks" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Truck className="w-4 h-4 mr-2" /> Fleet Management
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-2" /> Messages
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-2" /> Payments
            </TabsTrigger>
            <TabsTrigger value="locations" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <MapPin className="w-4 h-4 mr-2" /> Locations
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="requests">
            <Tabs defaultValue="pending" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 bg-black/50 border border-red-900/30">
                {requestTabs.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                    {tab.label} ({tab.data.length})
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {requestTabs.map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="space-y-4">
                  <RequestList 
                    requests={tab.data}
                    onStatusUpdate={handleStatusUpdate}
                    emptyMessage={tab.emptyMessage}
                    statusFilter={tab.value !== 'all' ? tab.value : undefined}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="trucks">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Fleet Management</h2>
                <AddTruckForm onTruckAdded={handleTruckAdded} />
              </div>
              <TruckDispatch />
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <AdminMessages />
          </TabsContent>

          <TabsContent value="payments">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">Payment Management</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaymentForm 
                  onPaymentSuccess={handlePaymentSuccess}
                />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Recent Payment Notifications</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {notifications
                      .filter(notif => notif.type === 'payment')
                      .slice(0, 10)
                      .map(notif => (
                        <div key={notif.id} className="p-3 bg-black/30 rounded-lg border border-red-900/30">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-white">{notif.title}</h4>
                              <p className="text-sm text-gray-300">{notif.message}</p>
                            </div>
                            <button
                              onClick={() => removeNotification(notif.id)}
                              className="text-gray-400 hover:text-white"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="locations">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">User Locations</h2>
              <GoogleMap 
                showUserLocations={true}
                allowLocationSharing={false}
              />
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
      
      <StatusUpdateDialog
        dialogState={dialogState}
        setDialogState={setDialogState}
        updateRequestStatus={updateRequestStatus}
      />
    </div>
  );
};

export default AdminDashboard;