<script lang="ts">
  import { connect, keyStores } from "@malloc/sdk/dist/near-rexport";
  import { MAX_GAS } from "@malloc/sdk/dist/tx";
  import BN from "bn.js";
  import { stringify } from "postcss";
  import Login from "./components/Login.svelte";
  import getConfig, { baseUrl } from "./utils/config";

  let inputToken: string = "banana.ft-fin.testnet";
  let outputToken: string = "wrap.testnet";
  let amount: string = null;
  let loading = false;
  let swapInfo;

  const nearConfig = getConfig("development");

  async function init() {
    // Initialize connection to the NEAR testnet
    // const near = await connect(
    //   Object.assign(
    //     { deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } },
    //     nearConfig
    //   )
    // );
    // await initNearStore(near);
    // Initializing Wallet based Account. It can work with NEAR testnet wallet that
    // is hosted at https://wallet.testnet.near.org
  }

  const getTokenSwapUrl = (
    inTok: string,
    outTok: string,
    amount: number
  ): string => `${baseUrl}/get-swap/${inTok}/${outTok}/${amount}`;

  async function getTokenSwaps(e: Event) {
    e.preventDefault();
    loading = true;
    // TODO: config
    let amountParsed: number;
    try {
      amountParsed = parseFloat(amount);
    } catch (e) {
      alert(`Failed to parse amount value ${amount}`);
      return;
    }
    try {
      const ret = await fetch(
        getTokenSwapUrl(inputToken, outputToken, amountParsed)
      );
      swapInfo = await ret.json();
    } catch (e) {
      alert(`Failed to get a result with error ${e}`);
    }

    loading = false;
  }

  function logout() {
    // $nearStore.walletConnection.signOut();
    window.location.reload();
  }
</script>

<main>
  {#await init()}
    Loading.
  {:then value}
    <!-- {#if $nearStore?.walletConnection.isSignedIn()} -->
    {#if true}
      <!-- TODO: navbar -->
      <button class="log-out" on:click={logout}>Logout</button>
      <form action="" on:submit={getTokenSwaps}>
        Input Token: <input type="text" bind:value={inputToken} /><br />
        Output Token: <input type="text" bind:value={outputToken} /><br />
        Amount: <input type="text" bind:value={amount} /><br />
        <button type="sumbit">Submit</button>
      </form>
      {#if loading}
        Loading... This may take a sec cause this code is very slow right now.
        (Unoptimized optimization (; )
      {/if}
      {#if swapInfo}
        <h1>Result</h1>
        <p>{JSON.stringify(swapInfo, null, 3)}</p>
      {/if}
    {:else}
      <Login />
    {/if}
  {:catch error}
    An error occured {JSON.stringify(error)}
    <!-- init() was rejected -->
  {/await}
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
