import { AccountId } from "@malloc/sdk";
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
  return number.toPrecision(decimals + 1).replace(".", "");
};
