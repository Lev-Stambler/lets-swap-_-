import { AccountId, IRunEphemeralConstruction } from "@malloc/sdk";

const TRADE_INSTR = "tradeInst";

export const storeTradeInstr = (instr: IRunEphemeralConstruction) => {
  window.localStorage.setItem(TRADE_INSTR, JSON.stringify(instr));
};

export const clearTradeInstr = () => {
  window.localStorage.removeItem(TRADE_INSTR);
};

export const getTradeInstr = (): IRunEphemeralConstruction | null => {
  const str = window.localStorage.getItem(TRADE_INSTR);
  if (str) {
    return JSON.parse(str) as IRunEphemeralConstruction;
  }
  return null;
};

interface SetInfo {
  tokenIn: string;
  tokenOut: string;
  amount: string;
}

const SET_INFO = "setInfo";

export const storeSetInfo = (info: SetInfo) => {
  window.localStorage.setItem(SET_INFO, JSON.stringify(info));
};

export const getSetInfo = (): SetInfo | null =>
  JSON.parse(window.localStorage.getItem(SET_INFO) || null);
