
import { useRef, useState } from "preact/hooks";


import { Constr, Data, fromText, Lucid  } from "lucid/mod.ts";



import { Input } from "../components/Input.tsx";
import { Button } from "../components/Button.tsx";
import {  readValidators } from "../utils/utils.ts";

export interface SellerProps {
  lucid: Lucid;
}

export default function Seller({ lucid }: SellerProps) {
  const [object, setObject] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [bidAmount, setBidAmount] = useState<string>("");
  const [auctionCreateTxHash, setAucCreateTxHash] = useState<string>("");
  const [auctionStartTxHash, setAuctionStartTxHash] = useState<string | null>(
    null,
  );

  const [waitingAuctionTx, setWaitingAuctionTx] = useState<boolean>(false);

  const auctionAddressRef = useRef<string | null>(null); // Use a ref for the auction address

  const onSubmit = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error("Lucid is not initialized");
      return;
    }

    const validators = readValidators();
    console.log("validators:", validators);


    const scriptHex = {
      type: validators.auction.type,
      script: validators.auction.script,
    };

    const scriptAddress = lucid.utils.validatorToAddress(scriptHex);
    console.log("scriptAddress:", scriptAddress);

    auctionAddressRef.current = scriptAddress; // Set the auction address in the ref

    try {
      const sellerAddressDetails = lucid.utils.getAddressDetails(
        await lucid.wallet.address(),
      );
      console.log("sellerAddressDetails:", sellerAddressDetails);

      const sellerPublicKeyHash = sellerAddressDetails.paymentCredential?.hash;
      const stakeCredential = sellerAddressDetails.stakeCredential?.hash;

      console.log("sellerPublicKeyHash:", sellerPublicKeyHash);

            
      setWaitingAuctionTx(true);
      const auctionDatum = Data.to(
        new Constr(0, [
          sellerPublicKeyHash, // seller
          fromText(object), // object
          BigInt(deadline), // deadline
          new Constr(0, []), // NOT_STARTED status
          sellerPublicKeyHash, // bidder
          stakeCredential,     
          BigInt(0), // Starting amount
        ]),
      );
      
      const lovelace = Number(2) * 1000000; // Use a minimum of 2 ADA to cover the transaction cost

      const timeOffset = 60 * 1000; // one minute
      const currentTime = new Date().getTime() - timeOffset;

      const tx = await lucid
        .newTx()
        .payToContract(scriptAddress,{ inline: auctionDatum }, {
          lovelace: BigInt(lovelace),
        }).validFrom(currentTime)
        .complete();
  
    console.log("Transaction constructed:", tx);

    const txSigned = await tx.sign().complete();
    console.log("Transaction signed:", txSigned);

    const txHash = await txSigned.submit();
    console.log("Transaction submitted:", txHash);

      const success = await lucid.awaitTx(txHash);
      console.log("Transaction success:", success);

      setTimeout(() => {
        setWaitingAuctionTx(false);

        if (success) {
          setAucCreateTxHash(txHash);
        }
      }, 3000);
    } catch (error) {
      console.error("Error creating auction:", error);
      setWaitingAuctionTx(false);
    }
  };
  const startAuction = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error("Lucid is not initialized");
      return;
    }

    const auctionAddress = auctionAddressRef.current; // Get the auction address from the ref
    if (!auctionAddress) {
      console.error("Auction address is not set");
      return;
    }

    console.log("SmartContractAddress:", auctionAddress);

    setWaitingAuctionTx(true);

    const validators = readValidators();
    console.log("validators:", validators);
    const contractScript = {
      type: validators.auction.type,
      script: validators.auction.script,
    };

    const sellerAddressDetails = lucid.utils.getAddressDetails(
      await lucid.wallet.address(),
    );
    const sellerPublicKeyHash = sellerAddressDetails.paymentCredential?.hash;
    const stakeCredential = sellerAddressDetails.stakeCredential?.hash;

    const lovelace = Number(bidAmount) * 1000000;
    console.log("lovelace:", lovelace);
    try {
      const startDatum = Data.to(
        new Constr(0, [
          sellerPublicKeyHash, // seller
          fromText(object), // object
          BigInt(deadline), // deadline
          new Constr(1, []), // STARTED status
          sellerPublicKeyHash, // Initial bidder is seller
          stakeCredential,
          BigInt(lovelace), // Starting amount
        ]),
      );

      const redeemer = Data.to(new Constr(0, [])); // start redeemer

      console.log("Start datum created:", startDatum);

      const utxos = await lucid.utxosAt(auctionAddress);
      console.log("utxi from transacrtion", utxos);

      // Get the last UTXO (most recent)
      const auctionUtxo = utxos[utxos.length - 1];
     console.log("the latest UTXo from the list", auctionUtxo);

      const timeOffset = 60 * 1000; // one minute
      const currentTime = new Date().getTime() - timeOffset; 
      
       // Extract lovelace from the UTXO's assets
       const lovelacetoPayback =  auctionUtxo.assets;

       console.log("lovelacetoPayback",lovelacetoPayback )
     
      const tx = await lucid
        .newTx()
        .collectFrom([auctionUtxo], redeemer)
        .addSigner(await lucid.wallet.address())
        .payToContract(auctionAddress, {inline:startDatum }, { lovelace: BigInt(lovelace) })
        .attachSpendingValidator(contractScript)
        .validFrom(currentTime)
        .payToAddress(await lucid.wallet.address(),lovelacetoPayback
        )
        .complete();
    
      console.log("Transaction constructed:", tx);

      const txSigned = await tx.sign().complete();
      console.log("Transaction signed:", txSigned);

      const txHash = await txSigned.submit();
      console.log("Transaction submitted:", txHash);

      const success = await lucid.awaitTx(txHash);
      console.log("Transaction success:", success);

      setTimeout(() => {
        setWaitingAuctionTx(false);

        if (success) {
          setAuctionStartTxHash(txHash);
        }
      }, 3000);
    } catch (error) {
      console.error("Error starting auction:", error);
      setWaitingAuctionTx(false);
    }
  };

  return (
    <div>
      <form class="mt-10 grid grid-cols-1 gap-y-8" onSubmit={onSubmit}>
        <Input
          type="text"
          id="object"
          value={object}
          onInput={(e) => setObject(e.currentTarget.value)}
        >
          Auction Object
        </Input>

        <Input
          type="text"
          id="deadline"
          value={deadline}
          onInput={(e) => setDeadline(e.currentTarget.value)}
        >
          Deadline (POSIX time)
        </Input>

        <Input
          type="number"
          id="bidAmount"
          value={bidAmount}
          onInput={(e) => setBidAmount(e.currentTarget.value)}
        >
          Starting Bid Amount (ADA)
        </Input>

        <Button
          type="submit"
          disabled={waitingAuctionTx || !!auctionCreateTxHash}
        >
          {waitingAuctionTx ? "Waiting for Tx..." : "Create Auction"}
        </Button>

        {auctionCreateTxHash && (
          <>
            <h3 class="mt-4 mb-2">Auction Created</h3>
            <a
              class="mb-2"
              target="_blank"
              href={`https://preview.cardanoscan.io/transaction/${auctionCreateTxHash}`}
            >
              {auctionCreateTxHash}
            </a>
          </>
        )}

        {auctionAddressRef.current &&
          (
            <>
              <h3 class="mt-4 mb-2">Auction Address</h3>
              <a
                class="mb-2"
                target="_blank"
                href={`https://preview.cardanoscan.io/address/${auctionAddressRef.current}`}
              >
                {auctionAddressRef.current}
              </a>
            </>
          )}
      </form>

      {auctionCreateTxHash && (
        <Button
          onClick={startAuction}
        >
          {waitingAuctionTx ? "Waiting for Tx..." : "Start Auction"}
        </Button>
      )}

      {auctionStartTxHash && (
        <>
          <h3 class="mt-4 mb-2">Auction Started</h3>
          <a
            class="mb-2"
            target="_blank"
            href={`https://preview.cardanoscan.io/transaction/${auctionStartTxHash}`}
          >
            {auctionStartTxHash}
          </a>
        </>
      )}
    </div>
  );
}
