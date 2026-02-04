import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Eye, Zap, Lock, ArrowRight, Terminal, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 cyber-grid opacity-50" />
      <div className="absolute inset-0 cyber-radial" />

      <div className="relative max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="flex justify-between items-center mb-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Stealth Link</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/register">
              <Button variant="ghost" size="sm">Register</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Launch App <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </nav>
        </header>

        {/* Hero Section */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <Badge variant="purple" className="gap-2">
              <Sparkles className="w-3 h-3" />
              Solana Privacy Hackathon
            </Badge>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Receive crypto.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400 text-glow-purple">
                Stay invisible.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-lg leading-relaxed">
              The first privacy-preserving &quot;Link-in-Bio&quot; donation tool.
              Accept SOL from anyone, anywhere. <span className="text-cyan-400">No trace. No doxxing.</span>
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  <Terminal className="w-4 h-4" />
                  Register .stealth
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="secondary" size="lg">
                  Open Dashboard
                </Button>
              </Link>
            </div>

            {/* Powered by badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="https://lightprotocol.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Badge variant="outline" className="gap-2 hover:border-green-500/50 transition-colors">
                  <span className="w-2 h-2 bg-green-500 rounded-full status-dot" />
                  Light Protocol
                </Badge>
              </a>
              <a
                href="https://helius.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Badge variant="outline" className="gap-2 hover:border-orange-500/50 transition-colors">
                  <span className="w-2 h-2 bg-orange-500 rounded-full status-dot" />
                  Helius
                </Badge>
              </a>
            </div>
          </div>

          {/* Demo Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500" />
            <Card variant="glass" className="relative">
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <span className="text-lg font-bold">C</span>
                    </div>
                    <div>
                      <div className="font-bold text-white">@creator</div>
                      <div className="text-xs text-gray-500 font-mono">creator.stealth</div>
                    </div>
                  </div>
                  <Badge variant="success" className="gap-1.5">
                    <Lock className="w-3 h-3" />
                    Verified
                  </Badge>
                </div>

                <Card variant="terminal" className="p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <Shield className="w-3 h-3 text-purple-400" />
                    Shielded Donation
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xl text-white">0.5 SOL</span>
                    <Badge variant="cyan" className="gap-1">
                      <Zap className="w-3 h-3" />
                      Processing
                    </Badge>
                  </div>
                </Card>

                <Card variant="terminal" className="p-4 opacity-60">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <Shield className="w-3 h-3 text-purple-400" />
                    Shielded Donation
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xl text-white">1.0 SOL</span>
                    <Badge variant="success" className="gap-1">
                      Completed
                    </Badge>
                  </div>
                </Card>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* How it works section */}
        <section className="mt-32 space-y-12">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-4xl font-bold">Three simple steps</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                icon: Terminal,
                title: "Register",
                description: "Connect your wallet and claim a unique .stealth handle. Your handle maps to your wallet on-chain."
              },
              {
                step: "2",
                icon: Zap,
                title: "Share Your Link",
                description: "Post your Stealth Link on Twitter/X. It unfurls as a beautiful Blink with donation buttons."
              },
              {
                step: "3",
                icon: Eye,
                title: "Receive Privately",
                description: "Donations are shielded using ZK compression. Unshield to a fresh wallet for complete privacy."
              }
            ].map((item) => (
              <Card key={item.step} variant="glass" className="group hover:border-purple-500/30 transition-all duration-300">
                <CardContent className="space-y-4">
                  <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center group-hover:bg-purple-800/50 transition-colors">
                    <item.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Privacy explanation */}
        <section className="mt-32 max-w-3xl mx-auto text-center space-y-6">
          <Badge variant="cyan" className="gap-2">
            <Lock className="w-3 h-3" />
            Zero Knowledge
          </Badge>
          <h2 className="text-4xl font-bold">True Privacy, Not Theater</h2>
          <p className="text-gray-400 leading-relaxed text-lg">
            Unlike traditional donation links that expose your wallet balance and transaction history,
            Stealth Link uses <span className="text-cyan-400 font-medium">Light Protocol&apos;s ZK compression</span> to
            shield incoming funds. The public blockchain shows donations going to the Light Protocol pool —
            not your personal wallet. When you&apos;re ready, unshield to a fresh address and break the link entirely.
          </p>
        </section>

        {/* CTA */}
        <section className="mt-32 text-center">
          <Card variant="glow" className="p-12 border-purple-500/30 animate-border-glow">
            <CardContent className="space-y-6">
              <h2 className="text-4xl font-bold">Ready to go stealth?</h2>
              <p className="text-gray-400 max-w-lg mx-auto">
                Register your .stealth handle today and start accepting private donations.
              </p>
              <Link href="/register">
                <Button size="xl" className="gap-2">
                  <Shield className="w-5 h-5" />
                  Get Started
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="mt-32 pt-12 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              Built for the Solana Privacy Hackathon
            </p>
            <div className="flex items-center gap-6">
              <a href="https://github.com/mindsend-datatech/solana-stealth" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-purple-400 transition-colors text-sm">
                GitHub
              </a>
              <a href="https://lightprotocol.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-purple-400 transition-colors text-sm">
                Light Protocol
              </a>
              <a href="https://helius.dev" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-purple-400 transition-colors text-sm">
                Helius
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
