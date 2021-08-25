import {
  AccountId,
  SpecialAccount,
  wrapAccountConnectedWallet,
} from "@malloc/sdk";
import { Account } from "near-api-js";
import { config } from "../config";
import { PoolInfo, PoolInfoFloats } from "../interfaces/ref-interfaces";
import { ftGetTokenMetadata, TokenMetadata, toReadableNumber } from "./token";
import { dedup } from "../utils";

export interface IGetPoolsTouching {
  blacklist?: AccountId[];
  whitelist?: AccountId[];
}

export const getPoolsTouchingInOrOut = async (
  account: Account,
  tokenIn: AccountId,
  tokenOut: AccountId,
  opts?: IGetPoolsTouching
): Promise<PoolInfoFloats[]> => {
  const pools = await getAllPools(account);
  const blacklistFn = (pool: PoolInfoFloats) =>
    !poolHasSomeTokens(opts?.blacklist)(pool);
  const poolsFilteredByBlacklist = opts?.blacklist
    ? pools.filter(blacklistFn)
    : pools;
  const poolsFilteredByBlacklistAndWhitelist = opts?.whitelist
    ? pools.filter(poolHasAllTokens(opts.whitelist))
    : poolsFilteredByBlacklist;
  console.log(poolsFilteredByBlacklistAndWhitelist);
  return poolsFilteredByBlacklistAndWhitelist.filter(
    (pool) => poolHasToken(tokenIn)(pool) || poolHasToken(tokenOut)(pool)
  );
};

const poolToFloats = (
  pool: PoolInfo,
  tokenInfos: { [tokenId: string]: TokenMetadata }
): PoolInfoFloats => {
  const toFloat = (v: string, tokenId: string): number => {
    const formatted = parseFloat(
      toReadableNumber(tokenInfos[tokenId].decimals, v)
    );
    return formatted;
  };
  return {
    ...pool,
    total_fee: pool.total_fee / config.ref.FEE_DIVISOR,
    amounts: pool.amounts.map((v, i) => toFloat(v, pool.token_account_ids[i])),
  };
};

export const getAllTokensUsed = (pools: { token_account_ids: AccountId[] }[]) =>
  dedup(pools.map((pool) => pool.token_account_ids).flat());

export const getAllPools = async (
  account: Account
): Promise<PoolInfoFloats[]> => {
  const numb_pools = await account.viewFunction(
    config.REF_CONTRACT,
    "get_number_of_pools"
  );

  const pools: Omit<PoolInfo, "id">[] = await account.viewFunction(
    config.REF_CONTRACT,
    "get_pools",
    {
      from_index: 0,
      limit: numb_pools,
    }
  );

  const allTokens = getAllTokensUsed(pools);

  // TODO: this can be made more efficient via some lazy loading system
  const allTokenInfos = await Promise.all(
    allTokens.map((token) => ftGetTokenMetadata(account, token))
  );

  const tokensMap = allTokens.reduce(
    (mapping: { [tok: string]: TokenMetadata }, tok, i) => {
      mapping[tok] = allTokenInfos[i];
      return mapping;
    },
    {}
  );

  const poolsMapped = pools.map((pool, i) => {
    return poolToFloats(
      {
        ...pool,
        id: i,
      },
      tokensMap
    );
  });
  return poolsMapped;
};

export const poolHasToken = (token: AccountId) => (
  pool: PoolInfo | PoolInfoFloats
) => {
  const idx = pool.token_account_ids.indexOf(token);
  return idx !== -1 && pool.amounts[idx].toString() !== "0";
};

const poolHasSomeTokens = (tokens: AccountId[]) => (
  pool: PoolInfo | PoolInfoFloats
) => tokens.some((token) => poolHasToken(token)(pool));

const poolHasAllTokens = (tokens: AccountId[]) => (
  pool: PoolInfo | PoolInfoFloats
) => tokens.every((token) => poolHasToken(token)(pool));
