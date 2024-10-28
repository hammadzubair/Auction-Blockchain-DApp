import { useRef, useState } from "preact/hooks";
import {
  Constr,
  Data,
  fromHex,
  Lucid,
  OutRef,
} from "lucid/mod.ts";
import { Input } from "../components/Input.tsx";
import { Button } from "../components/Button.tsx";
import { readValidators } from "../utils/utils.ts";


interface BidderProps {
  lucid: Lucid;
}

export default function Bidder({ lucid }: BidderProps) {
  const [auctionAddress, setAuctionAddress] = useState<string>("");
  const [auctionDetails, setAuctionDetails] = useState<any | null>(null);
  const [bidAmount, setBidAmount] = useState<string>("");
  const [bidderAddr, setBidderAddr] = useState<string>("");
  const [bidderAddrStack, setBidderAddrStack] = useState<string>("");
  const [prevAmount, setprevAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [bidTxHash, setBidxHash] = useState<string>("");
  const [withdrawBidTxHash, setWithdrawBidTxHash] = useState<string>("");
  const [endAuctionTxHash, setEndAuctionTxHash] = useState<string>("");

  const fetchAuctionDetails = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {

      const utxos = await lucid.utxosAt(auctionAddress);
      console.log("UTXO Fetch From Address", utxos);
      if (utxos.length === 0) {
        setError("No UTXOs available at the given address.");
        setLoading(false);
        return;
      }

      let selectedUtxo;

      if (utxos.length === 1) {
        selectedUtxo = utxos[0];
      } else {
        // Get the last two UTXOs (most recent)
        const auctionUtxo1 = utxos[utxos.length - 1];
        const auctionUtxo2 = utxos[utxos.length - 2];
      
        // Check if their transaction hashes are the same
        selectedUtxo = auctionUtxo1.txHash === auctionUtxo2.txHash ? auctionUtxo2 : auctionUtxo1;
      }
      
      console.log("Selected UTXO from the list", selectedUtxo);

// Continue with the selected UTXO
  const datum = await lucid.datumOf(selectedUtxo);
  console.log("datum", datum);
  const auctionDatum = Data.from(datum) as Constr;
  console.log("auctionDatum", auctionDatum);
     
     const bidderHex = auctionDatum.fields[4];
      console.log("bidderHex", bidderHex);
      setBidderAddr(bidderHex);
      setBidderAddrStack(auctionDatum.fields[5]);

      const details = {
        object: new TextDecoder().decode(
          fromHex(auctionDatum.fields[1].toString()),
        ),
        deadline: auctionDatum.fields[2].toString(),
        status: auctionDatum.fields[3] as Constr,
        bidder: bidderHex,
        bidderStack: auctionDatum.fields[5],
        amount: auctionDatum.fields[6].toString(),
      };

      setprevAmount(details.amount);

      console.log("details fetch from auction ", details);
      console.log("Object", details.object);

      setAuctionDetails(details);
    } catch (err) {
      setError(`Error fetching auction details: ${err.message}`);
    } finally {
      setLoading(false);
    }

  };

  const placeBid = async (e: Event) => {
    e.preventDefault();

    if (!lucid || !auctionAddress) {
      console.error("Lucid or auction address is not initialized");
      return;
    }

    try {
     const auctionUtxos = await lucid.utxosAt(auctionAddress);
      if (!auctionUtxos || auctionUtxos.length === 0) {
        throw new Error("No UTXOs available at the auction address.");
      }

      let selectedUtxo;

      if (auctionUtxos.length === 1) {
        selectedUtxo = auctionUtxos[0];
      } else {
        // Get the last two UTXOs (most recent)
        const auctionUtxo1 = auctionUtxos[auctionUtxos.length - 1];
        const auctionUtxo2 = auctionUtxos[auctionUtxos.length - 2];
      
        // Check if their transaction hashes are the same
        selectedUtxo = auctionUtxo1.txHash === auctionUtxo2.txHash ? auctionUtxo2 : auctionUtxo1;
      }
      
      console.log("Selected UTXO from the list", selectedUtxo);
    
    // Continue with the selected UTXO
    const datum = await lucid.datumOf(selectedUtxo);
    console.log("datum", datum);

      const auctionDatum = Data.from(datum) as Constr;
      console.log("auctionDatum", auctionDatum);

      const newBidAmount = BigInt(Number(bidAmount) * 1000000);
      console.log("newBidAmount", newBidAmount);

      const redeemer = Data.to(new Constr(1, [])); // Bid redeemer
      console.log("BidRedeemer", redeemer);

      const bidderAddressDetails = lucid.utils.getAddressDetails(
        await lucid.wallet.address(),
      );
      const bidderPublicKeyHash = bidderAddressDetails.paymentCredential?.hash;
      const bidderStackKeyHash = bidderAddressDetails.stakeCredential?.hash;

      const bidDatum = Data.to(
        new Constr(0, [
          auctionDatum.fields[0], // seller
          auctionDatum.fields[1], // object
          auctionDatum.fields[2], // deadline
          new Constr(1, []), // STARTED status
          bidderPublicKeyHash, // bidder
          bidderStackKeyHash,
          newBidAmount, // new amount
        ]),
      );

      console.log("newAuctionDatum", bidDatum);
      const auctionDatumcheck = Data.from(bidDatum) as Constr;
      console.log("auctionDatum", auctionDatumcheck);



      // The one we pass to the contract to let the old bidder withdraw their amount
const withdraw_datum = Data.to(
  new Constr(0, [
    auctionDatum.fields[0], // seller
    auctionDatum.fields[1], // object
    auctionDatum.fields[2], // deadline
    new Constr(2, []),       // Status OUTBID 
    bidderAddr, 
    bidderAddrStack,           // old bidder
    BigInt(prevAmount), // new amount
  ]),
);

      console.log("withdraw_datum", withdraw_datum);

      const withdraw_datumchech = Data.from(withdraw_datum) as Constr;
      console.log("auctionDatum", withdraw_datumchech);

      const validators = readValidators();
      const contractScript = {
        type: validators.auction.type,
        script: validators.auction.script,
      };

      const timeOffset = 60 * 1000; // one minute
      const currentTime = new Date().getTime() - timeOffset;

      
      const tx = await lucid
      .newTx()
      .collectFrom([selectedUtxo], redeemer)
      .addSigner(await lucid.wallet.address())
      .payToContract(auctionAddress, { inline: bidDatum }, { lovelace: newBidAmount })
      .payToContract(auctionAddress, { inline: withdraw_datum}, { lovelace: BigInt(prevAmount) })
      .attachSpendingValidator(contractScript)
      .validFrom(currentTime)
      .complete();

      const txSigned = await tx.sign().complete();
      const txHash = await txSigned.submit();
      await lucid.awaitTx(txHash);
      console.log("Bid placed with tx hash:", txHash);
      setBidxHash(txHash);

      // Refresh auction details
    const updatedUtxosRef: OutRef = { txHash: txHash, outputIndex: 0 };
      console.log("updatedUtxos", updatedUtxosRef)
      const updatedUtxos = await lucid.utxosByOutRef([updatedUtxosRef]);
      console.log("updatedUtxos", updatedUtxos)
     
      const updatedAuctionUtxo = updatedUtxos[0];
      console.log("updatedAuctionUtxo", updatedAuctionUtxo)


      const updatedDatum = await lucid.datumOf(updatedAuctionUtxo);
      console.log("updatedDatum", updatedDatum)

      const updatedAuctionDatum = Data.from(updatedDatum) as Constr;
      console.log("updatedAuctionDatum", updatedAuctionDatum)

      const bidderHex = updatedAuctionDatum.fields[4];
      console.log("bidderHex", bidderHex)
      const bidderStack = updatedAuctionDatum.fields[5];
      console.log("bidderStack", bidderStack)

      const oldBid = updatedAuctionDatum.fields[6];
      console.log("oldBid", oldBid)
      setprevAmount(oldBid);

      setBidderAddr(bidderHex);
      setBidderAddrStack(bidderStack);
      const updatedDetails = {
        object: new TextDecoder().decode(
          fromHex(updatedAuctionDatum.fields[1].toString()),
        ),
        deadline: updatedAuctionDatum.fields[2].toString(),
        status: updatedAuctionDatum.fields[3] as Constr,
        bidder: bidderAddr,
        bidderStack: bidderAddrStack,
        amount: updatedAuctionDatum.fields[6].toString(),
      };

      setAuctionDetails(updatedDetails);
    } catch (error) {
      console.error("Error placing bid:", error);
      setError(`Error placing bid: ${error.message}`);
    }
  };

 const raiseBid = async (e: Event) => {
    e.preventDefault();

    if (!lucid || !auctionAddress) {
      console.error("Lucid or auction address is not initialized");
      return;
    }

    try {

      const auctionUtxos = await lucid.utxosAt(auctionAddress);
      if (!auctionUtxos || auctionUtxos.length === 0) {
        throw new Error("No UTXOs available at the auction address.");
      }

    // Get the last two UTXOs (most recent)
    const auctionUtxo1 = auctionUtxos[auctionUtxos.length - 1];
    const auctionUtxo2 = auctionUtxos[auctionUtxos.length - 2];
    
    // Check if their transaction hashes are the same
    const selectedUtxo = auctionUtxo1.txHash === auctionUtxo2.txHash ? auctionUtxo2 : auctionUtxo1;
    
    console.log("Selected UTXO from the list", selectedUtxo);

      const datum = await lucid.datumOf(selectedUtxo);
      console.log("datum", datum);
  
        const auctionDatum = Data.from(datum) as Constr;
        console.log("auctionDatum", auctionDatum);
  
        const bidderAddressDetails = lucid.utils.getAddressDetails(
          await lucid.wallet.address(),
        );
        const bidderPublicKeyHash = bidderAddressDetails.paymentCredential?.hash;
        const bidderStackKeyHash = bidderAddressDetails.stakeCredential?.hash;
  
        const newBidAmount = BigInt(Number(bidAmount) * 1000000);
        console.log("newBidAmount", newBidAmount);

        const raiseDatum = Data.to(
          new Constr(0, [
            auctionDatum.fields[0], // seller
            auctionDatum.fields[1], // object
            auctionDatum.fields[2], // deadline
            new Constr(1, []), // STARTED status
            bidderPublicKeyHash, // bidder
            bidderStackKeyHash,
            newBidAmount, // new amount
          ]),
        );


      const redeemer = Data.to(new Constr(1, []));     //Bid  

      const timeOffset = 60 * 1000; // one minute
    const currentTime = new Date().getTime() - timeOffset;

    const validators = readValidators();
      const contractScript = {
        type: validators.auction.type,
        script: validators.auction.script,
      };      

      const tx = await lucid
      .newTx()
      .collectFrom([selectedUtxo], redeemer)
      .addSigner(await lucid.wallet.address())
      .payToContract(auctionAddress, { inline: raiseDatum }, { lovelace: newBidAmount })
      .attachSpendingValidator(contractScript)
      .validFrom(currentTime)
      .complete();
     
      const txSigned = await tx.sign().complete();
      const txHash = await txSigned.submit();
      await lucid.awaitTx(txHash);

      console.log("Bid Raised with tx hash:", txHash);
      setBidxHash(txHash) ;

      // Refresh auction details
    const updatedUtxosRef: OutRef = { txHash: txHash, outputIndex: 0 };
      console.log("updatedUtxos", updatedUtxosRef)
      const updatedUtxos = await lucid.utxosByOutRef([updatedUtxosRef]);
      console.log("updatedUtxos", updatedUtxos)
     
      const updatedAuctionUtxo = updatedUtxos[0];
      console.log("updatedAuctionUtxo", updatedAuctionUtxo);

      const updatedDatum = await lucid.datumOf(updatedAuctionUtxo);
      console.log("updatedDatum", updatedDatum);

      const updatedAuctionDatum = Data.from(updatedDatum) as Constr;
      console.log("updatedAuctionDatum", updatedAuctionDatum)

      const bidderHex = updatedAuctionDatum.fields[4];
      console.log("bidderHex", bidderHex)
      const bidderStack = updatedAuctionDatum.fields[5];
      console.log("bidderStack", bidderStack)

      const oldBid = updatedAuctionDatum.fields[6];
      console.log("oldBid", oldBid)
      setprevAmount(oldBid);
      setBidderAddr(bidderHex);
      setBidderAddrStack(bidderStack);
      const updatedDetails = {
        object: new TextDecoder().decode(
          fromHex(updatedAuctionDatum.fields[1].toString()),
        ),
        deadline: updatedAuctionDatum.fields[2].toString(),
        status: updatedAuctionDatum.fields[3] as Constr,
        bidder: bidderAddr,
        bidderStack: bidderAddrStack,
        amount: updatedAuctionDatum.fields[6].toString(),
      };

      setAuctionDetails(updatedDetails);

    } catch (error) {
      console.error("Error Raising bid:", error);
      setError(`Error Raising bid: ${error.message}`);
    }
  };


  const handleBid = async (e: Event) => {
    e.preventDefault();

    const utxos = await lucid.utxosAt(auctionAddress);
    console.log("utxos in handleBid Function",utxos);

    
    let selectedUtxo;

      if (utxos.length === 1) {
        selectedUtxo = utxos[0];
      } else {
        // Get the last two UTXOs (most recent)
        const auctionUtxo1 = utxos[utxos.length - 1];
        const auctionUtxo2 = utxos[utxos.length - 2];
      
        // Check if their transaction hashes are the same
        selectedUtxo = auctionUtxo1.txHash === auctionUtxo2.txHash ? auctionUtxo2 : auctionUtxo1;
      }
      
      console.log("Selected UTXO from the list", selectedUtxo);
    
    const datum = await lucid.datumOf(selectedUtxo);
    console.log("datum", datum);

      const auctionDatum = Data.from(datum) as Constr;
      console.log("auctionDatum", auctionDatum);

      const bidderAddressDetails = lucid.utils.getAddressDetails(
        await lucid.wallet.address(),
      );
      const bidderPublicKeyHash = bidderAddressDetails.paymentCredential?.hash;



    const isBidPlaced = auctionDatum.fields[4] === bidderPublicKeyHash;
    console.log("isBidPlaced", isBidPlaced)

    if (isBidPlaced) {
      console.log("calling rasieBid Function");
      await raiseBid(e);
    } else {
      console.log("calling placeBid Function");
      await placeBid(e);
    }
  };


  const withdrawBid = async (e: Event) => {
    e.preventDefault();
  
    if (!lucid || !auctionAddress) {
      console.error("Lucid or auction address is not initialized");
      return;
    }
  
    try {
      const auctionUtxos = await lucid.utxosAt(auctionAddress);
      if (!auctionUtxos || auctionUtxos.length === 0) {
        throw new Error("No UTXOs available at the auction address.");
      }
  
      let selectedUtxo;

      if (auctionUtxos.length === 1) {
        selectedUtxo = auctionUtxos[0];
      } else {
        // Get the last two UTXOs (most recent)
        const auctionUtxo1 = auctionUtxos[auctionUtxos.length - 1];
        const auctionUtxo2 = auctionUtxos[auctionUtxos.length - 2];
      
        // Check if their transaction hashes are the same
        selectedUtxo = auctionUtxo1.txHash === auctionUtxo2.txHash ? auctionUtxo2 : auctionUtxo1;
      }
      
      console.log("Selected UTXO from the list", selectedUtxo);
  
      const datum = await lucid.datumOf(selectedUtxo);
      console.log("datum", datum);
      const auctionDatum = Data.from(datum) as Constr;
      console.log("auctionDatum", auctionDatum);
  
      const redeemer = Data.to(new Constr(2, [])); // Withdraw redeemer
      const timeOffset = 60 * 1000; // one minute
      const currentTime = new Date().getTime() - timeOffset;
  
      const validators = readValidators();
      const contractScript = {
        type: validators.auction.type,
        script: validators.auction.script,
      };
  
      const tx = await lucid
        .newTx()
        .collectFrom([selectedUtxo], redeemer)
        .addSigner(await lucid.wallet.address())
        .attachSpendingValidator(contractScript)
        .validFrom(currentTime)
        .complete();
  
      const txSigned = await tx.sign().complete();
      const txHash = await txSigned.submit();
      await lucid.awaitTx(txHash);
  
      console.log("Bid withdrawn with tx hash:", txHash);

      setWithdrawBidTxHash(txHash);

    } catch (error) {
      console.error("Error withdrawing bid:", error);
      setError(`Error withdrawing bid: ${error.message}`);
    }
  };

  const endAuction = async (e: Event) => {
    console.log("im in end Auction function");
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const validators = readValidators();
      const contractScript = {
        type: validators.auction.type,
        script: validators.auction.script,
      };

      const auctionUtxos = await lucid.utxosAt(auctionAddress);
      console.log("the fetch utxo for ennding auction:",auctionUtxos);
      if (!auctionUtxos || auctionUtxos.length === 0) {
        throw new Error("No UTXOs available at the auction address.");
      }


      let selectedUtxo;

      if (auctionUtxos.length === 1) {
        selectedUtxo = auctionUtxos[0];
      } else {
        // Get the last two UTXOs (most recent)
        const auctionUtxo1 = auctionUtxos[auctionUtxos.length - 1];
        const auctionUtxo2 = auctionUtxos[auctionUtxos.length - 2];
      
        // Check if their transaction hashes are the same
        selectedUtxo = auctionUtxo1.txHash === auctionUtxo2.txHash ? auctionUtxo2 : auctionUtxo1;
      }
      
      console.log("Selected UTXO from the list", selectedUtxo);
      
      const datum = await lucid.datumOf(selectedUtxo);
      const auctionDatum = Data.from(datum) as Constr;
      console.log("auctionDatum:",auctionDatum);
      

      const highestBid = auctionDatum.fields[6] ;
      const bidder =  auctionDatum.fields[4];
      const bidderStackKeyHash = auctionDatum.fields[5];

      const sellerAddressDetails = lucid.utils.getAddressDetails(await lucid.wallet.address());
      const sellerPublicKeyHash = sellerAddressDetails.paymentCredential?.hash;
     

      const endDatum = Data.to(
        new Constr(0, [
          sellerPublicKeyHash,    //Seller
          auctionDatum.fields[1], // object
          auctionDatum.fields[2], // deadline
          new Constr(3, []),       // Status ENDED
          bidder,  
          bidderStackKeyHash,           // highest bidder
          highestBid,                // highest bid
        ]),
      );

      const redeemer = Data.to(new Constr(3, [])); // End redeemer
      const timeOffset = 60 * 1000; // one minute
      const currentTime = new Date().getTime() - timeOffset;
      console.log("currentTime:",currentTime);

      const tx = await lucid
        .newTx()
        .collectFrom([selectedUtxo], redeemer)
       .addSigner(await lucid.wallet.address())
        .payToContract(auctionAddress, { inline: endDatum }, { lovelace: 1500000n }) // 1.5 ADA just for exceeding the minimum ADA required for starting a tx
        .attachSpendingValidator(contractScript)
        .validFrom(currentTime)
        .complete();

      const txSigned = await tx.sign().complete();
      const txHash = await txSigned.submit();
      await lucid.awaitTx(txHash);

      console.log("Auction ended with tx hash:", txHash);
      setEndAuctionTxHash(txHash);

      const updatedUtxosRef: OutRef = { txHash: txHash, outputIndex: 0 };
      const updatedUtxos = await lucid.utxosByOutRef([updatedUtxosRef]);
      const updatedAuctionUtxo = updatedUtxos[0];

      const updatedDatum = await lucid.datumOf(updatedAuctionUtxo);
      const updatedAuctionDatum = Data.from(updatedDatum) as Constr;

      const updatedDetails = {
        object: new TextDecoder().decode(fromHex(updatedAuctionDatum.fields[1].toString())),
        deadline: updatedAuctionDatum.fields[2].toString(),
        status: updatedAuctionDatum.fields[3] as Constr,
        bidder: updatedAuctionDatum.fields[4],
        amount: updatedAuctionDatum.fields[5].toString(),
      };

      setAuctionDetails(updatedDetails);
    } catch (err) {
      setError(`Error ending auction: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <form
        class="mt-10 grid grid-cols-1 gap-y-8"
        onSubmit={fetchAuctionDetails}
      >
        <Input
          type="text"
          id="auctionAddress"
          value={auctionAddress}
          onInput={(e) => setAuctionAddress(e.currentTarget.value)}
        >
          Auction Address
        </Input>

        <Button type="submit">Fetch Auction Details</Button>
      </form>

      {loading ? <p>Loading auction details...</p> : auctionDetails
        ? (
          <div>
            <h2>Auction Details</h2>
            <p>Object: {auctionDetails.object}</p>
            <p>
              Deadline: {new Date(Number(auctionDetails.deadline))
                .toLocaleString()}
            </p>

            <p>
              Current Bid Amount: {Number(auctionDetails.amount) / 1000000} ADA
            </p>

            <form onSubmit={handleBid} style={{ marginBottom: '1rem' }}>
  <Input
    type="number"
    id="bidAmount"
    value={bidAmount}
    onInput={(e) => setBidAmount(e.currentTarget.value)}
  >
    Your Bid Amount (ADA)
  </Input>
  <Button type="submit">Place/Raise Bid</Button>
</form>

<form onSubmit={withdrawBid} style={{ marginBottom: '1rem' }}>
  <Button type="submit">Withdraw Bid</Button>
</form>
<form onSubmit={endAuction} style={{ marginBottom: '1rem' }}>
  <Button type="submit">End Auction</Button>
</form>



{bidTxHash && (
              <div>
                <h3>Bid Transaction</h3>
                <a
                  target="_blank"
                  href={`https://preview.cardanoscan.io/transaction/${bidTxHash}`}
                >
                  {bidTxHash}
                </a>
              </div>
            )}

{withdrawBidTxHash && (
              <div>
                <h3>WithDraw Bid Transaction</h3>
                <a
                  target="_blank"
                  href={`https://preview.cardanoscan.io/transaction/${withdrawBidTxHash}`}
                >
                  {withdrawBidTxHash}
                </a>
              </div>
            )}

{endAuctionTxHash && (
              <div>
                <h3>End Auction Transaction</h3>
                <a
                  target="_blank"
                  href={`https://preview.cardanoscan.io/transaction/${endAuctionTxHash}`}
                >
                  {endAuctionTxHash}
                </a>
              </div>
            )}
      
          </div>
        )
        : (
          !loading && <p>No auction details available.</p>
        )}
      {error && <p>{error}</p>}
    </div>
  );
}
