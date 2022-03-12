import { useState } from "react";

import { Provider } from "./utils";

import Connected from "./components/Connected";

export default function App() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);

  const getProvider = async () => {
    if ("solana" in window) {
      const provider = window.solana;
      if (provider && provider.isPhantom) {
        return provider;
      }
    }
    window.open("https://www.phantom.app/", "_blank");
    return null;
  };

  const toggleWalletConnection = async () => {
    console.log(`Provider: ${JSON.stringify(provider?.publicKey.toString())}`);
    if (provider) {
      setProvider(null);
    } else {
      try {
        const newProvider = await getProvider();
        if (newProvider) {
          await newProvider.connect();
          setProvider(newProvider);
          console.log(`New provider: ${JSON.stringify(newProvider.publicKey.toString())}`);
        }
      } catch (e) {
        console.error(e);
        if (e instanceof Error) {
          alert(`Error: ${e.message}`);
        } else {
          alert("Error: Unknown error occurred");
        }
      }
    }
  };

  return (
    <div>
      <h1>Create and stake your own token</h1>
      {
        !!provider ? (
          <div>
            <p><strong>Public Key:</strong> {provider.publicKey.toString()}</p>
          </div>
        ) : null
      }

      <button onClick={toggleWalletConnection} disabled={loading}>
        {!provider ? "Connect Wallet" : "Disconnect Wallet"}
      </button>

      {provider ? <Connected provider={provider} loading={loading} setLoading={setLoading} /> : null}
    </div>
  )
}
