package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// transferCmd represents the transfer command
var transferCmd = &cobra.Command{
	Use:   "transfer",
	Short: "Transfer SOL from your wallet",
	Long:  "Transfer SOL from your wallet to other Solana wallets.",

	Args: cobra.ExactArgs(2),

	RunE: func(cmd *cobra.Command, args []string) error {
		lamports, err := parseSolToLamports(strings.TrimSpace(args[1]))
		if err != nil {
			return err
		}

		to := strings.TrimSpace(args[0])
		fmt.Printf("Transferring %s to %s\n", fmtLamports(lamports), to)

		wallet, err := loadWallet(devnetRPCEndpoint)
		if err != nil {
			return err
		}

		txHash, err := wallet.transfer(to, lamports)
		if err != nil {
			return err
		}

		fmt.Printf("Transaction complete\nTransaction hash: %s\n", txHash)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(transferCmd)
}
