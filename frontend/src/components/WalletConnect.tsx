/**
 * 中文说明：本文件为前端模块，用于界面交互、状态管理或接口封装。
 */

import { BrowserProvider } from 'ethers'
import { useState } from 'react'

type Props = {
  onBound: (wallet: string) => Promise<void>
}

export default function WalletConnect({ onBound }: Props) {
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('Disconnected')

  const connect = async () => {
    const eth = (window as any).ethereum
    if (!eth) {
      setStatus('MetaMask not found')
      return
    }
    const provider = new BrowserProvider(eth)
    await provider.send('wallet_switchEthereumChain', [{ chainId: '0x89' }]).catch(async () => {
      await provider.send('wallet_addEthereumChain', [
        {
          chainId: '0x89',
          chainName: 'Polygon Mainnet',
          rpcUrls: ['https://polygon-rpc.com'],
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          blockExplorerUrls: ['https://polygonscan.com'],
        },
      ])
    })
    const accounts = await provider.send('eth_requestAccounts', [])
    const wallet = accounts[0] as string
    setAddress(wallet)
    await onBound(wallet)
    setStatus('Connected')
  }

  return (
    <div className="card">
      <h3>Wallet</h3>
      <p className="subtle">Network: Polygon</p>
      <button onClick={connect}>Connect Wallet</button>
      <p className="subtle">{status}</p>
      {address && <code>{address}</code>}
    </div>
  )
}