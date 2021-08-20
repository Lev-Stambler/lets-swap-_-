import { AccountId } from "@malloc/sdk";
import BN from "bn.js";

export interface PoolInfo {
  id: number;
  pool_kind: string;
  token_account_ids: AccountId[];
  amounts: string[];
  total_fee: number;
  shares_total_supply: string;
}
