'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Copy, 
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface RequestStatus {
  requestId: string;
  status: 'pending' | 'processing' | 'fulfilled' | 'failed' | 'expired';
  chainId: number;
  requester: string;
  seed: string;
  randomValue?: string;
  proofHash?: string;
  requestedAt: string;
  fulfilledAt?: string;
  processingTime?: number;
  expiresAt: string;
  error?: {
    message: string;
    code: string;
  };
  proof?: {
    proofId: string;
    verificationStatus: string;
    zkVerifyStatus: string;
    jobId: string;
  };
}

interface RequestStatusCardProps {
  initialRequestId?: string;
  onRandomnessReceived?: (requestId: string, randomValue: string) => void;
}

const statusConfig = {
  pending: {
    color: 'bg-yellow-500',
    icon: Clock,
    label: 'Pending',
    description: 'Request submitted, waiting for processing'
  },
  processing: {
    color: 'bg-blue-500',
    icon: Loader2,
    label: 'Processing',
    description: 'Generating ZK proof and submitting to zkVerify'
  },
  fulfilled: {
    color: 'bg-green-500',
    icon: CheckCircle,
    label: 'Fulfilled',
    description: 'Randomness generated and verified successfully'
  },
  failed: {
    color: 'bg-red-500',
    icon: XCircle,
    label: 'Failed',
    description: 'Request processing failed'
  },
  expired: {
    color: 'bg-gray-500',
    icon: XCircle,
    label: 'Expired',
    description: 'Request expired before completion'
  }
};

export default function RequestStatusCard({ 
  initialRequestId, 
  onRandomnessReceived 
}: RequestStatusCardProps) {
  const [requestId, setRequestId] = useState(initialRequestId || '');
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (initialRequestId) {
      fetchStatus(initialRequestId);
    }
  }, [initialRequestId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh && status && ['pending', 'processing'].includes(status.status)) {
      interval = setInterval(() => {
        fetchStatus(status.requestId);
      }, 5000); // Refresh every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, status]);

  const fetchStatus = async (id: string) => {
    if (!id.trim()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/randomness/request/${id}`);
      const data = await response.json();
      
      if (data.success) {
        const newStatus = data.data;
        setStatus(newStatus);
        
        // Call callback if randomness was just received
        if (newStatus.status === 'fulfilled' && newStatus.randomValue && 
            (!status || status.status !== 'fulfilled')) {
          onRandomnessReceived?.(newStatus.requestId, newStatus.randomValue);
        }
        
        // Auto-disable refresh if request is complete
        if (!['pending', 'processing'].includes(newStatus.status)) {
          setAutoRefresh(false);
        }
      } else {
        toast.error(data.error || 'Failed to fetch request status');
      }
    } catch (error) {
      console.error('Error fetching status:', error);
      toast.error('Failed to fetch request status');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestId.trim()) {
      fetchStatus(requestId);
      setAutoRefresh(true);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getExplorerUrl = (chainId: number, hash: string, type: 'tx' | 'address') => {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io',
      137: 'https://polygonscan.com',
      8453: 'https://basescan.org',
      84532: 'https://sepolia.basescan.org'
    };
    
    const baseUrl = explorers[chainId];
    if (!baseUrl) return null;
    
    return `${baseUrl}/${type}/${hash}`;
  };

  const formatRandomValue = (value: string) => {
    // Show first 10 and last 6 characters
    if (value.length > 20) {
      return `${value.slice(0, 10)}...${value.slice(-6)}`;
    }
    return value;
  };

  if (!status && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check Request Status</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestId">Request ID</Label>
              <div className="flex space-x-2">
                <Input
                  id="requestId"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  placeholder="req_1234567890_abcdef"
                  className="font-mono text-sm"
                />
                <Button type="submit" disabled={!requestId.trim() || loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Check Status'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading request status...
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const StatusIcon = statusConfig[status.status].icon;
  const isProcessing = ['pending', 'processing'].includes(status.status);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <span>Request Status</span>
            {isProcessing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchStatus(status.requestId)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge 
              variant="secondary"
              className={`${statusConfig[status.status].color} text-white`}
            >
              <StatusIcon className={`h-3 w-3 mr-1 ${status.status === 'processing' ? 'animate-spin' : ''}`} />
              {statusConfig[status.status].label}
            </Badge>
            {isProcessing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? 'Stop Auto-refresh' : 'Auto-refresh'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Description */}
        <p className="text-sm text-muted-foreground">
          {statusConfig[status.status].description}
        </p>

        {/* Request Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Request ID</Label>
              <div className="flex items-center space-x-2">
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {status.requestId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(status.requestId, 'Request ID')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Chain ID</Label>
              <p className="text-sm">{status.chainId}</p>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Requester</Label>
              <div className="flex items-center space-x-2">
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {`${status.requester.slice(0, 6)}...${status.requester.slice(-4)}`}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(status.requester, 'Requester address')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {getExplorerUrl(status.chainId, status.requester, 'address') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const url = getExplorerUrl(status.chainId, status.requester, 'address');
                      if (url) window.open(url, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Requested</Label>
              <p className="text-sm">
                {formatDistanceToNow(new Date(status.requestedAt), { addSuffix: true })}
              </p>
            </div>

            {status.fulfilledAt && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Fulfilled</Label>
                <p className="text-sm">
                  {formatDistanceToNow(new Date(status.fulfilledAt), { addSuffix: true })}
                </p>
              </div>
            )}

            {status.processingTime && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Processing Time</Label>
                <p className="text-sm">{(status.processingTime / 1000).toFixed(2)}s</p>
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Expires</Label>
              <p className="text-sm">
                {formatDistanceToNow(new Date(status.expiresAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>

        {/* Random Value (if fulfilled) */}
        {status.randomValue && (
          <>
            <Separator />
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Random Value</Label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="text-sm bg-green-50 border border-green-200 px-3 py-2 rounded font-mono">
                  {formatRandomValue(status.randomValue)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(status.randomValue!, 'Random value')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Proof Information */}
        {status.proof && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Proof Information</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Proof ID:</span> {status.proof.proofId}
                </div>
                <div>
                  <span className="font-medium">Verification:</span> 
                  <Badge variant="outline" className="ml-1">
                    {status.proof.verificationStatus}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">zkVerify Status:</span> 
                  <Badge variant="outline" className="ml-1">
                    {status.proof.zkVerifyStatus}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Job ID:</span> {status.proof.jobId}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error Information */}
        {status.error && (
          <>
            <Separator />
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <Label className="text-xs font-medium text-red-700">Error</Label>
              <p className="text-sm text-red-600 mt-1">{status.error.message}</p>
              {status.error.code && (
                <p className="text-xs text-red-500 mt-1">Code: {status.error.code}</p>
              )}
            </div>
          </>
        )}

        {/* Search for another request */}
        <Separator />
        <div className="flex items-center space-x-2">
          <Input
            value={requestId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRequestId(e.target.value)}
            placeholder="Enter another request ID..."
            className="font-mono text-sm"
          />
          <Button 
            onClick={() => fetchStatus(requestId)}
            disabled={!requestId.trim() || loading}
            variant="outline"
          >
            Check
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}