// ///////////////////////////////////////////////////////////////////////////////////////
// Imports and constants definition
// ///////////////////////////////////////////////////////////////////////////////////////

import { Constr, Data } from "https://deno.land/x/lucid@0.10.7/mod.ts";

//import * as lucid from "https://deno.land/x/lucid@0.10.7/mod.ts";

export const key_path = "../keys/";
export const plutus_path = "../";

export const Status = {
  NOT_STARTED: new Constr(0, []),
  STARTED: new Constr(1, []),
  OUTBID: new Constr(2, []),
  ENDED: new Constr(3, []),
};

export const Redeemer = {
  Start: Data.to(new Constr(0, [])),
  Bid: Data.to(new Constr(1, [])),
  Withdraw: Data.to(new Constr(2, [])),
  End: Data.to(new Constr(3, [])),
};

export const seller_name = "alice";
export const object = "oggetto";
export const deadline = 1698316320n * 1000n; // Thu Oct 26 2023 10:32:00 GMT+0000

// //////////////////////////////////////////////////////////////////////////////////////
