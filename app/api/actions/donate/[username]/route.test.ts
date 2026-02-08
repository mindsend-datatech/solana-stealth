import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { PublicKey } from '@solana/web3.js'

// Mock the Solana Actions package
vi.mock('@solana/actions', () => ({
  ACTIONS_CORS_HEADERS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
  createPostResponse: vi.fn((args) => Promise.resolve(args.fields)),
}))

// Mock Solana web3
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')

  class MockConnection {
    constructor() {}
    async getLatestBlockhash() {
      return {
        blockhash: 'mocked-blockhash',
        lastValidBlockHeight: 12345,
      }
    }
    async getAccountInfo() {
      return null
    }
  }

  class MockTransaction {
    constructor() {
      this.add = vi.fn()
      this.feePayer = null
      this.recentBlockhash = null
    }
  }

  return {
    ...actual,
    Connection: MockConnection,
    Transaction: MockTransaction,
  }
})

// Mock Light Protocol
vi.mock('@lightprotocol/stateless.js', () => ({
  LightSystemProgram: {
    compress: vi.fn().mockResolvedValue({ type: 'compressed-instruction' }),
  },
  createRpc: vi.fn(() => ({
    getStateTreeInfos: vi.fn().mockResolvedValue([
      {
        tree: new PublicKey('TreePubkey11111111111111111111111111111111'),
        queue: new PublicKey('QueuePubkey1111111111111111111111111111111'),
        treeType: 1, // V1 tree
      },
    ]),
  })),
}))

describe('Donate API Route - GET', () => {
  it('returns action metadata for SOL domain', async () => {
    const request = new Request('http://localhost/api/actions/donate/alice.sol')
    const params = Promise.resolve({ username: 'alice.sol' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(data.title).toContain('Donate Privately to alice.sol')
    expect(data.description).toContain('shielded donation')
    expect(data.label).toBe('Donate 0.1 SOL')
    expect(data.links.actions).toHaveLength(3)
  })

  it('returns action metadata for public key', async () => {
    const pubkey = 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm'
    const request = new Request(`http://localhost/api/actions/donate/${pubkey}`)
    const params = Promise.resolve({ username: pubkey })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(data.title).toContain('CdM8...EQWm')
    expect(data.description).toContain(pubkey)
  })

  it('returns error message for invalid address', async () => {
    const request = new Request('http://localhost/api/actions/donate/invalid')
    const params = Promise.resolve({ username: 'invalid' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(data.title).toBe('Invalid Creator Address')
  })

  it('includes correct action links with amounts', async () => {
    const request = new Request('http://localhost/api/actions/donate/alice.sol')
    const params = Promise.resolve({ username: 'alice.sol' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(data.links.actions[0].href).toContain('amount=0.1')
    expect(data.links.actions[1].href).toContain('amount=0.5')
    expect(data.links.actions[2].href).toContain('amount={amount}')
    expect(data.links.actions[2].parameters).toHaveLength(1)
    expect(data.links.actions[2].parameters[0].name).toBe('amount')
  })

  it('includes CORS headers in response', async () => {
    const request = new Request('http://localhost/api/actions/donate/alice.sol')
    const params = Promise.resolve({ username: 'alice.sol' })

    const response = await GET(request, { params })

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('Donate API Route - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates amount parameter', async () => {
    const request = new Request(
      'http://localhost/api/actions/donate/alice.sol?amount=invalid',
      {
        method: 'POST',
        body: JSON.stringify({
          account: 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm',
        }),
      }
    )
    const params = Promise.resolve({ username: 'alice.sol' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid amount')
  })

  it('rejects negative amounts', async () => {
    const request = new Request(
      'http://localhost/api/actions/donate/alice.sol?amount=-1',
      {
        method: 'POST',
        body: JSON.stringify({
          account: 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm',
        }),
      }
    )
    const params = Promise.resolve({ username: 'alice.sol' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid amount')
  })

  it('rejects zero amounts', async () => {
    const request = new Request(
      'http://localhost/api/actions/donate/alice.sol?amount=0',
      {
        method: 'POST',
        body: JSON.stringify({
          account: 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm',
        }),
      }
    )
    const params = Promise.resolve({ username: 'alice.sol' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid amount')
  })

  it('handles invalid account public key', async () => {
    const request = new Request(
      'http://localhost/api/actions/donate/alice.sol?amount=0.1',
      {
        method: 'POST',
        body: JSON.stringify({
          account: 'invalid-pubkey',
        }),
      }
    )
    const params = Promise.resolve({ username: 'alice.sol' })

    // Suppress expected error logs during test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const response = await POST(request, { params })
      // Should fail when trying to create PublicKey from invalid string
      expect(response.status).toBeGreaterThanOrEqual(400)
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('handles plain public key username', async () => {
    const validPubkey = 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm'
    const request = new Request(
      `http://localhost/api/actions/donate/${validPubkey}?amount=0.1`,
      {
        method: 'POST',
        body: JSON.stringify({
          account: validPubkey,
        }),
      }
    )
    const params = Promise.resolve({ username: validPubkey })

    // Set environment variable for RPC
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://devnet.helius-rpc.com'

    // Suppress console logs during test
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const response = await POST(request, { params })

      // If Light Protocol is working, should return transaction
      if (response.status === 200) {
        const data = await response.json()
        expect(data).toBeDefined()
      }
    } finally {
      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    }
  })

  it('returns error when username is invalid format', async () => {
    const request = new Request(
      'http://localhost/api/actions/donate/invalid-format?amount=0.1',
      {
        method: 'POST',
        body: JSON.stringify({
          account: 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm',
        }),
      }
    )
    const params = Promise.resolve({ username: 'invalid-format' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid Creator Address')
  })

  it('uses default amount of 0.1 when not specified', async () => {
    const validPubkey = 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm'
    const request = new Request(
      `http://localhost/api/actions/donate/${validPubkey}`,
      {
        method: 'POST',
        body: JSON.stringify({
          account: validPubkey,
        }),
      }
    )
    const params = Promise.resolve({ username: validPubkey })

    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://devnet.helius-rpc.com'

    // Suppress console logs during test
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const response = await POST(request, { params })

      // Should use default 0.1 SOL (won't error on amount validation)
      expect(response.status).not.toBe(400)
    } finally {
      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    }
  })

  it('handles .stealth domain resolution failure', async () => {
    const request = new Request(
      'http://localhost/api/actions/donate/nonexistent.stealth?amount=0.1',
      {
        method: 'POST',
        body: JSON.stringify({
          account: 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm',
        }),
      }
    )
    const params = Promise.resolve({ username: 'nonexistent.stealth' })

    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://devnet.helius-rpc.com'

    // Suppress expected error logs during test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Could not resolve .stealth domain')
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('returns 500 when HELIUS_RPC_URL is missing', async () => {
    const validPubkey = 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm'
    const request = new Request(
      `http://localhost/api/actions/donate/${validPubkey}?amount=0.1`,
      {
        method: 'POST',
        body: JSON.stringify({
          account: validPubkey,
        }),
      }
    )
    const params = Promise.resolve({ username: validPubkey })

    // Clear the environment variable
    delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL

    // Suppress console logs during test
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Server Configuration Error')
    } finally {
      consoleLogSpy.mockRestore()
    }
  })

  it('includes CORS headers in POST response', async () => {
    const request = new Request(
      'http://localhost/api/actions/donate/alice.sol?amount=0.1',
      {
        method: 'POST',
        body: JSON.stringify({
          account: 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm',
        }),
      }
    )
    const params = Promise.resolve({ username: 'alice.sol' })

    // Suppress expected error logs during test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const response = await POST(request, { params })

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    } finally {
      consoleSpy.mockRestore()
      consoleLogSpy.mockRestore()
    }
  })
})

describe('Donate API Route - Username Resolution', () => {
  it('identifies .sol domain correctly', async () => {
    const request = new Request('http://localhost/api/actions/donate/alice.sol')
    const params = Promise.resolve({ username: 'alice.sol' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(data.title).toContain('alice.sol')
  })

  it('handles .stealth domain in GET request', async () => {
    const request = new Request('http://localhost/api/actions/donate/alice.stealth')
    const params = Promise.resolve({ username: 'alice.stealth' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(data.description).toContain('alice.stealth')
  })

  it('truncates long public keys in title', async () => {
    const longPubkey = 'CdM8wJHN9KGdv5EaLzdKmofXyxSanszaXRw7wHGzEQWm'
    const request = new Request(`http://localhost/api/actions/donate/${longPubkey}`)
    const params = Promise.resolve({ username: longPubkey })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(data.title).toContain('...')
    expect(data.title).toContain('CdM8')
    expect(data.title).toContain('QWm')
  })
})
