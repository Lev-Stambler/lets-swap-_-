import { AccountId } from "@malloc/sdk";
import BN from "bn.js";

export interface PoolInfo {
  id: number;
  pool_kind: string;
  token_account_ids: AccountId[];
  amounts: string[];
  // Whole number out of 10_000
  total_fee: number;
  shares_total_supply: string;
}

export interface PoolInfoFloats {
  id: number;
  pool_kind: string;
  token_account_ids: AccountId[];
  // Float
  amounts: number[];
  // Float
  total_fee: number;
  shares_total_supply: string;
}
