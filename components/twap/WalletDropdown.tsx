"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown, Wallet, LogOut, Copy, Check, ExternalLink } from "lucide-react";

export function WalletDropdown() {
  const { connect, disconnect, account, connected, wallets } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const address = account?.address?.toString();
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setIsOpen(false);
  };

  if (connected && address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 glass rounded-xl hover:bg-white/5 transition-colors"
        >
          <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
          <span className="text-sm font-medium text-white">{shortAddress}</span>
          <ChevronDown
            className={`w-4 h-4 text-white/50 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 glass rounded-xl overflow-hidden shadow-xl z-[10000]">
            <div className="p-4 border-b border-white/10">
              <p className="text-xs text-white/50 mb-1">Connected Wallet</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-white flex-1 truncate">
                  {address}
                </p>
                <button
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/50" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-2">
              <a
                href={`https://explorer.movementnetwork.xyz/account/${address}?network=porto+testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-white/50" />
                <span className="text-sm text-white">View on Explorer</span>
              </a>

              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors text-red-400"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-movement-yellow text-black font-semibold rounded-xl hover:bg-movement-yellow-light transition-colors"
      >
        <Wallet className="w-4 h-4" />
        <span className="text-sm">Connect Wallet</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 glass rounded-xl overflow-hidden shadow-xl z-[10000]">
          <div className="p-3 border-b border-white/10">
            <p className="text-sm font-medium text-white">Connect a Wallet</p>
            <p className="text-xs text-white/50">
              Choose a wallet to connect to this app
            </p>
          </div>

          <div className="p-2">
            {wallets && wallets.length > 0 ? (
              wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => handleConnect(wallet.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors"
                >
                  {wallet.icon && (
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="w-6 h-6 rounded"
                    />
                  )}
                  <span className="text-sm text-white">{wallet.name}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-white/50">No wallets detected</p>
                <p className="text-xs text-white/30 mt-1">
                  Install Petra, Pontem, or another Aptos wallet
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
