import { BinaryReader, BinaryWriter } from "borsh";
import { PublicKey } from "@solana/web3.js";
import base58 from "bs58";

export const extendBorsh = () => {
  (BinaryReader.prototype).readPubkey = function() {
    const reader = this;
    const array = reader.readFixedArray(32);
    return new PublicKey(array);
  };

  (BinaryWriter.prototype).writePubkey = function(value) {
    const writer = this;
    writer.writeFixedArray(value.toBuffer());
  };

  (BinaryReader.prototype).readPubkeyAsString = function() {
    const reader = this;
    const array = reader.readFixedArray(32);
    return base58.encode(array);
  };

  (BinaryWriter.prototype).writePubkeyAsString = function(value) {
    const writer = this;
    writer.writeFixedArray(base58.decode(value));
  };
};
