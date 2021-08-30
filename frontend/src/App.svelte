<script lang="ts">
  import { connect, keyStores } from "@malloc/sdk/dist/near-rexport";
  import Textfield from "@smui/textfield";
  import Button, { Label } from "@smui/button";
  import {
    clearTradeInstr,
    getSetInfo,
    getTradeInstr,
    storeSetInfo,
    storeTradeInstr,
  } from "./utils/db";

  import BN from "bn.js";
  import { stringify } from "postcss";
  import Login from "./components/Login.svelte";
  import getConfig, { baseUrl } from "./utils/config";
  import { nearStore, initNearStore } from "./utils/store";
  import { OptimizerFn } from "./optimizer-lib/interfaces/wasm-interface";
  import { createMallocOps } from "./optimizer-lib";
  import { getPoolsTouchingInOrOut } from "./optimizer-lib/service/get-pools";
  import { buildDirectedGraph } from "./optimizer-lib/service/graph";
  import {
    fromReadableNumber,
    ftGetTokenMetadata,
    getTokenBal,
    toReadableNumber,
  } from "./optimizer-lib/service/token";
  import { AccountId, IRunEphemeralConstruction } from "@malloc/sdk";
  import { DirectedGraph } from "./optimizer-lib/interfaces/graph-interfaces";

  const PRECONSTRUCTION_DONE_FLAG = "preconstructiondone";
  let outputToken: string = "wrap.testnet";
  let inputToken: string = "rft.tokenfactory.testnet";
  let amount: string = null;
  let loading = false;
  let swapInfo;
  let optimizerFn: OptimizerFn;
  let tradeInstr: IRunEphemeralConstruction;

  const nearConfig = getConfig("development");

  const blacklist = ["usdc.ft-fin.testnet"];

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
    if (window.location.href.includes(PRECONSTRUCTION_DONE_FLAG)) {
      tradeInstr = getTradeInstr();
    }
    const setInfo = getSetInfo();
    if (setInfo) {
      inputToken = setInfo.tokenIn;
      outputToken = setInfo.tokenOut;
      amount = setInfo.amount;
    }
    // Initializing Wallet based Account. It can work with NEAR testnet wallet that
    // is hosted at https://wallet.testnet.near.org
    return true;
  }

  async function preConstruction(G: DirectedGraph, tokens: AccountId[]) {
    const {
      txs: registerAllToks,
    } = await $nearStore.mallocClient.registerAccountDeposits(
      tokens.filter((tok, i) => G.nodes[i].edges_out.length > 0),
      [getConfig().refSwapActionContract]
    );
    // TODO: w/ malloc client what if account does not exist here?
    const {
      txs: registerMallocAndCurrentAccount,
    } = await $nearStore.mallocClient.registerAccountDeposits(
      [inputToken, outputToken],
      [$nearStore.account.accountId, getConfig().contractName],
      {
        executeTransactions: false,
      }
    );

    const tokMetadata = await ftGetTokenMetadata(
      $nearStore.account,
      inputToken
    );
    // TODO: I think I have a bug in my ft balances...
    console.log(
      "DEPOSITING",
      fromReadableNumber(tokMetadata.decimals, parseFloat(amount))
    );
    const bal = await $nearStore.account.viewFunction(
      inputToken,
      "ft_balance_of",
      {
        account_id: $nearStore.account.accountId,
      }
    );
    const { txs: depositTx } = await $nearStore.mallocClient.deposit(
      fromReadableNumber(tokMetadata.decimals, parseFloat(amount)),
      inputToken
    );
    const { txs: addAcccessKey } = await $nearStore.mallocClient.addAccessKey();
    await $nearStore.mallocClient.executeMultipleTransaction(
      [
        ...registerAllToks,
        ...registerMallocAndCurrentAccount,
        ...depositTx,
        ...addAcccessKey,
      ],
      {
        callbackUrl: `${window.location.href}?${PRECONSTRUCTION_DONE_FLAG}=true`,
      }
    );
  }

  async function buildTrade() {
    loading = true;
    clearTradeInstr();
    const pools = await getPoolsTouchingInOrOut(
      $nearStore.account,
      inputToken,
      outputToken,
      {
        blacklist,
      }
    );
    const { graph: G, tokens } = buildDirectedGraph(
      pools,
      inputToken,
      outputToken
    );
    const tokMetadata = await ftGetTokenMetadata(
      $nearStore.account,
      inputToken
    );
    const { instr, expectedOut } = await createMallocOps(
      G,
      tokens,
      $nearStore.account,
      inputToken,
      outputToken,
      parseFloat(amount),
      $nearStore.account.accountId,
      optimizerFn
    );
    const confirmRet = confirm(
      `Expecting ${expectedOut} ${outputToken}. Is that ok?`
    );
    if (!confirmRet) {
      loading = false;
      return;
    }
    storeTradeInstr(instr);
    storeSetInfo({
      tokenIn: inputToken,
      tokenOut: outputToken,
      amount: amount,
    });
    await preConstruction(G, tokens);
    loading = false;
  }

  async function executeTheTrade() {
    loading = true;
    try {
      const metadata = await ftGetTokenMetadata(
        $nearStore.account,
        outputToken
      );
      const originalOutBal = await getTokenBal(
        outputToken,
        $nearStore.account.accountId,
        $nearStore.account
      );
      await $nearStore.mallocClient.runEphemeralConstruction(tradeInstr);
      const finalOutBal = await getTokenBal(
        outputToken,
        $nearStore.account.accountId,
        $nearStore.account
      );
      alert(
        `Successfully completed! Your balance of ${outputToken} is now ${toReadableNumber(
          metadata.decimals,
          finalOutBal.toString()
        )}, and originally was ${toReadableNumber(
          metadata.decimals,
          originalOutBal.toString()
        )}. You made a total of ${toReadableNumber(
          metadata.decimals,
          finalOutBal.sub(originalOutBal).toString()
        )}`
      );
      clearTradeInstr();
      loading = false;
    } catch (e) {
      alert(`An error occured: ${e.message || e}`);
      loading = false;
      throw e;
    }
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
      <div class="topBar">
        <Button variant="outlined" class="log-out" on:click={logout}
          >Logout</Button
        >
      </div>
      <div class="banner">
        <h1>Let's Swap</h1>
        <p>Use multiple liquidity pools to get the best output for a swap</p>
      </div>
      <form action="" on:submit={(e) => e.preventDefault()}>
        <Textfield bind:value={inputToken} label="Input Token Account" />
        <Textfield bind:value={outputToken} label="Output Token Account" />
        <Textfield bind:value={amount} label="Amount of input token" />
        <div class="execBtns">
          <Button
            variant="outlined"
            on:click={() => {
              clearTradeInstr();
              window.location.reload();
            }}
            disabled={!tradeInstr || loading}>Clear built trade</Button
          >
          <Button
            variant="raised"
            on:click={() => buildTrade()}
            disabled={tradeInstr || loading}
            >Build the trade and deposit tokens</Button
          >
          <Button
            variant="raised"
            disabled={!tradeInstr || loading}
            on:click={() => executeTheTrade()}>Execute the trade</Button
          >
        </div>
        <!-- <button type="sumbit">Submit</button> -->
      </form>
      {#if loading}
        Loading...
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

<!-- 
  TODO: make it return min amount out (just 1 for now is fine)
  make it return tokens out

  Then, integrate with malloc ops. Feel free to change malloc ops to be used better
  (like make tokens out actions/ construction more obvious that order matters)
 -->
<style>
  .topBar {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto;
    justify-content: end;
    padding-bottom: 2rem;
  }

  .execBtns {
    padding: 1rem;
    display: grid;
    gap: 1rem;
  }

  main {
    text-align: center;
    padding: 1em;
    margin: 0 auto;
    display: grid;
    justify-content: center;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  form {
    max-width: 400px;
    display: grid;
    grid-template-columns: 1fr;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
