export const getPhantomProvider = () => {
  if ("solana" in window) {
    const provider = window.solana;
    if (!window.solana.isConnected){
      window.solana.connect();
    }
    if ("isPhantom" in provider && provider.isPhantom) {
      return provider;
    }
  } else {
    alert(`Please install the phantom wallet from https://phantom.app/`);
  }
};
