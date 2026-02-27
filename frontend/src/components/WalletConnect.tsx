import { useEffect, useMemo, useState } from 'react'
import type { LiveWallet, PaperWallet } from '../api'
import { localizeErrorMessage, useI18n } from '../i18n'
import ConfirmAction from './ui/ConfirmAction'
import CopyableText from './ui/CopyableText'

type NoticeKind = 'success' | 'error' | 'info'
type WalletMode = 'browser' | 'private_key'

type Props = {
  onCreateBindChallenge: () => Promise<{ challenge_message: string }>
  onBindBrowserWallet: (wallet: string, note: string, challengeMessage: string, signature: string) => Promise<void>
  onBindPrivateKey: (privateKey: string, note: string) => Promise<{ wallet_address: string }>
  onCreatePaperWallet: (initialUsdc: 1000 | 5000 | 10000, note: string) => Promise<void>
  onActivateLiveWallet: (walletId: string) => Promise<void>
  onActivatePaperWallet: (walletId: string) => Promise<void>
  onDisconnectWallet: () => Promise<void>
  onDeleteLiveWallet: (walletId: string) => Promise<void>
  onDeletePaperWallet: (walletId: string) => Promise<void>
  onFetchWallet: () => Promise<{ wallet_address: string | null; note: string; chain_id: number }>
  onFetchLiveWallets: () => Promise<LiveWallet[]>
  onFetchPaperWallets: () => Promise<PaperWallet[]>
  onNotify: (kind: NoticeKind, message: string) => void
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
  isMetaMask?: boolean
  isRabby?: boolean
  isCoinbaseWallet?: boolean
  isOkxWallet?: boolean
}

type InjectedEthereum = Eip1193Provider & { providers?: Eip1193Provider[] }
type WalletWindow = Window & {
  ethereum?: InjectedEthereum
  okxwallet?: { ethereum?: Eip1193Provider }
}
type WalletSelection = { wallet: string; provider: Eip1193Provider }
const POLYGON_CHAIN_ID_HEX = '0x89'

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase()
}

function shortAddress(addr: string): string {
  return addr.length <= 16 ? addr : `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

export default function WalletConnect({
  onCreateBindChallenge,
  onBindBrowserWallet,
  onBindPrivateKey,
  onCreatePaperWallet,
  onActivateLiveWallet,
  onActivatePaperWallet,
  onDisconnectWallet,
  onDeleteLiveWallet,
  onDeletePaperWallet,
  onFetchWallet,
  onFetchLiveWallets,
  onFetchPaperWallets,
  onNotify,
}: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<WalletMode>('browser')
  const [activeLiveAddress, setActiveLiveAddress] = useState('')
  const [activeLiveNote, setActiveLiveNote] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [browserWalletNote, setBrowserWalletNote] = useState('')
  const [privateWalletNote, setPrivateWalletNote] = useState('')
  const [paperFunding, setPaperFunding] = useState<1000 | 5000 | 10000>(1000)
  const [paperWalletNote, setPaperWalletNote] = useState('')
  const [showPaperCreatePanel, setShowPaperCreatePanel] = useState(false)
  const [liveWallets, setLiveWallets] = useState<LiveWallet[]>([])
  const [paperWallets, setPaperWallets] = useState<PaperWallet[]>([])
  const [selectedLiveWalletId, setSelectedLiveWalletId] = useState('')
  const [selectedPaperWalletId, setSelectedPaperWalletId] = useState('')
  const [statusKey, setStatusKey] = useState<
    | 'disconnected'
    | 'connected'
    | 'connecting'
    | 'metamask_not_found'
    | 'bind_failed'
    | 'connect_failed'
    | 'paper_ready'
    | 'disconnected_done'
  >('disconnected')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [extensionAccount, setExtensionAccount] = useState('')
  const [extensionChainId, setExtensionChainId] = useState('')

  const isConnected = !!activeLiveAddress

  const selectedLiveWallet = useMemo(
    () => liveWallets.find((w) => w.wallet_id === selectedLiveWalletId) || null,
    [liveWallets, selectedLiveWalletId],
  )
  const selectedPaperWallet = useMemo(
    () => paperWallets.find((w) => w.wallet_id === selectedPaperWalletId) || null,
    [paperWallets, selectedPaperWalletId],
  )

  const withTimeout = async <T,>(task: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      }),
    ])
  }

  const toWalletError = (err: unknown): string => {
    const e = err as { code?: number; message?: string }
    if (e?.code === 4001) return t('wallet.error.user_rejected')
    if (e?.code === 4902) return t('wallet.error.chain_not_added')
    if (e?.code === -32002) return t('wallet.error.request_pending')
    if (e?.message?.includes('wallet request timeout')) return t('wallet.error.request_timeout')
    if (e?.message) return localizeErrorMessage(e.message, t)
    return t('wallet.error.connect_failed')
  }

  const listInjectedProviders = (): Eip1193Provider[] => {
    const win = window as WalletWindow
    const injected = win.ethereum
    if (!injected) return []

    const fromEthereum = injected.providers && injected.providers.length > 0 ? [...injected.providers] : [injected]
    const extra: Eip1193Provider[] = []
    if (win.okxwallet?.ethereum) extra.push(win.okxwallet.ethereum)

    const all = [...fromEthereum, ...extra]
    const deduped: Eip1193Provider[] = []
    for (const provider of all) {
      if (!provider || typeof provider.request !== 'function') continue
      if (!deduped.includes(provider)) deduped.push(provider)
    }

    const score = (provider: Eip1193Provider): number => {
      if (provider.isRabby) return 5
      if (provider.isMetaMask) return 4
      if (provider.isCoinbaseWallet) return 3
      if (provider.isOkxWallet) return 2
      return 1
    }
    return deduped.sort((a, b) => score(b) - score(a))
  }

  const isTerminalWalletError = (err: unknown): boolean => {
    const e = err as { code?: number; message?: string }
    if (e?.code === 4001 || e?.code === -32002 || e?.code === 4902) return true
    return typeof e?.message === 'string' && e.message.includes('wallet request timeout')
  }

  const readProviderSession = async (provider: Eip1193Provider): Promise<{ wallet: string; chainId: string }> => {
    const accounts = (await provider.request({ method: 'eth_accounts', params: [] })) as string[]
    const chainId = ((await provider.request({ method: 'eth_chainId', params: [] })) as string) || ''
    const wallet = (accounts?.[0] as string | undefined) || ''
    return { wallet, chainId }
  }

  const syncExtensionSession = async () => {
    const providers = listInjectedProviders()
    if (providers.length === 0) {
      setExtensionAccount('')
      setExtensionChainId('')
      return
    }
    let fallbackChainId = ''
    for (const provider of providers) {
      try {
        const session = await readProviderSession(provider)
        if (!fallbackChainId && session.chainId) fallbackChainId = session.chainId
        if (session.wallet) {
          setExtensionAccount(session.wallet)
          setExtensionChainId(session.chainId || fallbackChainId)
          return
        }
      } catch {
        // ignore and continue probing next provider
      }
    }
    setExtensionAccount('')
    setExtensionChainId(fallbackChainId)
  }

  const ensurePolygonNetwork = async (provider: Eip1193Provider): Promise<void> => {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
      })
      return
    } catch (err) {
      const e = err as { code?: number }
      if (e?.code !== 4902) throw err
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: POLYGON_CHAIN_ID_HEX,
          chainName: 'Polygon Mainnet',
          rpcUrls: ['https://polygon-rpc.com'],
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          blockExplorerUrls: ['https://polygonscan.com'],
        },
      ],
    })
  }

  const findProviderByWallet = async (providers: Eip1193Provider[], wallet: string): Promise<Eip1193Provider | null> => {
    const target = normalizeAddress(wallet)
    if (!target) return null
    for (const provider of providers) {
      try {
        const session = await readProviderSession(provider)
        if (normalizeAddress(session.wallet) === target) return provider
      } catch {
        // ignore and continue
      }
    }
    return null
  }

  const requestBrowserWalletAddress = async (providers: Eip1193Provider[]): Promise<WalletSelection> => {
    let lastError: unknown = null
    for (const provider of providers) {
      try {
        const accounts = await withTimeout(
          provider.request({ method: 'eth_requestAccounts', params: [] }) as Promise<string[]>,
          60000,
          'wallet request timeout',
        )
        const wallet = (accounts?.[0] as string | undefined) || ''
        if (wallet) return { wallet, provider }
        lastError = new Error(t('wallet.error.no_account'))
      } catch (err) {
        if (isTerminalWalletError(err)) throw err
        lastError = err
      }
    }
    if (lastError) throw lastError
    throw new Error(t('wallet.error.connect_failed'))
  }

  const signWalletChallenge = async (provider: Eip1193Provider, wallet: string, message: string): Promise<string> => {
    try {
      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, wallet],
      })) as string
      if (signature) return signature
    } catch (err) {
      const e = err as { message?: string }
      if (!e?.message?.toLowerCase().includes('invalid') && !e?.message?.toLowerCase().includes('param')) throw err
    }

    const fallbackSignature = (await provider.request({
      method: 'personal_sign',
      params: [wallet, message],
    })) as string
    if (!fallbackSignature) throw new Error(t('wallet.error.sign_failed'))
    return fallbackSignature
  }

  const refreshWallets = async () => {
    const [active, lives, papers] = await Promise.all([onFetchWallet(), onFetchLiveWallets(), onFetchPaperWallets()])
    setActiveLiveAddress(active.wallet_address || '')
    setActiveLiveNote(active.note || '')
    setLiveWallets(lives)
    setPaperWallets(papers)
    setSelectedLiveWalletId((prev) => prev || lives[0]?.wallet_id || '')
    setSelectedPaperWalletId((prev) => prev || papers[0]?.wallet_id || '')
    setStatusKey(active.wallet_address ? 'connected' : 'disconnected')
  }

  useEffect(() => {
    let active = true
    const boot = async () => {
      try {
        await refreshWallets()
        await syncExtensionSession()
      } catch (err) {
        if (active) setDetail(toWalletError(err))
      } finally {
        if (active) setLoaded(true)
      }
    }
    boot().catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const providers = listInjectedProviders()
    if (providers.length === 0) return

    const onAccountsChanged = (accountsRaw?: unknown) => {
      const accounts = Array.isArray(accountsRaw) ? (accountsRaw as string[]) : []
      setExtensionAccount((accounts[0] as string | undefined) || '')
    }
    const onChainChanged = (chainRaw?: unknown) => {
      setExtensionChainId(typeof chainRaw === 'string' ? chainRaw : '')
    }

    for (const provider of providers) {
      provider.on?.('accountsChanged', onAccountsChanged)
      provider.on?.('chainChanged', onChainChanged)
    }

    return () => {
      for (const provider of providers) {
        provider.removeListener?.('accountsChanged', onAccountsChanged)
        provider.removeListener?.('chainChanged', onChainChanged)
      }
    }
  }, [])

  const requireNote = (note: string): string | null => {
    if (note.trim()) return null
    return t('wallet.error.note_required')
  }

  const connectBrowserWallet = async () => {
    const noteError = requireNote(browserWalletNote)
    if (noteError) {
      setStatusKey('bind_failed')
      setDetail(noteError)
      onNotify('error', noteError)
      return
    }

    const injectedProviders = listInjectedProviders()
    if (injectedProviders.length === 0) {
      setStatusKey('metamask_not_found')
      setDetail('')
      onNotify('error', t('wallet.status.metamask_not_found'))
      return
    }

    setBusy(true)
    setStatusKey('connecting')
    setDetail(t('wallet.hint.check_extension'))
    try {
      const selection = await requestBrowserWalletAddress(injectedProviders)
      await ensurePolygonNetwork(selection.provider)
      setDetail(t('wallet.hint.sign_challenge'))
      const challenge = await onCreateBindChallenge()
      const signature = await signWalletChallenge(selection.provider, selection.wallet, challenge.challenge_message)
      await onBindBrowserWallet(selection.wallet, browserWalletNote.trim(), challenge.challenge_message, signature)
      await refreshWallets()
      await syncExtensionSession()
      setBrowserWalletNote('')
      setDetail('')
      onNotify('success', t('toast.wallet_connected'))
    } catch (err) {
      setStatusKey('connect_failed')
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const bindPrivateKey = async () => {
    if (!privateKey.trim()) {
      const msg = t('wallet.error.invalid_private_key')
      setStatusKey('connect_failed')
      setDetail(msg)
      onNotify('error', msg)
      return
    }
    const noteError = requireNote(privateWalletNote)
    if (noteError) {
      setStatusKey('bind_failed')
      setDetail(noteError)
      onNotify('error', noteError)
      return
    }

    setBusy(true)
    setStatusKey('connecting')
    setDetail('')
    try {
      await onBindPrivateKey(privateKey.trim(), privateWalletNote.trim())
      await refreshWallets()
      setPrivateKey('')
      setPrivateWalletNote('')
      onNotify('success', t('toast.private_key_bound'))
    } catch (err) {
      setStatusKey('bind_failed')
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const createPaperWallet = async () => {
    const noteError = requireNote(paperWalletNote)
    if (noteError) {
      setStatusKey('bind_failed')
      setDetail(noteError)
      onNotify('error', noteError)
      return
    }

    setBusy(true)
    setStatusKey('connecting')
    setDetail('')
    try {
      await onCreatePaperWallet(paperFunding, paperWalletNote.trim())
      await refreshWallets()
      setPaperWalletNote('')
      setShowPaperCreatePanel(false)
      setStatusKey('paper_ready')
      onNotify('success', t('toast.paper_wallet_created'))
    } catch (err) {
      setStatusKey('bind_failed')
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const activateLive = async () => {
    if (!selectedLiveWalletId) return
    setBusy(true)
    try {
      await onActivateLiveWallet(selectedLiveWalletId)
      await refreshWallets()
      onNotify('success', t('toast.wallet_activated'))
    } catch (err) {
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const activatePaper = async () => {
    if (!selectedPaperWalletId) return
    setBusy(true)
    try {
      await onActivatePaperWallet(selectedPaperWalletId)
      await refreshWallets()
      onNotify('success', t('toast.paper_wallet_activated'))
    } catch (err) {
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setStatusKey('connecting')
    setDetail('')
    try {
      await onDisconnectWallet()
      await refreshWallets()
      await syncExtensionSession()
      setStatusKey('disconnected_done')
      onNotify('success', t('toast.wallet_disconnected'))
    } catch (err) {
      setStatusKey('bind_failed')
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const reconnectExtension = async () => {
    const providers = listInjectedProviders()
    if (providers.length === 0) {
      setStatusKey('metamask_not_found')
      onNotify('error', t('wallet.status.metamask_not_found'))
      return
    }

    setBusy(true)
    setStatusKey('connecting')
    setDetail(t('wallet.hint.check_extension'))
    try {
      const selection = await requestBrowserWalletAddress(providers)
      await ensurePolygonNetwork(selection.provider)
      const session = await readProviderSession(selection.provider)
      setExtensionAccount(selection.wallet)
      setExtensionChainId(session.chainId || '')
      setDetail('')
      onNotify('success', t('toast.wallet_extension_connected'))
    } catch (err) {
      setStatusKey('connect_failed')
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const syncBoundWalletWithExtension = async () => {
    const providers = listInjectedProviders()
    if (providers.length === 0) {
      setStatusKey('metamask_not_found')
      onNotify('error', t('wallet.status.metamask_not_found'))
      return
    }

    setBusy(true)
    setStatusKey('connecting')
    setDetail(t('wallet.hint.check_extension'))
    try {
      let provider = await findProviderByWallet(providers, extensionAccount)
      let wallet = extensionAccount
      if (!provider || !wallet) {
        const selection = await requestBrowserWalletAddress(providers)
        provider = selection.provider
        wallet = selection.wallet
      }
      await ensurePolygonNetwork(provider)

      const bindNote = activeLiveNote.trim() || browserWalletNote.trim() || t('wallet.note_default_browser')
      setDetail(t('wallet.hint.sign_challenge'))
      const challenge = await onCreateBindChallenge()
      const signature = await signWalletChallenge(provider, wallet, challenge.challenge_message)
      await onBindBrowserWallet(wallet, bindNote, challenge.challenge_message, signature)
      await refreshWallets()
      await syncExtensionSession()
      setDetail('')
      onNotify('success', t('toast.wallet_account_synced'))
    } catch (err) {
      setStatusKey('bind_failed')
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const extensionMismatch =
    isConnected &&
    !!extensionAccount &&
    normalizeAddress(extensionAccount) !== normalizeAddress(activeLiveAddress) &&
    normalizeAddress(activeLiveAddress) !== ''
  const extensionSessionDisconnected = isConnected && !extensionAccount
  const wrongChain = isConnected && !!extensionAccount && !!extensionChainId && extensionChainId.toLowerCase() !== POLYGON_CHAIN_ID_HEX

  const displayStatusKey: typeof statusKey | 'account_mismatch' | 'session_disconnected' | 'wrong_chain' = extensionMismatch
    ? 'account_mismatch'
    : extensionSessionDisconnected
      ? 'session_disconnected'
      : wrongChain
        ? 'wrong_chain'
        : statusKey

  const displayDetail = extensionMismatch
    ? t('wallet.hint.account_mismatch', {
        bound: shortAddress(activeLiveAddress),
        extension: shortAddress(extensionAccount),
      })
    : extensionSessionDisconnected
      ? t('wallet.hint.session_disconnected')
      : wrongChain
        ? t('wallet.hint.wrong_chain')
        : detail

  const deleteLive = async () => {
    if (!selectedLiveWallet) return

    setBusy(true)
    try {
      await onDeleteLiveWallet(selectedLiveWallet.wallet_id)
      setSelectedLiveWalletId('')
      await refreshWallets()
      onNotify('success', t('toast.wallet_deleted'))
    } catch (err) {
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const deletePaper = async () => {
    if (!selectedPaperWallet) return

    setBusy(true)
    try {
      await onDeletePaperWallet(selectedPaperWallet.wallet_id)
      setSelectedPaperWalletId('')
      await refreshWallets()
      onNotify('success', t('toast.wallet_deleted'))
    } catch (err) {
      const msg = toWalletError(err)
      setDetail(msg)
      onNotify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>{t('wallet.title')}</h3>
      <p className="subtle">{t('wallet.network')}</p>
      <p className="subtle">{t('wallet.supported_wallets')}</p>

      {!loaded && <p className="subtle">{t('wallet.connecting_button')}</p>}

      {loaded && isConnected && (
        <div className="wallet-connected-panel">
          <p className="subtle">{t('wallet.connected_address')}</p>
          <CopyableText value={activeLiveAddress} />
          <p className="subtle">
            {t('wallet.extension_account')}:{' '}
            {extensionAccount ? shortAddress(extensionAccount) : t('wallet.extension_not_connected')}
          </p>
          {activeLiveNote && (
            <p className="subtle">
              {t('wallet.note')}: {activeLiveNote}
            </p>
          )}
          {(extensionMismatch || extensionSessionDisconnected || wrongChain) && (
            <div className="wallet-row-actions">
              {(extensionSessionDisconnected || extensionMismatch) && (
                <button type="button" className="secondary" onClick={reconnectExtension} disabled={busy}>
                  {t('wallet.reconnect_extension')}
                </button>
              )}
              {extensionMismatch && (
                <button type="button" onClick={syncBoundWalletWithExtension} disabled={busy}>
                  {t('wallet.sync_current_account')}
                </button>
              )}
            </div>
          )}
          <ConfirmAction
            label={busy ? t('wallet.disconnecting') : t('wallet.disconnect')}
            confirmText={t('wallet.disconnect_confirm')}
            onConfirm={disconnect}
            disabled={busy}
            variant="danger"
          />
        </div>
      )}

      {loaded && !isConnected && (
        <div className="wallet-connect-panel">
          <label>
            {t('wallet.mode.label')}
            <select value={mode} onChange={(e) => setMode(e.target.value as WalletMode)}>
              <option value="browser">{t('wallet.mode.browser')}</option>
              <option value="private_key">{t('wallet.mode.private_key')}</option>
            </select>
          </label>

          {mode === 'browser' && (
            <>
              <label>
                {t('wallet.note')}<span className="required" aria-hidden="true">*</span>
                <input
                  value={browserWalletNote}
                  maxLength={64}
                  placeholder={t('wallet.note_placeholder')}
                  onChange={(e) => setBrowserWalletNote(e.target.value)}
                />
              </label>
              <button onClick={connectBrowserWallet} disabled={busy}>
                {busy ? t('wallet.connecting_button') : t('wallet.connect')}
              </button>
            </>
          )}
          {mode === 'private_key' && (
            <>
              <label>
                {t('wallet.private_key_label')}<span className="required" aria-hidden="true">*</span>
                <input
                  type="password"
                  placeholder={t('wallet.private_key_placeholder')}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                />
              </label>
              <label>
                {t('wallet.note')}<span className="required" aria-hidden="true">*</span>
                <input
                  value={privateWalletNote}
                  maxLength={64}
                  placeholder={t('wallet.note_placeholder')}
                  onChange={(e) => setPrivateWalletNote(e.target.value)}
                />
              </label>
              <button onClick={bindPrivateKey} disabled={busy}>
                {busy ? t('wallet.connecting_button') : t('wallet.bind_private_key')}
              </button>
            </>
          )}
        </div>
      )}

      <div className="wallet-manage">
        <h4>{t('wallet.manage.title')}</h4>

        <p className="subtle">{t('wallet.live_list')}</p>
        {liveWallets.length === 0 && <p className="subtle">{t('wallet.none_saved')}</p>}
        {liveWallets.length > 0 && (
          <div className="wallet-list-dropdown">
            <select value={selectedLiveWalletId} onChange={(e) => setSelectedLiveWalletId(e.target.value)}>
              {liveWallets.map((w) => (
                <option key={w.wallet_id} value={w.wallet_id}>
                  {w.note || t('wallet.note_empty')} - {shortAddress(w.wallet_address)}
                </option>
              ))}
            </select>
            {selectedLiveWallet && (
              <div className="wallet-row">
                <div>
                  <CopyableText value={selectedLiveWallet.wallet_address} />
                  <p className="subtle">
                    {t('wallet.note')}: {selectedLiveWallet.note || t('wallet.note_empty')}
                  </p>
                </div>
                <div className="wallet-row-actions">
                  {selectedLiveWallet.has_private_key && <span className="subtle">{t('wallet.private_key_tag')}</span>}
                  {selectedLiveWallet.is_active ? (
                    <span className="ok">{t('wallet.active')}</span>
                  ) : (
                    <button type="button" onClick={activateLive} disabled={busy}>
                      {t('wallet.activate')}
                    </button>
                  )}
                  <ConfirmAction
                    label={t('wallet.delete')}
                    confirmText={t('wallet.delete_confirm', {
                      note: selectedLiveWallet.note || t('wallet.note_empty'),
                      address: shortAddress(selectedLiveWallet.wallet_address),
                    })}
                    onConfirm={deleteLive}
                    disabled={busy}
                    variant="danger"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <p className="subtle">{t('wallet.paper_list')}</p>
        {!showPaperCreatePanel && (
          <button type="button" onClick={() => setShowPaperCreatePanel(true)} disabled={busy}>
            {t('wallet.create_paper_wallet')}
          </button>
        )}
        {showPaperCreatePanel && (
          <div className="wallet-create-panel">
            <label>
              {t('wallet.note')}<span className="required" aria-hidden="true">*</span>
              <input
                value={paperWalletNote}
                maxLength={64}
                placeholder={t('wallet.note_placeholder')}
                onChange={(e) => setPaperWalletNote(e.target.value)}
              />
            </label>
            <label>
              {t('wallet.funding')}
              <select value={paperFunding} onChange={(e) => setPaperFunding(Number(e.target.value) as 1000 | 5000 | 10000)}>
                <option value={1000}>1000</option>
                <option value={5000}>5000</option>
                <option value={10000}>10000</option>
              </select>
            </label>
            <div className="wallet-row-actions">
              <button type="button" onClick={createPaperWallet} disabled={busy}>
                {busy ? t('wallet.connecting_button') : t('wallet.create_paper_with_funding')}
              </button>
              <button type="button" className="danger" onClick={() => setShowPaperCreatePanel(false)} disabled={busy}>
                {t('wallet.cancel_create')}
              </button>
            </div>
          </div>
        )}

        {paperWallets.length === 0 && <p className="subtle">{t('wallet.none_saved')}</p>}
        {paperWallets.length > 0 && (
          <div className="wallet-list-dropdown">
            <select value={selectedPaperWalletId} onChange={(e) => setSelectedPaperWalletId(e.target.value)}>
              {paperWallets.map((w) => (
                <option key={w.wallet_id} value={w.wallet_id}>
                  {w.note || t('wallet.note_empty')} - {shortAddress(w.wallet_address)}
                </option>
              ))}
            </select>
            {selectedPaperWallet && (
              <div className="wallet-row">
                <div>
                  <CopyableText value={selectedPaperWallet.wallet_address} />
                  <p className="subtle">
                    {t('wallet.note')}: {selectedPaperWallet.note || t('wallet.note_empty')}
                  </p>
                  <p className="subtle">
                    {t('wallet.balance')}: {selectedPaperWallet.balance_usdc.toFixed(2)} USDC
                  </p>
                </div>
                <div className="wallet-row-actions">
                  {selectedPaperWallet.is_active ? (
                    <span className="ok">{t('wallet.active')}</span>
                  ) : (
                    <button type="button" onClick={activatePaper} disabled={busy}>
                      {t('wallet.activate')}
                    </button>
                  )}
                  <ConfirmAction
                    label={t('wallet.delete')}
                    confirmText={t('wallet.delete_confirm', {
                      note: selectedPaperWallet.note || t('wallet.note_empty'),
                      address: shortAddress(selectedPaperWallet.wallet_address),
                    })}
                    onConfirm={deletePaper}
                    disabled={busy}
                    variant="danger"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="subtle">{t(`wallet.status.${displayStatusKey}`)}</p>
      {displayDetail && <p className="error">{displayDetail}</p>}
    </div>
  )
}
