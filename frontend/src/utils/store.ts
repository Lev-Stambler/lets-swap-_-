import {
  ConnectedWalletAccount,
  Connection,
  Near,
  WalletConnection,
} from "@malloc/sdk/dist/near-rexport";
// TODO: change back to package form
import {
  MallocClient,
  SpecialAccount,
  SpecialAccountConnectedWallet,
  wrapAccountConnectedWallet,
} from "@malloc/sdk";
// } from "../../../../malloc/malloc-near-2/ts-packages/malloc-client/lib/malloc-client";
import { writable } from "svelte/store";
import getConfig from "./config";

interface NearStore {
  walletConnection: WalletConnection;
  config: ReturnType<typeof getConfig>;
  account?: SpecialAccount;
  mallocClient?: MallocClient<SpecialAccountConnectedWallet>;
}

export const nearStore = writable<null | NearStore>(null);

export const initNearStore = (near: Near) => {
  const config = getConfig("development");

  const account = wrapAccountConnectedWallet(
    near
  ) as SpecialAccountConnectedWallet;

  const mallocClient = new MallocClient(account, config.contractName);

  nearStore.set({
    walletConnection: account.walletConnection,
    config,
    mallocClient,
    account,
  });
};
