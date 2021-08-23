<script lang="ts">
  import { connect, keyStores } from "@malloc/sdk/dist/near-rexport";
  import { MAX_GAS } from "@malloc/sdk/dist/tx";
  import BN from "bn.js";
  import { stringify } from "postcss";
  import Login from "./components/Login.svelte";
  import getConfig, { baseUrl } from "./utils/config";
  import { nearStore, initNearStore } from "./utils/store";
  import { OptimizerFn } from "./optimizer-lib/interfaces/wasm-interface";
  import { createMallocOps } from "./optimizer-lib";

  let inputToken: string = "banana.ft-fin.testnet";
  let outputToken: string = "wrap.testnet";
  let amount: string = null;
  let loading = false;
  let swapInfo;
  let optimizerFn: OptimizerFn;

  const nearConfig = getConfig("development");

  async function init() {
    // const ret = await module.optimize(JSON.stringify({"nodes":[{"id":0,"edges_out":[{"next_node_indx":1,"token_in_amount":10000.0,"token_out_amount":10000.0,"fee":0.03,"pool_id":100,"fraction":null},{"next_node_indx":1,"token_in_amount":100000.0,"token_out_amount":100000.0,"fee":0.03,"pool_id":101,"fraction":null},{"next_node_indx":2,"token_in_amount":10000.0,"token_out_amount":10000.0,"fee":0.001,"pool_id":102,"fraction":null}]},{"id":1,"edges_out":[]},{"id":2,"edges_out":[{"next_node_indx":1,"token_in_amount":10000.0,"token_out_amount":10000.0,"fee":0.001,"pool_id":103,"fraction":null},{"next_node_indx":1,"token_in_amount":10000.0,"token_out_amount":10000.0,"fee":0.0001,"pool_id":104,"fraction":null}]}]}), 100.0)
    // console.log(ret)
    $nearStore;
    // Initialize connection to the NEAR testnet
    const near = await connect(
      Object.assign(
        { deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } },
        nearConfig
      )
    );
    await initNearStore(near);

    if (!$nearStore?.walletConnection.isSignedIn()) return false;
    const module = await import("../rust/pkg/index");
    optimizerFn = module.optimize;
    // Initializing Wallet based Account. It can work with NEAR testnet wallet that
    // is hosted at https://wallet.testnet.near.org
    return true;
  }

  async function createMallocOpsWrapper(e: Event) {
    e.preventDefault();
    loading = true
    createMallocOps($nearStore.account, inputToken, outputToken, parseFloat(amount), optimizerFn);
    loading = false
  }

  function logout() {
    $nearStore.walletConnection.signOut();
    window.location.reload();
  }
</script>

<main>
  <!-- {init()} -->
  {#await init()}
    Beep boop, this may take a sec. Loading...
  {:then signedIn}
    {#if signedIn}
      <!-- TODO: navbar -->
      <button class="log-out" on:click={logout}>Logout</button>
      <form action="" on:submit={createMallocOpsWrapper}>
        Input Token: <input type="text" bind:value={inputToken} /><br />
        Output Token: <input type="text" bind:value={outputToken} /><br />
        Amount: <input type="text" bind:value={amount} /><br />
        <button type="sumbit">Submit</button>
      </form>
      {#if loading}
        Loading... This may take a sec cause this code is very slow right now.
        (Unoptimized optimization (; )
      {/if}
      {#if swapInfo && !loading}
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
