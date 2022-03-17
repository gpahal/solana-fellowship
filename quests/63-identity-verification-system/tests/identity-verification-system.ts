import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { IdentityVerificationSystem } from "../target/types/identity_verification_system";

describe("identity-verification-system", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.IdentityVerificationSystem as Program<IdentityVerificationSystem>;

  it("Is initialized!", async () => {
    // Add your test here.
  });
});
