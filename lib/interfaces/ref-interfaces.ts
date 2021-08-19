import { AccountId } from "@malloc/sdk";
import BN from "bn.js";

export interface PoolInfo {
  pool_king: string;
  token_account_ids: AccountId[];
  amounts: BN[];
  total_fee: number;
  shares_total_supply: BN;
}
