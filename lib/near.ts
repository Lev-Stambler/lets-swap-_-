import { keyStores, Near } from "@malloc/sdk/dist/near-rexport";
import { config } from "./config";

export const near = new Near({
  networkId: config.near.NETWORK_ID,
  nodeUrl: config.near.NODE_URL,
  deps: { keyStore: new keyStores.InMemoryKeyStore() },
});