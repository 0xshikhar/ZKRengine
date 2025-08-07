'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Zap, 
  Shield, 
  Globe, 
  Lock, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Cpu,
  BarChart3,
  Clock
} from 'lucide-react';
import RandomnessRequestForm from '@/components/zkrandom/RandomnessRequestForm';
import RequestStatusCard from '@/components/zkrandom/RequestStatusCard';

export default function Home() {
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const handleRequestSubmitted = (requestId: string) => {
    setActiveRequestId(requestId);
  };

  const features = [
    {
      icon: Shield,
      title: "Zero-Knowledge Verified",
      description: "Cryptographically secure randomness with ZK proofs ensuring verifiable randomness without revealing the seed."
    },
    {
      icon: Globe,
      title: "Multi-Chain Support",
      description: "Generate randomness across multiple blockchains including Ethereum, Base, and Polygon networks."
    },
    {
      icon: Lock,
      title: "Tamper-Proof",
      description: "Immutable randomness that cannot be manipulated by miners, validators, or any centralized entity."
    },
    {
      icon: Cpu,
      title: "Fast Processing",
      description: "Quick randomness generation with real-time status tracking and automatic callback notifications."
    }
  ];

  const stats = [
    { label: "Total Requests", value: "10,000+", icon: BarChart3 },
    { label: "Success Rate", value: "99.9%", icon: CheckCircle },
    { label: "Avg Response Time", value: "< 30s", icon: Clock },
    { label: "Supported Chains", value: "4+", icon: Globe }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <Badge variant="secondary" className="text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                ZK-Powered Randomness
              </Badge>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              ZKR Engine
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Verifiable Randomness
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Generate cryptographically secure, zero-knowledge verified random numbers 
              for your decentralized applications across multiple blockchains.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="text-lg px-8 py-6">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                View Documentation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <IconComponent className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Choose ZKR Engine?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built with cutting-edge zero-knowledge cryptography for the most secure 
              and verifiable randomness generation.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Functionality Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Request Randomness</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Select your target chain and generate verifiable random numbers with ZK proofs.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <RandomnessRequestForm onRequestSubmitted={handleRequestSubmitted} />
            </div>
            
            <div>
              <RequestStatusCard 
                initialRequestId={activeRequestId}
                onRandomnessReceived={(requestId, randomValue) => {
                  console.log('Randomness received:', { requestId, randomValue });
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple three-step process to get verifiable randomness on any supported blockchain.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Select Chain</h3>
              <p className="text-muted-foreground">
                Choose from supported blockchains including Ethereum, Base, and Polygon.
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Submit Request</h3>
              <p className="text-muted-foreground">
                Provide your seed (optional) and submit the randomness request.
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Verified Result</h3>
              <p className="text-muted-foreground">
                Receive your random number with ZK proof for verification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of developers using ZKR Engine for secure, verifiable randomness.
          </p>
          <Button size="lg" className="text-lg px-8 py-6">
            Start Generating Randomness
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}
