import { useState, useEffect } from 'react';
import {
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { deleteRequestsAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface DeleteRequest {
  id: string;
  recordType: string;
  recordId: string;
  reason: string | null;
  status: string;
  createdAt: string;
  requestedBy: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  approvedBy: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  record: any;
}

export default function Actions() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await deleteRequestsAPI.getAll();
      setRequests(response.data);
    } catch (error) {
      toast.error('Failed to fetch delete requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await deleteRequestsAPI.approve(id);
      toast.success('Delete request approved');
      fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await deleteRequestsAPI.reject(id);
      toast.success('Delete request rejected');
      fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await deleteRequestsAPI.cancel(id);
      toast.success('Delete request cancelled');
      fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel');
    }
  };

  const filteredRequests = filter === 'pending' 
    ? requests.filter(r => r.status === 'pending')
    : requests;

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Actions</h1>
          <p className="text-white/60 mt-1">
            {user?.isAdmin ? 'Review and approve delete requests' : 'Your delete requests'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === 'pending'
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ClockIcon className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/60">
              {filter === 'pending' ? 'No pending delete requests' : 'No delete requests'}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request.id} className="glass-card p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    request.recordType === 'expense' ? 'bg-blue-500/20' : 'bg-green-500/20'
                  }`}>
                    {request.recordType === 'expense' ? (
                      <CurrencyDollarIcon className="w-6 h-6 text-blue-400" />
                    ) : (
                      <CreditCardIcon className="w-6 h-6 text-green-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                        request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        request.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      <span className="text-xs text-white/50 capitalize">
                        {request.recordType}
                      </span>
                    </div>
                    
                    {/* Record details */}
                    {request.record ? (
                      <div className="text-white">
                        {request.recordType === 'expense' ? (
                          <>
                            <p className="font-medium">{request.record.description}</p>
                            <p className="text-lg font-bold text-purple-400">
                              RM {request.record.amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-white/50">
                              by {request.record.user?.displayName} • {format(new Date(request.record.date), 'MMM d, yyyy')}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">
                              {request.record.fromUser?.displayName} → {request.record.toUser?.displayName}
                            </p>
                            <p className="text-lg font-bold text-green-400">
                              RM {request.record.amount.toFixed(2)}
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-white/50 italic">Record has been deleted</p>
                    )}

                    {request.reason && (
                      <p className="text-sm text-white/60 mt-2">
                        Reason: {request.reason}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                      <span>Requested by {request.requestedBy.displayName}</span>
                      <span>•</span>
                      <span>{format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}</span>
                      {request.approvedBy && (
                        <>
                          <span>•</span>
                          <span>{request.status} by {request.approvedBy.displayName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {request.status === 'pending' && (
                  <div className="flex gap-2">
                    {user?.isAdmin ? (
                      <>
                        <button
                          onClick={() => handleApprove(request.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    ) : request.requestedBy.id === user?.id && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
