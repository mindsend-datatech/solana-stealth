
import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500 selection:text-white">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <header className="flex justify-between items-center mb-24">
          <div className="font-bold text-xl tracking-tight">Stealth Link</div>
          <Link href="/dashboard" className="text-sm font-medium hover:text-purple-400 transition-colors">
            Launch App →
          </Link>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-block px-3 py-1 bg-purple-900/30 border border-purple-500/50 rounded-full text-purple-300 text-xs font-semibold uppercase tracking-wide">
              Solana Privacy Hackathon
            </div>
            <h1 className="text-6xl font-extrabold tracking-tight leading-tight">
              Receive crypto. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                Stay invisible.
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-lg leading-relaxed">
              The first privacy-preserving "Link-in-Bio" donation tool.
              Accept SOL from anyone, anywhere. No trace. No doxxing.
            </p>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all transform hover:scale-105"
              >
                Create Your Link
              </Link>
              <a
                href="https://github.com/lightprotocol/light-protocol"
                target="_blank"
                className="px-8 py-4 bg-gray-900 border border-gray-700 text-white font-bold rounded-lg hover:border-gray-500 transition-all"
              >
                Powered by Light
              </a>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-8 bg-gray-900 ring-1 ring-gray-800 rounded-xl leading-none flex items-top justify-start space-x-6">
              <div className="space-y-4 w-full">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500"></div>
                    <div>
                      <div className="font-bold">@ariel</div>
                      <div className="text-xs text-gray-500">Stealth Link</div>
                    </div>
                  </div>
                  <div className="text-green-400 text-xs bg-green-900/30 px-2 py-1 rounded">Verified</div>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                  <div className="text-xs text-gray-500 mb-1">Shielded Donation</div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-lg">0.5 SOL</span>
                    <span className="text-purple-400 text-xs">Processing via Light Protocol</span>
                  </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 opacity-50">
                  <div className="text-xs text-gray-500 mb-1">Shielded Donation</div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-lg">1.0 SOL</span>
                    <span className="text-purple-400 text-xs">Completed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
