use {
    voting::{
        self,
        instruction::{self, add_voter, init_ballot, VotingInstruction},
        processor::Processor,
        state::{
            ballot::{
                Ballot, BALLOT_SEED, get_ballot_state_key, Proposal,
            },
            voter::get_voter_state_key_and_bump_seed,
        },
    },
    assert_matches::assert_matches,
    borsh::BorshDeserialize,
    solana_program::{
        hash::Hash,
        native_token::LAMPORTS_PER_SOL,
        pubkey::Pubkey,
        system_instruction,
    },
    solana_sdk::{
        signature::{Keypair, Signer},
        transaction::Transaction,
    },
    solana_program_test::{BanksClient, processor, tokio, ProgramTest}
};

#[tokio::test]
async fn test_voting() {
    // Scenario: There are 10 voters and 3 proposals
    //
    // Delegation is as follows:
    //   0
    //   1 -> 2
    //   3 -> 4 -> 5
    //   6 -> 7 -> 9
    //        8 ---^
    //
    // Voting and delegation is carried out in this order:
    //   0 => v0a
    //   1 -> 2 => d1 v2b
    //   3 -> 4 -> 5 => d3 d4 v5c
    //   6 -> 7 -> 9 => d7 v9a d6 d8
    //        8 ---^
    //
    // Final votes:
    //   a => 5
    //   b => 2
    //   c => 3

    let program_id = Pubkey::new_unique();
    let pt = ProgramTest::new(
        "voting",
        program_id,
        processor!(Processor::process_instruction),
    );

    let ctx = pt.start_with_context().await;
    let mut banks_client = ctx.banks_client;
    let payer = ctx.payer;
    let recent_blockhash = ctx.last_blockhash;

    let mut voters = Vec::with_capacity(10);
    for _ in 0..10 {
        voters.push(Keypair::new());
    }

    let ballot_state_key = get_ballot_state_key(&payer.pubkey());

    let proposals = vec!["a".to_string(), "b".to_string(), "c".to_string()];
    let ballot_state = Ballot {
        is_initialized: true,
        chairperson: payer.pubkey(),
        proposals: proposals
            .iter()
            .map(|name| Proposal { name: name.to_string(), vote_count: 0 })
            .collect(),
    };
    let ballot_state_size = ballot_state.serialized_size();

    println!("---------------ID ==== {}--------------", voting::id());

    let instruction = system_instruction::create_account_with_seed(
        &payer.pubkey(),
        &ballot_state_key,
        &payer.pubkey(),
        BALLOT_SEED,
        LAMPORTS_PER_SOL / 10,
        ballot_state_size as u64,
        &voting::id(),
    );
    let mut transaction = Transaction::new_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));

    let instruction = init_ballot(
        program_id,
        VotingInstruction::InitBallot {
            chairperson: payer.pubkey(),
            proposals,
        },
        payer.pubkey(),
        ballot_state_key,
    ).unwrap();
    let mut transaction = Transaction::new_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));

    let mut voter_state_keys = Vec::with_capacity(10);
    let mut voter_bump_seeds = Vec::with_capacity(10);
    for i in 0..10 {
        let (voter_state_key, bump_seed) =
            get_voter_state_key_and_bump_seed(&program_id, &ballot_state_key, &voters[i].pubkey());
        voter_state_keys.push(voter_state_key);
        voter_bump_seeds.push(bump_seed);

        let instruction = add_voter(
            program_id,
            VotingInstruction::AddVoter {
                voter: voters[i].pubkey(),
                voter_bump_seed: voter_bump_seeds[i],
            },
            payer.pubkey(),
            ballot_state_key,
            voter_state_key,
        ).unwrap();
        let mut transaction = Transaction::new_with_payer(
            &[instruction],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer], recent_blockhash);
        assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
    }

    let mut tc = TestingContext {
        banks_client,
        program_id,
        recent_blockhash,
        payer,
        ballot_state_key,
        voter_state_keys,
    };

    tc.vote(0, 0).await;
    assert_eq!(tc.proposal_vote_count(0).await, 1);
    assert_eq!(tc.proposal_vote_count(1).await, 0);
    assert_eq!(tc.proposal_vote_count(2).await, 0);

    tc.delegate_vote(1, &[2]).await;
    tc.vote(2, 1).await;
    assert_eq!(tc.proposal_vote_count(0).await, 1);
    assert_eq!(tc.proposal_vote_count(1).await, 2);
    assert_eq!(tc.proposal_vote_count(2).await, 0);

    tc.delegate_vote(3, &[4]).await;
    tc.delegate_vote(4, &[5]).await;
    tc.vote(5, 2).await;
    assert_eq!(tc.proposal_vote_count(0).await, 1);
    assert_eq!(tc.proposal_vote_count(1).await, 2);
    assert_eq!(tc.proposal_vote_count(2).await, 3);

    tc.delegate_vote(7, &[9]).await;
    tc.vote(9, 0).await;
    assert_eq!(tc.proposal_vote_count(0).await, 3);
    assert_eq!(tc.proposal_vote_count(1).await, 2);
    assert_eq!(tc.proposal_vote_count(2).await, 3);

    tc.delegate_vote(6, &[7, 9]).await;
    tc.delegate_vote(8, &[9]).await;
    assert_eq!(tc.proposal_vote_count(0).await, 5);
    assert_eq!(tc.proposal_vote_count(1).await, 2);
    assert_eq!(tc.proposal_vote_count(2).await, 3);
}

struct TestingContext {
    banks_client: BanksClient,
    program_id: Pubkey,
    recent_blockhash: Hash,
    payer: Keypair,
    ballot_state_key: Pubkey,
    voter_state_keys: Vec<Pubkey>,
}

impl TestingContext {
    async fn delegate_vote(&mut self, voter_idx: usize, delegate_idx: &[u8]) {
        let delegate_chain: Vec<Pubkey> = delegate_idx
            .iter()
            .map(|idx| self.voter_state_keys[*idx as usize])
            .collect();
        let instruction = instruction::delegate_vote(
            self.program_id,
            VotingInstruction::DelegateVote,
            self.payer.pubkey(),
            self.ballot_state_key,
            self.voter_state_keys[voter_idx],
            &delegate_chain,
        ).unwrap();
        let mut transaction = Transaction::new_with_payer(
            &[instruction],
            Some(&self.payer.pubkey()),
        );
        transaction.sign(&[&self.payer], self.recent_blockhash);
        assert_matches!(self.banks_client.process_transaction(transaction).await, Ok(()));
    }

    async fn vote(&mut self, voter_idx: usize, vote: u8) {
        let instruction = instruction::vote(
            self.program_id,
            VotingInstruction::Vote {
                vote,
            },
            self.payer.pubkey(),
            self.ballot_state_key,
            self.voter_state_keys[voter_idx],
        ).unwrap();
        let mut transaction = Transaction::new_with_payer(
            &[instruction],
            Some(&self.payer.pubkey()),
        );
        transaction.sign(&[&self.payer], self.recent_blockhash);
        assert_matches!(self.banks_client.process_transaction(transaction).await, Ok(()));
    }

    async fn proposal_vote_count(&mut self, proposal_idx: usize) -> u64 {
        let account =
            self.banks_client.get_account(self.ballot_state_key).await.unwrap().unwrap();
        let ballot: Ballot = Ballot::try_from_slice(&account.data).unwrap();
        ballot.proposals[proposal_idx].vote_count
    }
}
