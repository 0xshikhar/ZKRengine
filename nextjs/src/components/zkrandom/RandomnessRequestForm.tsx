'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SupportedChain {
    chainId: number;
    name: string;
    symbol: string;
    isActive: boolean;
    requestFee: string;
}

interface RandomnessRequestFormProps {
    onRequestSubmitted?: (requestId: string) => void;
}

export default function RandomnessRequestForm({ onRequestSubmitted }: RandomnessRequestFormProps) {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    const [isLoading, setIsLoading] = useState(false);
    const [selectedChainId, setSelectedChainId] = useState<string>('84532'); // Base Sepolia default
    const [customSeed, setCustomSeed] = useState('');
    const [useCustomSeed, setUseCustomSeed] = useState(false);
    const [callbackAddress, setCallbackAddress] = useState('');
    const [supportedChains, setSupportedChains] = useState<SupportedChain[]>([]);
    const [loadingChains, setLoadingChains] = useState(true);

    // Load supported chains on component mount
    useEffect(() => {
        loadSupportedChains();
    }, []);

    const loadSupportedChains = async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/randomness/chains`);
            const data = await response.json();

            if (data.success) {
                setSupportedChains(data.data);
            } else {
                toast.error('Failed to load supported chains');
            }
        } catch (error) {
            console.error('Error loading chains:', error);
            toast.error('Failed to load supported chains');
        } finally {
            setLoadingChains(false);
        }
    };

    const generateRandomSeed = () => {
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const hexString = '0x' + Array.from(randomBytes, byte =>
            byte.toString(16).padStart(2, '0')
        ).join('');
        setCustomSeed(hexString);
    };

    const validateSeed = (seed: string): boolean => {
        return /^0x[a-fA-F0-9]{64}$/.test(seed);
    };

    const validateAddress = (addr: string): boolean => {
        return /^0x[a-fA-F0-9]{40}$/.test(addr);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConnected || !address) {
            toast.error('Please connect your wallet');
            return;
        }

        const selectedChain = supportedChains.find(c => c.chainId === parseInt(selectedChainId));
        if (!selectedChain) {
            toast.error('Invalid chain selected');
            return;
        }

        // Check if user is on the correct network
        if (chainId !== selectedChain.chainId) {
            try {
                await switchChain({ chainId: selectedChain.chainId });
            } catch (error) {
                toast.error('Please switch to the correct network');
                return;
            }
        }

        // Generate seed if not using custom
        let seed = customSeed;
        if (!useCustomSeed) {
            seed = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
                byte.toString(16).padStart(2, '0')
            ).join('');
        }

        // Validate seed
        if (!validateSeed(seed)) {
            toast.error('Invalid seed format. Must be a 32-byte hex string starting with 0x');
            return;
        }

        // Validate callback address if provided
        if (callbackAddress && !validateAddress(callbackAddress)) {
            toast.error('Invalid callback address format');
            return;
        }

        setIsLoading(true);

        try {
            const requestData = {
                chainId: selectedChain.chainId,
                seed,
                requester: address,
                ...(callbackAddress && { callbackAddress })
            };

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/randomness/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Randomness request submitted successfully!');
                onRequestSubmitted?.(data.data.requestId);

                // Reset form
                setCustomSeed('');
                setCallbackAddress('');
                setUseCustomSeed(false);
            } else {
                toast.error(data.error || 'Failed to submit request');
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            toast.error('Failed to submit request');
        } finally {
            setIsLoading(false);
        }
    };

    if (loadingChains) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading supported chains...
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Request Randomness</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Chain Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="chain">Target Chain</Label>
                        <Select value={selectedChainId} onValueChange={setSelectedChainId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a chain" />
                            </SelectTrigger>
                            <SelectContent>
                                {supportedChains.map((chain) => (
                                    <SelectItem
                                        key={chain.chainId}
                                        value={chain.chainId.toString()}
                                        disabled={!chain.isActive}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span>{chain.name}</span>
                                            <span className="text-sm text-muted-foreground ml-2">
                                                Fee: {parseFloat(chain.requestFee) / 1e18} {chain.symbol}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Seed Configuration */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="useCustomSeed"
                                checked={useCustomSeed}
                                onChange={(e) => setUseCustomSeed(e.target.checked)}
                                className="rounded"
                            />
                            <Label htmlFor="useCustomSeed">Use custom seed</Label>
                        </div>

                        {useCustomSeed && (
                            <div className="space-y-2">
                                <Label htmlFor="seed">Custom Seed (32 bytes hex)</Label>
                                <div className="flex space-x-2">
                                    <Input
                                        id="seed"
                                        value={customSeed}
                                        onChange={(e) => setCustomSeed(e.target.value)}
                                        placeholder="0x1234567890abcdef..."
                                        className="font-mono text-sm"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={generateRandomSeed}
                                    >
                                        Generate
                                    </Button>
                                </div>
                                {customSeed && !validateSeed(customSeed) && (
                                    <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Invalid seed format. Must be a 64-character hex string starting with 0x.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Callback Address (Optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="callback">Callback Contract Address (Optional)</Label>
                        <Input
                            id="callback"
                            value={callbackAddress}
                            onChange={(e) => setCallbackAddress(e.target.value)}
                            placeholder="0x742d35Cc6634C0532925a3b8D3Ac6c2e1b47C8C7"
                            className="font-mono text-sm"
                        />
                        {callbackAddress && !validateAddress(callbackAddress) && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Invalid address format.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Connection Status */}
                    {!isConnected && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Please connect your wallet to submit a randomness request.
                            </AlertDescription>
                        </Alert>
                    )}

                            {isConnected && chainId && selectedChainId &&
        chainId !== parseInt(selectedChainId) && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Please switch to {supportedChains.find(c => c.chainId === parseInt(selectedChainId))?.name} network.
                                </AlertDescription>
                            </Alert>
                        )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={!isConnected || isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting Request...
                            </>
                        ) : (
                            'Request Randomness'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}