import {
  ConnectedWalletAccount,
  Connection,
  Near,
  WalletConnection,
} from "@malloc/sdk/dist/near-rexport";
// TODO: change back to package form
import { mallocSdk } from "@malloc/ops";
import { writable } from "svelte/store";
import getConfig from "./config";

interface NearStore {
  walletConnection: WalletConnection;
  config: ReturnType<typeof getConfig>;
  account?: mallocSdk.SpecialAccount;
  mallocClient?: mallocSdk.MallocClient<mallocSdk.SpecialAccountConnectedWallet>;
}

export const nearStore = writable<null | NearStore>(null);

export const initNearStore = (near: Near) => {
	console.log("AAA")
  const config = getConfig("development");

  const account = mallocSdk.wrapAccountConnectedWallet(
    near
  ) as mallocSdk.SpecialAccountConnectedWallet;

  const mallocClient = new mallocSdk.MallocClient(account, config.contractName);

	console.log("AAA")
  nearStore.set({
    walletConnection: account.walletConnection,
    config,
    mallocClient,
    account,
  });
};
