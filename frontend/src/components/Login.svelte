<script lang="ts">
  import {nearStore} from '../utils/store'

  function login() {
    $nearStore?.walletConnection.requestSignIn($nearStore.config.contractName, "Malloc Contract");
  }
</script>

<h1>Login</h1>
<p>
  To make use of the NEAR blockchain, you need to sign in. The button below will
  sign you in using NEAR Wallet.
</p>
<p>
  By default, when your app runs in "development" mode, it connects to a test
  network ("testnet") wallet. This works just like the main network ("mainnet")
  wallet, but the NEAR Tokens on testnet aren't convertible to other currencies
  – they're just for testing!
</p>
<p>Go ahead and click the button below to try it out:</p>
<p>
  <button on:click={login}>Sign in</button>
</p>
