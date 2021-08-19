import {
  AccountId,
  SpecialAccount,
  wrapAccountConnectedWallet,
} from "@malloc/sdk";
import { Near, Account } from "near-api-js";
import * as keyStores from "near-api-js/lib/key_stores";
import { config } from "./config";
import { findOpt } from "./get-optimized";
import { PoolInfo } from "./interfaces/ref-interfaces";

const near = new Near({
  networkId: config.near.NETWORK_ID,
  nodeUrl: config.near.NODE_URL,
  deps: { keyStore: new keyStores.InMemoryKeyStore() },
});

export const getPools = async (
  account: Account,
  tokenIn: AccountId,
  tokenOut: AccountId
): Promise<PoolInfo[]> => {
  const pools = await getAllPools(account);
  return pools.filter(
    (pool) => poolHasToken(pool, tokenIn) && poolHasToken(pool, tokenOut)
  );
};

export const getAllPools = async (account: Account): Promise<PoolInfo[]> => {
  const numb_pools = await account.viewFunction(
    config.REF_CONTRACT,
    "get_number_of_pools"
  );
  const pools: PoolInfo[] = await account.viewFunction(
    config.REF_CONTRACT,
    "get_pools",
    { from_index: 0, limit: numb_pools }
  );
  return pools;
};

const poolHasToken = (pool: PoolInfo, token: AccountId): boolean =>
  pool.token_account_ids.some((token_account) => token_account === token);

near.account(config.near.PROXY_ACCOUNT).then(async (account) => {
  const tokenIn = "wrap.testnet";
  const tokenOut = "ndai.ft-fin.testnet";
  const pools = await getPools(account, tokenIn, tokenOut);
  await findOpt(tokenIn, tokenOut, pools, 10);
});
