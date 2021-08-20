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

export const getPoolsTouchingInOrOut = async (
  account: Account,
  tokenIn: AccountId,
  tokenOut: AccountId
): Promise<PoolInfo[]> => {
  const pools = await getAllPools(account);
  return pools.filter(
    (pool) => poolHasToken(tokenIn)(pool) || poolHasToken(tokenOut)(pool)
  );
};

export const getAllPools = async (account: Account): Promise<PoolInfo[]> => {
  const numb_pools = await account.viewFunction(
    config.REF_CONTRACT,
    "get_number_of_pools"
  );
  const pools: any[] = await account.viewFunction(
    config.REF_CONTRACT,
    "get_pools",
    { from_index: 0, limit: numb_pools }
  );
  return pools.map((pool, i) => {
    return {
      ...pool,
      id: i,
    };
  });
};

export const poolHasToken = (token: AccountId) => (pool: PoolInfo) => {
  const idx = pool.token_account_ids.indexOf(token);
  return idx !== -1 && pool.amounts[idx].toString() !== "0";
};
