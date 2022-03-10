package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// requestAirdropCmd represents the request-airdrop command
var requestAirdropCmd = &cobra.Command{
	Use:   "request-airdrop",
	Short: "Request SOL airdrop",
	Long:  "Request SOL airdrop to your wallet.",

	Args: cobra.ExactArgs(1),

	RunE: func(cmd *cobra.Command, args []string) error {
		lamports, err := parseSolToLamports(strings.TrimSpace(args[0]))
		if err != nil {
			return err
		}

		fmt.Printf("Requesting airdrop of %s\n", fmtLamports(lamports))

		wallet, err := loadWallet(devnetRPCEndpoint)
		if err != nil {
			return err
		}

		txHash, err := wallet.requestAirdrop(lamports)
		if err != nil {
			return err
		}

		fmt.Printf("Airdropped %s\nTransaction hash: %s\n", fmtLamports(lamports), txHash)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(requestAirdropCmd)
}
