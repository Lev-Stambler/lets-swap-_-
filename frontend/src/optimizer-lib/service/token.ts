import { AccountId } from "@malloc/sdk";
import BN from "bn.js";
import { Account } from "near-api-js";

export interface TokenMetadata {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

export const ftGetTokenMetadata = async (
  account: Account,
  token_id: AccountId
): Promise<TokenMetadata> => {
  try {
    const metadata = await account.viewFunction(token_id, "ft_metadata", {});

    return {
      id: token_id,
      ...metadata,
    };
  } catch (err) {
    return {
      id: token_id,
      name: token_id,
      symbol: token_id?.split(".")[0].slice(0, 8),
      decimals: 6,
    };
  }
};

export const getTokenBal = async (
  token_id: AccountId,
  account: AccountId,
  caller: Account
): Promise<BN> => {
  const bal = await caller.viewFunction(token_id, "ft_balance_of", {
    account_id: account,
  });
  return new BN(bal);
};
// TODO: a swap exceeds prepaid gas, bump that ## up a bit pls
// TODO: fix FT bug

export const toReadableNumber = (
  decimals: number,
  number: string = "0"
): string => {
  if (!decimals) return number;

  const wholeStr = number.substring(0, number.length - decimals) || "0";
  const fractionStr = number
    .substring(number.length - decimals)
    .padStart(decimals, "0")
    .substring(0, decimals);

  return `${wholeStr}.${fractionStr}`.replace(/\.?0+$/, "");
};

export const fromReadableNumber = (
  decimals: number,
  number: number
): string => {
  const split = number.toString().split(".");
  const wholePart = split[0];
  const fracPart = split[1] || "";
  if (split.length > 2 || fracPart.length > decimals) {
    throw new Error(`Cannot parse '${number}' as token amount`);
  }
  return trimLeadingZeroes(wholePart + fracPart.padEnd(decimals, "0"));
};

function trimLeadingZeroes(value: string) {
  value = value.replace(/^0+/, "");
  if (value === "") {
    return "0";
  }
  return value;
}
